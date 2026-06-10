"""
AegisKYC — LangGraph State Machine Assembly
=============================================
Assembles the KYC processing pipeline as a LangGraph StateGraph.

Workflow:
  START → guardrail → [conditional] → extraction → compliance → [conditional]
        → orchestrator → sanitizer → END

Conditional edges:
  1. After guardrail: if security_status == "BLOCKED" → END (skip all agents)
  2. After compliance: if confidence_score > 0.95 → sanitizer (skip orchestrator,
     auto-set ESCALATE — too risky to allow LLM to potentially approve)

All nodes are async (FastAPI + asyncio compatible).
"""

import logging
from typing import Literal

from langgraph.graph import StateGraph, END, START

from core.state import KYCState
from graph.nodes import (
    node_guardrail,
    node_extraction,
    node_compliance,
    node_orchestrator,
    node_sanitizer,
)

logger = logging.getLogger(__name__)

# ── Confidence threshold for auto-escalation (bypasses orchestrator) ──────────
AUTO_ESCALATE_THRESHOLD = 0.95


# ── Conditional Edge Functions ────────────────────────────────────────────────

def route_after_guardrail(state: KYCState) -> Literal["extraction", "__end__"]:
    """
    After the guardrail node:
      - BLOCKED → jump to END immediately (document rejected)
      - OK      → continue to extraction
    """
    if state.get("security_status") == "BLOCKED":
        logger.info("Graph router: guardrail BLOCKED — jumping to END")
        return END
    logger.info("Graph router: guardrail OK — proceeding to extraction")
    return "extraction"


def route_after_compliance(state: KYCState) -> Literal["orchestrator", "sanitizer"]:
    """
    After the compliance node:
      - confidence_score > 0.95 → auto-ESCALATE, skip orchestrator, go to sanitizer
      - otherwise               → normal path through orchestrator
    """
    score = state.get("confidence_score", 0.0)
    if score > AUTO_ESCALATE_THRESHOLD:
        logger.warning(
            "Graph router: confidence_score=%.4f > %.2f — auto-ESCALATING, bypassing orchestrator",
            score, AUTO_ESCALATE_THRESHOLD,
        )
        return "sanitizer"
    return "orchestrator"


# ── Graph Builder ──────────────────────────────────────────────────────────────

def build_kyc_graph() -> StateGraph:
    """
    Factory function that constructs and compiles the KYC LangGraph StateGraph.

    Returns a compiled graph ready for .invoke() or .astream() calls.
    Each call to this factory creates a fresh, stateless graph instance
    (checkpointer=None means no state persistence between invocations).
    """
    # Initialise the state graph with KYCState as the schema
    builder = StateGraph(KYCState)

    # ── Register all node functions ────────────────────────────────────────────
    builder.add_node("guardrail", node_guardrail)
    builder.add_node("extraction", node_extraction)
    builder.add_node("compliance", node_compliance)
    builder.add_node("orchestrator", node_orchestrator)
    builder.add_node("sanitizer", node_sanitizer)

    # ── Wire the graph edges ───────────────────────────────────────────────────

    # Entry point
    builder.add_edge(START, "guardrail")

    # Conditional edge after guardrail (BLOCKED → END, OK → extraction)
    builder.add_conditional_edges(
        "guardrail",
        route_after_guardrail,
        {"extraction": "extraction", END: END},
    )

    # Linear edges: extraction → compliance
    builder.add_edge("extraction", "compliance")

    # Conditional edge after compliance (high confidence → skip orchestrator)
    builder.add_conditional_edges(
        "compliance",
        route_after_compliance,
        {"orchestrator": "orchestrator", "sanitizer": "sanitizer"},
    )

    # Linear edges: orchestrator → sanitizer → END
    builder.add_edge("orchestrator", "sanitizer")
    builder.add_edge("sanitizer", END)

    # Compile with no checkpointer (stateless per-request)
    compiled = builder.compile()
    logger.info("KYC graph compiled successfully")
    return compiled


# ── Mermaid Diagram Generator ─────────────────────────────────────────────────

def get_graph_diagram() -> str:
    """
    Returns a Mermaid diagram string describing the KYC agent workflow.
    Used by the GET /api/workflow/diagram endpoint so the frontend can
    render a live visual graph for hackathon judges.
    """
    return """flowchart TD
    START([🚀 START]) --> G

    G["🛡️ node_guardrail\\nPrompt Injection Shield"]
    G -- "security_status = BLOCKED" --> BLOCKED_END([🚫 END\\nDocument Rejected])
    G -- "security_status = OK" --> E

    E["🔍 node_extraction\\nLLM Field Extractor\\n(AMD GPU)"]
    E --> C

    C["⚖️ node_compliance\\nFuzzyWuzzy Watchlist Screener"]
    C -- "confidence > 0.95\\n(AUTO-ESCALATE)" --> S_AUTO["🔒 node_sanitizer\\nPII Masker\\n[decision=ESCALATE]"]
    C -- "confidence ≤ 0.95" --> O

    O["🧠 node_orchestrator\\nLLM Decision Reasoner\\n(AMD GPU)"]
    O --> S

    S["🔒 node_sanitizer\\nOutbound PII Masker"]
    S_AUTO --> FINAL_END([✅ END\\nCase Complete])
    S --> FINAL_END

    style START fill:#1a1a2e,stroke:#4a90d9,color:#fff
    style G fill:#2d1b69,stroke:#7c5cbf,color:#fff
    style E fill:#1a3a5c,stroke:#4a90d9,color:#fff
    style C fill:#2d2d00,stroke:#d4a017,color:#fff
    style O fill:#1a3a1a,stroke:#4caf50,color:#fff
    style S fill:#3a1a1a,stroke:#f44336,color:#fff
    style S_AUTO fill:#3a1a1a,stroke:#f44336,color:#fff
    style BLOCKED_END fill:#4a0000,stroke:#f44336,color:#fff
    style FINAL_END fill:#0a3a0a,stroke:#4caf50,color:#fff"""
