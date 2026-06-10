"""
AegisKYC — KYC State Definition
================================
Defines the central KYCState TypedDict that flows through the entire LangGraph
state machine. Every node reads from and writes back to this single shared state
object, making the pipeline fully traceable and auditable.
"""

from typing import TypedDict, Any


class KYCState(TypedDict):
    """
    Central state object passed between all LangGraph nodes.
    TypedDict is required by LangGraph for type-safe state management.
    """

    # Unique identifier for this KYC case (UUID generated at request time)
    case_id: str

    # The raw document text submitted by the user (passport, ID card, etc.)
    raw_input: str

    # Structured data extracted by the extraction agent
    # Keys: full_name, date_of_birth, nationality, document_type, document_number
    extracted_data: dict[str, Any]

    # List of compliance flag dicts from the watchlist matching step
    # Each flag: { watchlist_id, matched_name, score, risk_tier }
    compliance_flags: list[dict]

    # Aggregate confidence score (0.0–1.0) from fuzzy matching
    # Used by conditional edge: if > 0.95 → auto-ESCALATE
    confidence_score: float

    # Set by guardrail node: "OK" or "BLOCKED"
    security_status: str

    # Final compliance decision: "APPROVE" | "REVIEW" | "ESCALATE"
    final_decision: str

    # Human-readable summary produced by the orchestrator LLM
    audit_summary: str

    # Timestamped log entries appended by each node as it executes
    # These are streamed to the frontend in real time
    agent_logs: list[str]

    # Real-time processing events for frontend live pipeline view
    # Each event: { type, node, message, timestamp, data? }
    stream_events: list[dict]
