"""
AegisKYC — FastAPI Application
================================
Main API server exposing endpoints for KYC processing.
In AMD AI Notebook pod mode, also serves the built React frontend
as static files so the entire app runs from a single port (8001).

Endpoints:
  POST /api/kyc/process      — Synchronous KYC processing
  POST /api/kyc/stream       — Streaming NDJSON KYC processing
  GET  /api/workflow/diagram — Mermaid diagram of the LangGraph workflow
  GET  /api/health           — Health check
  GET  /*                    — React frontend (static, production build)
"""

import asyncio
import json
import logging
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from core.state import KYCState
from core.llm_client import llm_client, VLLM_BASE_URL, DEFAULT_MODEL
from graph.kyc_graph import build_kyc_graph, get_graph_diagram

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ── Static frontend path ───────────────────────────────────────────────────────
# When running in AMD pod, the React app is built first then served from here.
# Path: aegis-kyc-platform/frontend/dist  (relative to this file's directory)
_BACKEND_DIR = Path(__file__).parent
_FRONTEND_DIST = _BACKEND_DIR.parent / "frontend" / "dist"
_SERVE_FRONTEND = _FRONTEND_DIST.exists()


# ── Lifespan ───────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Build the LangGraph graph once at startup, close LLM client on shutdown."""
    logger.info("AegisKYC: Building LangGraph state machine...")
    app.state.kyc_graph = build_kyc_graph()
    logger.info("AegisKYC: Graph ready.")
    logger.info("AegisKYC: LLM endpoint = %s | model = %s", VLLM_BASE_URL, DEFAULT_MODEL)
    if _SERVE_FRONTEND:
        logger.info("AegisKYC: Serving React frontend from %s", _FRONTEND_DIST)
    else:
        logger.info("AegisKYC: No built frontend found — API-only mode (run 'npm run build' in frontend/)")
    yield
    await llm_client.aclose()
    logger.info("AegisKYC: Shutdown complete.")


# ── FastAPI App ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="AegisKYC API",
    description="Agentic KYC Intelligence Platform — AMD ROCm Hackathon",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS — allow local Vite dev server + wildcard for Jupyter proxy URLs
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Jupyter proxy generates dynamic origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response Models ──────────────────────────────────────────────────

class KYCRequest(BaseModel):
    document_text: str = Field(
        ...,
        min_length=10,
        description="Raw document text to process (passport, ID card, etc.)",
        examples=["Passport No: P1234567. Name: John Doe. Born: 1985-03-15. Nationality: British."],
    )


class KYCResponse(BaseModel):
    case_id: str
    final_decision: str
    confidence_score: float
    extracted_data: dict
    compliance_flags: list
    audit_summary: str
    security_status: str
    agent_logs: list[str]
    stream_events: list[dict]


# ── Helper ─────────────────────────────────────────────────────────────────────

def _initial_state(document_text: str) -> KYCState:
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


# ── POST /api/kyc/process ──────────────────────────────────────────────────────

@app.post("/api/kyc/process", response_model=KYCResponse, tags=["KYC"])
async def process_kyc(request: KYCRequest):
    """
    Synchronous KYC processing. Runs the full LangGraph pipeline and returns
    the complete final state in one response.
    """
    logger.info("POST /api/kyc/process — starting new case")
    initial_state = _initial_state(request.document_text)
    try:
        final_state = await app.state.kyc_graph.ainvoke(initial_state)
        logger.info("Case %s: decision=%s", final_state["case_id"], final_state["final_decision"])
        return KYCResponse(**final_state)
    except Exception as exc:
        logger.exception("KYC processing failed")
        raise HTTPException(status_code=500, detail=f"KYC processing error: {exc}")


# ── POST /api/kyc/stream ───────────────────────────────────────────────────────

