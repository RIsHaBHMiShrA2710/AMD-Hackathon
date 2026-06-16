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

_REGISTRY_PATH = Path(__file__).parent.parent / "mock_data" / "verification_registry.json"

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


def _load_registry() -> list[dict]:
    """Load and return the verification registry database from disk."""
    try:
        with open(_REGISTRY_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        logger.error("Registry file not found at %s", _REGISTRY_PATH)
        return []
    except json.JSONDecodeError as exc:
        logger.error("Registry JSON parse error: %s", exc)
        return []


def run_registry_verification(extracted_data: dict[str, Any]) -> list[dict]:
    """
    Cross-checks extracted document details against the Government National Registry database.
    Detects document tampering, status suspensions, and unlisted IDs.
    """
    registry = _load_registry()
    doc_num = extracted_data.get("document_number", "").strip().replace("-", "")
    doc_type = extracted_data.get("document_type", "").strip()
    full_name = extracted_data.get("full_name", "").strip()
    dob = extracted_data.get("date_of_birth", "").strip()

    if not doc_num or doc_num in ("UNKNOWN", "EXTRACTION_FAILED"):
        return [{
            "type": "REGISTRY_ERROR",
            "score": 50,
            "reason": "Document number not extracted or unreadable. Cannot verify validity."
        }]

    # Normalize registry document numbers for comparison
    record = None
    for entry in registry:
        entry_num = entry.get("document_number", "").strip().replace("-", "")
        if entry_num.lower() == doc_num.lower():
            record = entry
            break

    if not record:
        logger.warning("Registry verification: document %s not found in database", doc_num)
        return [{
            "type": "REGISTRY_NOT_FOUND",
            "score": 70,
            "reason": f"Document ID '{doc_num}' ({doc_type}) was not found in the Government Verification Registry."
        }]

    flags = []
    
    # 1. Check Document Status
    status = record.get("status", "ACTIVE")
    if status == "SUSPENDED":
        flags.append({
            "type": "REGISTRY_SUSPENDED",
            "score": 100,
            "reason": f"CRITICAL: Registry status for document {doc_num} is SUSPENDED/REVOKED."
        })
    elif status == "EXPIRED":
        flags.append({
            "type": "REGISTRY_EXPIRED",
            "score": 80,
            "reason": f"Registry indicates this document ({doc_num}) has EXPIRED."
        })

    # 2. Check Name Consistency
    reg_name = record.get("full_name", "").strip()
    name_similarity = fuzz.token_sort_ratio(full_name.lower(), reg_name.lower())
    if name_similarity < 80:
        flags.append({
            "type": "REGISTRY_NAME_MISMATCH",
            "score": 90,
            "reason": f"Document Tampering Alert: Extracted name '{full_name}' does not match registry record '{reg_name}' (similarity: {name_similarity}%)."
        })

    # 3. Check Date of Birth Consistency
    reg_dob = record.get("date_of_birth", "").strip()
    
    def normalize_dob(d):
        d = d.replace("/", "-").replace(".", "-").strip()
        # if format is DD-MM-YYYY, convert to YYYY-MM-DD
        parts = d.split("-")
        if len(parts) == 3 and len(parts[0]) == 2 and len(parts[2]) == 4:
            return f"{parts[2]}-{parts[1]}-{parts[0]}"
        return d

    norm_extracted_dob = normalize_dob(dob)
    norm_reg_dob = normalize_dob(reg_dob)
    
    if norm_extracted_dob != norm_reg_dob:
        flags.append({
            "type": "REGISTRY_DOB_MISMATCH",
            "score": 98,
            "reason": f"Document Tampering Alert: Extracted DOB '{dob}' does not match registry record '{reg_dob}'."
        })

    return flags


# ── Compliance Check ───────────────────────────────────────────────────────────

def run_compliance_check(extracted_data: dict[str, Any]) -> tuple[list[dict], float]:
    """
    Screen the extracted full_name against the sanctions watchlist using
    fuzzy string matching, and cross-reference against national registries.
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

    # ── National Registry Cross-Verification ──────────────────────────────────
    registry_flags = run_registry_verification(extracted_data)
    for flag in registry_flags:
        score = flag.get("score", 0)
        compliance_flags.append({
            "watchlist_id": "GOV-REGISTRY",
            "matched_name": "N/A",
            "submitted_name": full_name,
            "score": score,
            "score_normalized": round(score / 100, 4),
            "risk_tier": "HIGH" if score >= 90 else "MEDIUM",
            "country": extracted_data.get("nationality", "IN")[:2].upper(),
            "reason": flag.get("reason", ""),
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
