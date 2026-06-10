"""
AegisKYC — FastAPI Application
================================
Main API server exposing three endpoints:
  POST /api/kyc/process   — Synchronous KYC processing (full state in one response)
  POST /api/kyc/stream    — Streaming KYC processing (NDJSON events per agent step)
  GET  /api/workflow/diagram — Mermaid diagram of the LangGraph workflow

Architecture notes:
  - The compiled LangGraph is built once at startup and reused across requests
  - Streaming uses Server-Sent Events (SSE) via StreamingResponse
  - Each stream event is a JSON line describing one pipeline step in real time
  - CORS is configured for the Vite dev server at localhost:5173
"""

import asyncio
import json
import logging
import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from core.state import KYCState
from core.llm_client import llm_client
from graph.kyc_graph import build_kyc_graph, get_graph_diagram

# ── Logging Configuration ──────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan: Build graph once at startup ─────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Build and cache the compiled KYC graph at application startup."""
    logger.info("AegisKYC: Building LangGraph state machine...")
    app.state.kyc_graph = build_kyc_graph()
    logger.info("AegisKYC: Graph ready. Starting server.")
    yield
    # Shutdown: close the LLM client's HTTP connection pool
    await llm_client.aclose()
    logger.info("AegisKYC: LLM client closed. Shutdown complete.")


# ── FastAPI App ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="AegisKYC API",
    description="Agentic KYC Intelligence Platform — AMD ROCm Hackathon",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: allow the Vite React frontend to call this API during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response Models ─────────────────────────────────────────────────

class KYCRequest(BaseModel):
    """Incoming KYC processing request."""
    document_text: str = Field(
        ...,
        min_length=10,
        description="Raw document text to process (passport, ID card, etc.)",
        examples=["Passport No: P1234567. Name: John Doe. Born: 1985-03-15. Nationality: British."],
    )


class KYCResponse(BaseModel):
    """Full KYC processing result returned by the synchronous endpoint."""
    case_id: str
    final_decision: str
    confidence_score: float
    extracted_data: dict
    compliance_flags: list
    audit_summary: str
    security_status: str
    agent_logs: list[str]
    stream_events: list[dict]


# ── Helper: Build initial KYCState ────────────────────────────────────────────

def _initial_state(document_text: str) -> KYCState:
    """Create a fresh KYCState for a new case."""
    return KYCState(
        case_id=str(uuid.uuid4()),
        raw_input=document_text,
        extracted_data={},
        compliance_flags=[],
        confidence_score=0.0,
        security_status="PENDING",
        final_decision="PENDING",
        audit_summary="",
        agent_logs=[],
        stream_events=[],
    )


# ── POST /api/kyc/process ─────────────────────────────────────────────────────

@app.post("/api/kyc/process", response_model=KYCResponse, tags=["KYC"])
async def process_kyc(request: KYCRequest):
    """
    Synchronous KYC processing endpoint.
    Runs the full LangGraph pipeline and returns the complete final state.
    Use this for simple integrations that don't need real-time streaming.
    """
    logger.info("POST /api/kyc/process — starting new case")
    initial_state = _initial_state(request.document_text)

    try:
        # ainvoke runs the full graph asynchronously and returns the final state
        final_state = await app.state.kyc_graph.ainvoke(initial_state)
        logger.info("Case %s completed: decision=%s", final_state["case_id"], final_state["final_decision"])
        return KYCResponse(**final_state)

    except Exception as exc:
        logger.exception("KYC processing failed for case")
        raise HTTPException(status_code=500, detail=f"KYC processing error: {exc}")


# ── POST /api/kyc/stream ──────────────────────────────────────────────────────

