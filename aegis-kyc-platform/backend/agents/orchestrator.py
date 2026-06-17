"""
AegisKYC — Orchestrator Agent
================================
The final reasoning agent in the pipeline. It receives the full populated
KYCState and composes a structured contextual payload to submit to the LLM,
asking it to produce a final compliance decision with explainable rationale.

Decision options:
  APPROVE   — No issues detected, applicant cleared
  REVIEW    — Minor concerns, human analyst should review
  ESCALATE  — High-risk match or structural issues; immediate escalation required

The LLM response is strictly validated — unexpected formats default to ESCALATE.
"""

import json
import logging
from typing import Any

from core.llm_client import LLMClient

logger = logging.getLogger(__name__)


# ── System Prompt ──────────────────────────────────────────────────────────────

_ORCHESTRATOR_SYSTEM = """You are an expert KYC compliance orchestrator at a financial institution.
You will receive a structured KYC case summary and must provide a final compliance decision.

You MUST return a JSON object with exactly these two keys:
{
  "decision": "APPROVE" | "REVIEW" | "ESCALATE",
  "rationale": "Exactly two sentences explaining the decision."
}

Decision criteria:
- APPROVE: No compliance flags, confidence score below 0.5, extraction fully successful
- REVIEW: Minor flags OR confidence score 0.5–0.85 OR data quality issues
- ESCALATE: Any HIGH risk-tier flag, confidence score above 0.85, or system errors

Rules:
- Return ONLY the JSON object, no extra text or markdown
- The rationale must be exactly two complete sentences
- Be specific — reference the actual data in your rationale"""


async def run_orchestrator(
    state: dict[str, Any],
    llm_client: LLMClient,
) -> tuple[str, str]:
    """
    Compose a case summary and ask the LLM to render a final compliance decision.

    Args:
        state: The current KYCState dict
        llm_client: The shared async LLM client

    Returns:
        (decision: str, rationale: str)
    """
    # ── Build structured context payload ──────────────────────────────────────
    extracted = state.get("extracted_data", {})
    flags = state.get("compliance_flags", [])
    confidence = state.get("confidence_score", 0.0)
    security_status = state.get("security_status", "OK")

    # Format flags for LLM consumption
    flags_summary = "None detected"
    if flags:
        flag_lines = []
        for f in flags:
            flag_lines.append(
                f"  - Watchlist ID: {f.get('watchlist_id')}, "
                f"Matched: '{f.get('matched_name')}', "
                f"Score: {f.get('score')}%, "
                f"Risk: {f.get('risk_tier')}, "
                f"Country: {f.get('country')}"
            )
        flags_summary = "\n".join(flag_lines)

    case_summary = f"""KYC CASE SUMMARY
================
Case ID: {state.get('case_id', 'UNKNOWN')}
Security Status: {security_status}

EXTRACTED IDENTITY:
  Full Name: {extracted.get('full_name', 'UNKNOWN')}
  Date of Birth: {extracted.get('date_of_birth', 'UNKNOWN')}
  Nationality: {extracted.get('nationality', 'UNKNOWN')}
  Document Type: {extracted.get('document_type', 'UNKNOWN')}
  Document Number: {extracted.get('document_number', 'UNKNOWN')}

WATCHLIST SCREENING:
  Confidence Score: {confidence:.4f} ({confidence * 100:.1f}%)
  Flags Found: {len(flags)}
{flags_summary}

PRIOR AGENT LOGS:
{chr(10).join(state.get('agent_logs', [])[-5:])}
"""

    logger.info("Orchestrator: submitting case %s for final decision", state.get("case_id"))

    # ── LLM Call ───────────────────────────────────────────────────────────────
    raw_response = await llm_client.complete(
        system_prompt=_ORCHESTRATOR_SYSTEM,
        user_prompt=f"Provide a compliance decision for this case:\n\n{case_summary}",
        temperature=0.1,
        max_tokens=1024,
    )

    # ── Parse and validate response ────────────────────────────────────────────
    try:
        cleaned = raw_response.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        parsed = json.loads(cleaned)

        decision = parsed.get("decision", "ESCALATE").upper().strip()
        rationale = parsed.get("rationale", "Decision unavailable — case escalated for safety.")

        # Validate decision is one of the allowed values
        if decision not in ("APPROVE", "REVIEW", "ESCALATE"):
            logger.warning("Orchestrator: unexpected decision '%s' — defaulting to ESCALATE", decision)
            decision = "ESCALATE"
            rationale = f"Invalid decision format received from LLM. Original: '{decision}'. Case escalated for safety."

        logger.info("Orchestrator: decision=%s", decision)
        return decision, rationale

    except (json.JSONDecodeError, KeyError, AttributeError) as exc:
        logger.error("Orchestrator: failed to parse LLM response: %s | raw: %s", exc, raw_response[:200])
        return (
            "ESCALATE",
            "The automated compliance system encountered an error processing this case. "
            "The case has been escalated to a human compliance officer for manual review.",
        )
