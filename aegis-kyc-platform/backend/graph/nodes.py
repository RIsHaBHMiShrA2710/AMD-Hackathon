"""
AegisKYC — LangGraph Node Wrappers
=====================================
Each agent is wrapped as a standalone LangGraph node function.
Node functions receive the full KYCState, execute one agent step,
then return a PARTIAL state update dict (LangGraph merges it into the
running state automatically).

Key design patterns:
  - Every node appends a timestamped entry to agent_logs
  - Every node emits stream_events for real-time frontend visualization
  - Exceptions are caught internally; failures set final_decision="ESCALATE"
  - Nodes are synchronous wrappers around async agents using asyncio.run() — 
    NOTE: LangGraph nodes in sync graphs must be sync functions.
    For async graph support use ainvoke/astream with async nodes.
"""

import asyncio
import logging
from datetime import datetime, timezone

from core.state import KYCState
from core.guardrails import inbound_shield, outbound_sanitizer
from core.llm_client import llm_client
from agents.extraction_agent import run_extraction_agent
from agents.compliance_agent import run_compliance_check
from agents.orchestrator import run_orchestrator
from agents.ocr_agent import run_ocr_agent

logger = logging.getLogger(__name__)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _now() -> str:
    """ISO 8601 UTC timestamp for log entries."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _log(node_name: str, message: str) -> str:
    """Format a timestamped agent log entry."""
    return f"[{_now()}] [{node_name.upper()}] {message}"


def _event(event_type: str, node: str, message: str, data: dict | None = None) -> dict:
    """
    Create a stream event dict for real-time frontend visualization.
    These are collected in state.stream_events and emitted via the SSE endpoint.
    """
    return {
        "type": event_type,       # "node_start" | "node_progress" | "node_complete" | "node_error"
        "node": node,
        "message": message,
        "timestamp": _now(),
        "data": data or {},
    }


# ── Node 1: Guardrail ──────────────────────────────────────────────────────────

def node_guardrail(state: KYCState) -> dict:
    """
    Security boundary node. Runs inbound_shield to detect prompt injection.
    If blocked, sets security_status="BLOCKED" — the conditional edge will
    then skip all remaining nodes and jump directly to END.
    """
    node_name = "guardrail"
    logs = list(state.get("agent_logs", []))
    events = list(state.get("stream_events", []))

    events.append(_event("node_start", node_name, "🛡️ Initializing security shield — scanning document for injection patterns..."))
    logs.append(_log(node_name, "Starting inbound security scan"))

    try:
        raw_text = state.get("raw_input", "")
        events.append(_event("node_progress", node_name, f"Analyzing {len(raw_text)} characters for {10} injection pattern signatures..."))

        is_safe, reason = inbound_shield(raw_text)

        if is_safe:
            msg = "Document passed security screening — no injection patterns detected"
            logs.append(_log(node_name, msg))
            events.append(_event("node_complete", node_name, "✅ Security shield cleared — document is safe to process", {
                "security_status": "OK",
                "chars_scanned": len(raw_text),
            }))
            return {
                "security_status": "OK",
                "agent_logs": logs,
                "stream_events": events,
            }
        else:
            msg = f"BLOCKED — {reason}"
            logs.append(_log(node_name, msg))
            events.append(_event("node_error", node_name, f"🚫 Security violation detected — document BLOCKED", {
                "security_status": "BLOCKED",
                "reason": reason,
            }))
            return {
                "security_status": "BLOCKED",
                "final_decision": "ESCALATE",
                "audit_summary": f"Document blocked by security guardrail: {reason}",
                "agent_logs": logs,
                "stream_events": events,
            }

    except Exception as exc:
        logger.exception("node_guardrail: unexpected exception")
        events.append(_event("node_error", node_name, f"💥 Guardrail node crashed: {exc}"))
        return {
            "security_status": "BLOCKED",
            "final_decision": "ESCALATE",
            "audit_summary": f"Guardrail node failed with exception: {exc}",
            "agent_logs": logs + [_log(node_name, f"EXCEPTION: {exc}")],
            "stream_events": events,
        }


# ── Node 1.5: OCR Scan ─────────────────────────────────────────────────────────

async def node_ocr(state: KYCState) -> dict:
    """
    Multi-language OCR extraction and bilingual name validation node.
    Only executes if input_type == "image". Otherwise, skips.
    """
    node_name = "ocr"
    logs = list(state.get("agent_logs", []))
    events = list(state.get("stream_events", []))

    input_type = state.get("input_type", "text")
    image_filename = state.get("image_filename", "")

    if input_type != "image":
        events.append(_event("node_complete", node_name, "Skipped — text input detected", {
            "ocr_status": "SKIPPED"
        }))
        return {
            "ocr_text": "",
            "ocr_language_detected": "English",
            "ocr_bilingual_match_status": "SKIPPED",
            "ocr_bilingual_match_score": 1.0,
            "ocr_bilingual_match_rationale": "No image input, skipped OCR",
            "agent_logs": logs + [_log(node_name, "Skipped OCR because input_type is text")],
            "stream_events": events
        }

    events.append(_event("node_start", node_name, f"📷 Activating PaddleOCR engine — scanning {image_filename} for text..."))
    logs.append(_log(node_name, f"Starting OCR scan on image: {image_filename}"))

    try:
        events.append(_event("node_progress", node_name, "⚡ Extracting bilingual text and detecting document layout on AMD GPU..."))
        
        ocr_result = await run_ocr_agent(
            image_filename=image_filename,
            llm_client=llm_client
        )
        
        lang = ocr_result["ocr_language_detected"]
        match_status = ocr_result["bilingual_match_status"]
        score = ocr_result["bilingual_match_score"]
        rationale = ocr_result["bilingual_match_rationale"]
        
        msg = f"OCR complete. Lang: {lang}. Bilingual Cross-Validation: {match_status} (Conf: {score*100:.1f}%)"
        logs.append(_log(node_name, msg))
        logs.append(_log(node_name, f"Bilingual Rationale: {rationale}"))
        
        status_icon = "✅" if match_status == "MATCHED" else "⚠️"
        events.append(_event("node_complete", node_name, f"{status_icon} OCR completed — {lang} text processed", {
            "ocr_status": "COMPLETE",
            "ocr_language_detected": lang,
            "extracted_name": ocr_result["name_english"],
            "bilingual_match_score": score,
            "bilingual_match_status": match_status
        }))
        
        return {
            "raw_input": ocr_result["ocr_text"], 
            "ocr_text": ocr_result["ocr_text"],
            "ocr_language_detected": lang,
            "ocr_bilingual_match_status": match_status,
            "ocr_bilingual_match_score": score,
            "ocr_bilingual_match_rationale": rationale,
            "agent_logs": logs,
            "stream_events": events
        }
    except Exception as exc:
        logger.exception("node_ocr: unexpected exception")
        events.append(_event("node_error", node_name, f"💥 OCR node failed: {exc}"))
        return {
            "ocr_bilingual_match_status": "ERROR",
            "ocr_bilingual_match_score": 0.0,
            "ocr_bilingual_match_rationale": f"OCR execution failed with exception: {exc}",
            "final_decision": "REVIEW", 
            "agent_logs": logs + [_log(node_name, f"EXCEPTION: {exc}")],
            "stream_events": events
        }


# ── Node 2: Extraction ─────────────────────────────────────────────────────────

async def node_extraction(state: KYCState) -> dict:
    """
    LLM-powered document data extraction node.
    Extracts: full_name, date_of_birth, nationality, document_type, document_number.
    """
    node_name = "extraction"
    logs = list(state.get("agent_logs", []))
    events = list(state.get("stream_events", []))

    events.append(_event("node_start", node_name, "🔍 Activating extraction agent — sending document to AMD GPU-accelerated LLM..."))
    logs.append(_log(node_name, "Submitting raw text to LLM for structured extraction"))

    try:
        events.append(_event("node_progress", node_name, "⚡ LLM processing on AMD ROCm GPU — extracting identity fields..."))

        extracted_data, log_msg = await run_extraction_agent(
            raw_text=state.get("raw_input", ""),
            llm_client=llm_client,
        )

        logs.append(_log(node_name, log_msg))

        # Determine if extraction succeeded
        success = extracted_data.get("full_name") != "EXTRACTION_FAILED"
        status = "✅ Fields extracted successfully" if success else "⚠️ Extraction partial — some fields unavailable"

        events.append(_event("node_complete", node_name, status, {
            "fields_extracted": list(extracted_data.keys()),
            "success": success,
            "extracted_name": extracted_data.get("full_name", "UNKNOWN"),
            "doc_type": extracted_data.get("document_type", "UNKNOWN"),
            "nationality": extracted_data.get("nationality", "UNKNOWN"),
        }))

        return {
            "extracted_data": extracted_data,
            "agent_logs": logs,
            "stream_events": events,
        }

    except Exception as exc:
        logger.exception("node_extraction: unexpected exception")
        events.append(_event("node_error", node_name, f"💥 Extraction node failed: {exc}"))
        fallback = {"full_name": "EXTRACTION_FAILED", "date_of_birth": "UNKNOWN",
                    "nationality": "UNKNOWN", "document_type": "UNKNOWN", "document_number": "UNKNOWN"}
        return {
            "extracted_data": fallback,
            "final_decision": "ESCALATE",
            "agent_logs": logs + [_log(node_name, f"EXCEPTION: {exc}")],
            "stream_events": events,
        }


# ── Node 3: Compliance ────────────────────────────────────────────────────────

async def node_compliance(state: KYCState) -> dict:
    """
    Fuzzy watchlist screening node.
    Compares extracted full_name against all sanctioned entity name variants.
    Flags any match ≥ 85% confidence.
    """
    node_name = "compliance"
    logs = list(state.get("agent_logs", []))
    events = list(state.get("stream_events", []))

    events.append(_event("node_start", node_name, "⚖️ Activating compliance engine — loading sanctions watchlists..."))
    logs.append(_log(node_name, "Starting watchlist screening"))

    try:
        name_to_screen = state.get("extracted_data", {}).get("full_name", "UNKNOWN")
        events.append(_event("node_progress", node_name, f"🔎 Running fuzzy matching for '{name_to_screen}' against 5 sanctioned entities (20+ name variants)..."))

        compliance_flags, confidence_score = run_compliance_check(
            extracted_data=state.get("extracted_data", {})
        )

        if compliance_flags:
            highest = max(f["score"] for f in compliance_flags)
            msg = f"ALERT: {len(compliance_flags)} watchlist match(es) found — highest score {highest}%"
            logs.append(_log(node_name, msg))
            events.append(_event("node_complete", node_name, f"🚨 {msg}", {
                "flags_count": len(compliance_flags),
                "confidence_score": confidence_score,
                "highest_match": highest,
                "flags": compliance_flags,
            }))
        else:
            msg = f"Name cleared — no watchlist matches above {85}% threshold"
            logs.append(_log(node_name, msg))
            events.append(_event("node_complete", node_name, f"✅ {msg}", {
                "flags_count": 0,
                "confidence_score": confidence_score,
            }))

        return {
            "compliance_flags": compliance_flags,
            "confidence_score": confidence_score,
            "agent_logs": logs,
            "stream_events": events,
        }

    except Exception as exc:
        logger.exception("node_compliance: unexpected exception")
        events.append(_event("node_error", node_name, f"💥 Compliance node failed: {exc}"))
        return {
            "compliance_flags": [],
            "confidence_score": 0.0,
            "final_decision": "ESCALATE",
            "agent_logs": logs + [_log(node_name, f"EXCEPTION: {exc}")],
            "stream_events": events,
        }


# ── Node 4: Orchestrator ──────────────────────────────────────────────────────

async def node_orchestrator(state: KYCState) -> dict:
    """
    Final LLM decision-making node. Synthesizes all pipeline context
    and returns APPROVE / REVIEW / ESCALATE with a two-sentence rationale.
    """
    node_name = "orchestrator"
    logs = list(state.get("agent_logs", []))
    events = list(state.get("stream_events", []))

    events.append(_event("node_start", node_name, "🧠 Orchestrator reasoning — synthesizing full case context for final decision..."))
    logs.append(_log(node_name, "Composing final compliance decision"))

    try:
        flags = state.get("compliance_flags", [])
        score = state.get("confidence_score", 0.0)
        events.append(_event("node_progress", node_name,
            f"📊 Weighing {len(flags)} compliance flag(s) with {score:.1%} confidence score — querying LLM for decision..."))

        decision, rationale = await run_orchestrator(
            state=dict(state),
            llm_client=llm_client,
        )

        # Build human-readable audit summary
        audit_summary = (
            f"Case {state.get('case_id', 'UNKNOWN')} | "
            f"Decision: {decision} | "
            f"Confidence: {score:.2%} | "
            f"Flags: {len(flags)} | "
            f"Rationale: {rationale}"
        )

        logs.append(_log(node_name, f"Decision rendered: {decision}"))
        events.append(_event("node_complete", node_name, f"{'✅' if decision == 'APPROVE' else '🟡' if decision == 'REVIEW' else '🔴'} Final decision: {decision}", {
            "decision": decision,
            "rationale": rationale,
            "confidence_score": score,
        }))

        return {
            "final_decision": decision,
            "audit_summary": audit_summary,
            "agent_logs": logs,
            "stream_events": events,
        }

    except Exception as exc:
        logger.exception("node_orchestrator: unexpected exception")
        events.append(_event("node_error", node_name, f"💥 Orchestrator failed: {exc}"))
        return {
            "final_decision": "ESCALATE",
            "audit_summary": f"Orchestrator node failed: {exc}. Case auto-escalated.",
            "agent_logs": logs + [_log(node_name, f"EXCEPTION: {exc}")],
            "stream_events": events,
        }


# ── Node 5: Sanitizer ────────────────────────────────────────────────────────

async def node_sanitizer(state: KYCState) -> dict:
    """
    Outbound PII masking node. Runs outbound_sanitizer on extracted_data
    to redact document numbers, SSNs, and other PII before the response
    leaves the system.
    """
    node_name = "sanitizer"
    logs = list(state.get("agent_logs", []))
    events = list(state.get("stream_events", []))

    events.append(_event("node_start", node_name, "🔒 Running outbound PII sanitizer — masking sensitive identifiers..."))
    logs.append(_log(node_name, "Applying outbound PII masking to extracted data"))

    try:
        raw_extracted = state.get("extracted_data", {})
        sanitized = outbound_sanitizer(raw_extracted)

        # Count how many fields were masked
        masked_fields = [
            k for k, v in sanitized.items()
            if isinstance(v, str) and "REDACTED" in v
        ]

        msg = f"PII sanitization complete — {len(masked_fields)} field(s) masked: {masked_fields or 'none'}"
        logs.append(_log(node_name, msg))
        events.append(_event("node_complete", node_name, f"✅ {msg}", {
            "masked_fields": masked_fields,
            "sanitized_data": sanitized,
            "final_decision": state.get("final_decision"),
        }))

        return {
            "extracted_data": sanitized,
            "agent_logs": logs,
            "stream_events": events,
        }

    except Exception as exc:
        logger.exception("node_sanitizer: unexpected exception")
        events.append(_event("node_error", node_name, f"💥 Sanitizer failed: {exc}"))
        return {
            "agent_logs": logs + [_log(node_name, f"EXCEPTION: {exc}")],
            "stream_events": events,
        }