@app.post("/api/kyc/stream", tags=["KYC"])
async def stream_kyc(request: KYCRequest):
    """
    Streaming KYC processing endpoint.
    Returns NDJSON (newline-delimited JSON) events as each agent node executes.
    The frontend reads this stream to update the live pipeline visualization.

    Event types emitted:
      - {"type": "case_start", "case_id": "...", "message": "..."}
      - {"type": "node_start", "node": "...", "message": "..."}
      - {"type": "node_progress", "node": "...", "message": "..."}
      - {"type": "node_complete", "node": "...", "data": {...}}
      - {"type": "node_error", "node": "...", "message": "..."}
      - {"type": "pipeline_complete", "final_state": {...}}
      - {"type": "pipeline_error", "error": "..."}
    """
    initial_state = _initial_state(request.document_text)
    case_id = initial_state["case_id"]
    logger.info("POST /api/kyc/stream — case %s starting", case_id)

    async def event_generator() -> AsyncIterator[str]:
        """
        Generator that yields NDJSON lines.
        Runs the graph via astream_events (LangGraph ≥0.2) which emits
        fine-grained events per node rather than only per state snapshot.
        """
        # ── Announce case start ────────────────────────────────────────────────
        yield json.dumps({
            "type": "case_start",
            "case_id": case_id,
            "message": f"🚀 AegisKYC pipeline initiated — Case ID: {case_id}",
            "timestamp": initial_state.get("agent_logs", [None])[0] if initial_state.get("agent_logs") else None,
        }) + "\n"

        # Track which nodes we've already announced to deduplicate events
        announced_nodes: set[str] = set()
        last_known_events: list[dict] = []

        try:
            # astream yields state snapshots after each node completes
            async for state_snapshot in app.state.kyc_graph.astream(initial_state):
                # state_snapshot is a dict: { node_name: partial_state_update }
                for node_name, partial_state in state_snapshot.items():
                    if not isinstance(partial_state, dict):
                        continue

                    # Emit any new stream_events that arrived in this snapshot
                    new_events = partial_state.get("stream_events", [])
                    for event in new_events:
                        if event not in last_known_events:
                            last_known_events.append(event)
                            yield json.dumps(event) + "\n"

                    # Small yield to let the event loop breathe and flush to client
                    await asyncio.sleep(0)

            # ── Retrieve final state (run sync to get completed state) ──────────
            final_state = await app.state.kyc_graph.ainvoke(initial_state)

            yield json.dumps({
                "type": "pipeline_complete",
                "case_id": case_id,
                "message": f"✅ Pipeline complete — Decision: {final_state.get('final_decision')}",
                "final_state": {
                    "case_id": final_state.get("case_id"),
                    "final_decision": final_state.get("final_decision"),
                    "confidence_score": final_state.get("confidence_score"),
                    "extracted_data": final_state.get("extracted_data"),
                    "compliance_flags": final_state.get("compliance_flags"),
                    "audit_summary": final_state.get("audit_summary"),
                    "security_status": final_state.get("security_status"),
                    "agent_logs": final_state.get("agent_logs"),
                },
            }) + "\n"

        except Exception as exc:
            logger.exception("Streaming pipeline error for case %s", case_id)
            yield json.dumps({
                "type": "pipeline_error",
                "case_id": case_id,
                "error": str(exc),
                "message": f"💥 Pipeline failed: {exc}",
            }) + "\n"

    return StreamingResponse(
        event_generator(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable Nginx buffering for streaming
        },
    )


# ── GET /api/workflow/diagram ─────────────────────────────────────────────────

@app.get("/api/workflow/diagram", tags=["Workflow"])
async def get_workflow_diagram():
    """
    Returns the Mermaid diagram string for the KYC LangGraph workflow.
    The frontend WorkflowDiagram component fetches this and renders it
    using the mermaid.js library.
    """
    return {"diagram": get_graph_diagram()}


# ── GET /api/health ───────────────────────────────────────────────────────────

@app.get("/api/health", tags=["System"])
async def health_check():
    """Health check endpoint — verifies the API and graph are ready."""
    return {
        "status": "healthy",
        "service": "AegisKYC",
        "graph_ready": hasattr(app.state, "kyc_graph"),
        "llm_endpoint": "http://localhost:8000/v1",
    }


# ── Dev entrypoint ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8001, reload=True)
