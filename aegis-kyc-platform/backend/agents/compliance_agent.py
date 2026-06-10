"""
AegisKYC — Compliance Agent
=============================
Performs watchlist screening using fuzzy name matching (FuzzyWuzzy).
Compares the extracted full_name against all name variations in the
sanctions watchlist. Any match scoring ≥ 85% is flagged.

Design decisions:
  - Uses fuzzywuzzy.process.extractBests for multi-variant matching
  - Confidence score is the HIGHEST single match score found (0.0–1.0)
  - Score > 0.95 triggers automatic ESCALATE (handled by graph conditional edge)
  - fuzz.token_sort_ratio is used for word-order-invariant matching
    (e.g., "John Doe" vs "Doe John" both match)
"""

import json
import logging
import os
from pathlib import Path
from typing import Any

from fuzzywuzzy import fuzz, process

logger = logging.getLogger(__name__)

# ── Watchlist Loading ──────────────────────────────────────────────────────────

# Resolve path relative to this file so it works regardless of CWD
_WATCHLIST_PATH = Path(__file__).parent.parent / "mock_data" / "watchlists.json"

# Threshold for flagging a match (percentage, 0–100)
MATCH_THRESHOLD = 85


def _load_watchlist() -> list[dict]:
    """Load and return the sanctions watchlist from disk."""
    try:
        with open(_WATCHLIST_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        logger.error("Watchlist file not found at %s", _WATCHLIST_PATH)
        return []
    except json.JSONDecodeError as exc:
        logger.error("Watchlist JSON parse error: %s", exc)
        return []


# ── Compliance Check ───────────────────────────────────────────────────────────

def run_compliance_check(extracted_data: dict[str, Any]) -> tuple[list[dict], float]:
    """
    Screen the extracted full_name against the sanctions watchlist using
    fuzzy string matching.

    Args:
        extracted_data: dict from extraction agent containing at least 'full_name'

    Returns:
        (compliance_flags: list[dict], confidence_score: float)
        - compliance_flags: list of dicts for each flagged match
        - confidence_score: highest match score as a 0.0–1.0 float
    """
    watchlist = _load_watchlist()
    full_name = extracted_data.get("full_name", "").strip()

    # Cannot screen an unknown name
    if not full_name or full_name in ("EXTRACTION_FAILED", "UNKNOWN"):
        logger.warning("Compliance agent: no valid name to screen — skipping")
        return [], 0.0

    compliance_flags: list[dict] = []
    highest_score = 0  # raw fuzzywuzzy score (0–100)

    logger.info("Compliance agent: screening '%s' against %d entities", full_name, len(watchlist))

    for entity in watchlist:
        entity_id = entity.get("id", "UNKNOWN")
        risk_tier = entity.get("risk_tier", "UNKNOWN")
        country = entity.get("country", "UNKNOWN")
        name_variants: list[str] = entity.get("names", [])

        if not name_variants:
            continue

        # extractBests returns [(matched_string, score), ...] for all variants above threshold
        # token_sort_ratio handles word-order differences robustly
        matches = process.extractBests(
            full_name,
            name_variants,
            scorer=fuzz.token_sort_ratio,
            score_cutoff=MATCH_THRESHOLD,
            limit=len(name_variants),
        )

        for matched_name, score in matches:
            logger.info(
                "Compliance agent: MATCH — '%s' ~ '%s' (score=%d, tier=%s)",
                full_name, matched_name, score, risk_tier,
            )
            compliance_flags.append({
                "watchlist_id": entity_id,
                "matched_name": matched_name,
                "submitted_name": full_name,
                "score": score,
                "score_normalized": round(score / 100, 4),
                "risk_tier": risk_tier,
                "country": country,
                "reason": entity.get("reason", ""),
            })
            if score > highest_score:
                highest_score = score

    # Normalize score to 0.0–1.0
    confidence_score = round(highest_score / 100, 4)

    if compliance_flags:
        logger.warning(
            "Compliance agent: %d flag(s) found, highest confidence=%.2f",
            len(compliance_flags), confidence_score,
        )
    else:
        logger.info("Compliance agent: no matches found — name is CLEAR")

    return compliance_flags, confidence_score