@app.post("/api/kyc/stream", tags=["KYC"])
async def stream_kyc(request: KYCRequest):
    """
    Streaming KYC processing. Returns NDJSON events as each agent node executes.
    The frontend Live Pipeline Monitor reads this stream in real time.

    Event types:
      case_start | node_start | node_progress | node_complete | node_error
      pipeline_complete | pipeline_error
    """
    initial_state = _initial_state(request.document_text)
    case_id = initial_state["case_id"]
    logger.info("POST /api/kyc/stream — case %s", case_id)

    async def event_generator() -> AsyncIterator[str]:
        # Announce start
        yield json.dumps({
            "type": "case_start",
            "case_id": case_id,
            "message": f"AegisKYC pipeline initiated — Case ID: {case_id}",
        }) + "\n"

        last_known_events: list[dict] = []

        try:
            # Stream state snapshots as each node completes
            async for state_snapshot in app.state.kyc_graph.astream(initial_state):
                for node_name, partial_state in state_snapshot.items():
                    if not isinstance(partial_state, dict):
                        continue
                    new_events = partial_state.get("stream_events", [])
                    for event in new_events:
                        if event not in last_known_events:
                            last_known_events.append(event)
                            yield json.dumps(event) + "\n"
                    await asyncio.sleep(0)  # yield to event loop

            # Run again to get the complete merged final state
            final_state = await app.state.kyc_graph.ainvoke(initial_state)

            yield json.dumps({
                "type": "pipeline_complete",
                "case_id": case_id,
                "message": f"Pipeline complete — Decision: {final_state.get('final_decision')}",
                "final_state": {
                    "case_id":          final_state.get("case_id"),
                    "final_decision":   final_state.get("final_decision"),
                    "confidence_score": final_state.get("confidence_score"),
                    "extracted_data":   final_state.get("extracted_data"),
                    "compliance_flags": final_state.get("compliance_flags"),
                    "audit_summary":    final_state.get("audit_summary"),
                    "security_status":  final_state.get("security_status"),
                    "agent_logs":       final_state.get("agent_logs"),
                },
            }) + "\n"

        except Exception as exc:
            logger.exception("Streaming pipeline error for case %s", case_id)
            yield json.dumps({
                "type": "pipeline_error",
                "case_id": case_id,
                "error": str(exc),
                "message": f"Pipeline failed: {exc}",
            }) + "\n"

    return StreamingResponse(
        event_generator(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── GET /api/workflow/diagram ──────────────────────────────────────────────────

@app.get("/api/workflow/diagram", tags=["Workflow"])
async def get_workflow_diagram():
    return {"diagram": get_graph_diagram()}


# ── GET /api/health ────────────────────────────────────────────────────────────

@app.get("/api/health", tags=["System"])
async def health_check():
    return {
        "status": "healthy",
        "service": "AegisKYC",
        "graph_ready": hasattr(app.state, "kyc_graph"),
        "llm_endpoint": VLLM_BASE_URL,
        "llm_model": DEFAULT_MODEL,
        "frontend_served": _SERVE_FRONTEND,
        "frontend_path": str(_FRONTEND_DIST) if _SERVE_FRONTEND else None,
    }


# ── Static Frontend (production mode — AMD pod) ────────────────────────────────
# Mount AFTER all /api routes so API routes take priority.
# Serves the built React app at everything that isn't /api/*.
# In dev mode (no dist/ folder), this block is skipped entirely.

if _SERVE_FRONTEND:
    # Serve Vite's built assets (JS, CSS, images)
    app.mount(
        "/assets",
        StaticFiles(directory=str(_FRONTEND_DIST / "assets")),
        name="assets",
    )

    # Catch-all: serve index.html for all non-API routes (React Router support)
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        """
        Serve the React SPA for any non-API route.
        React Router handles client-side navigation.
        """
        index = _FRONTEND_DIST / "index.html"
        if index.exists():
            return FileResponse(str(index))
        return {"error": "Frontend not built. Run: cd frontend && npm run build"}


# ── Dev entrypoint ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8001, reload=False)
