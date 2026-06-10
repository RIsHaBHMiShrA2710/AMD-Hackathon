# AegisKYC — Agentic KYC Intelligence Platform

You are an expert software architecture agent. We are building **"AegisKYC"**, an Agentic KYC Intelligence Platform for a high-stakes AMD hackathon. You must generate the complete, working prototype code using the strict project structure, tech stack, and rules below. Do not install unnecessary or optional third-party packages. Ensure every file contains thorough inline comments explaining core logic for debugging purposes.

---

## 1. PROJECT OVERVIEW & TECH STACK

- **Goal:** An end-to-end multi-agent KYC validation system built on a LangGraph state machine. The system ingests document text, extracts structured data, matches against custom watchlists with fuzzy logic, enforces security guardrails, and delivers an explainable, auditable compliance decision via a FastAPI backend.
- **Backend Stack:** Python 3.10+, FastAPI, Uvicorn, Pydantic v2, LangGraph, LangChain, FuzzyWuzzy, EasyOCR (for basic image processing), Python-Levenshtein.
- **LLM Connectivity:** Build a standard OpenAI-compatible async client pointing to a local inference engine (simulating an AMD ROCm vLLM server at `http://localhost:8000/v1`). All LLM calls must be async.
- **Frontend Stack:** React (Vite-configured), Tailwind CSS for a minimal, scannable compliance dashboard.
- **AMD Advantage:** The vLLM inference server is explicitly configured to target AMD ROCm GPU acceleration. Benchmark and display CPU vs GPU throughput in the dashboard.

---

## 2. STRICT DIRECTORY STRUCTURE

Create and populate the following folder structure exactly:

```
aegis-kyc-platform/
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   ├── core/
│   │   ├── __init__.py
│   │   ├── llm_client.py
│   │   ├── state.py
│   │   └── guardrails.py
│   ├── graph/
│   │   ├── __init__.py
│   │   ├── kyc_graph.py
│   │   └── nodes.py
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── extraction_agent.py
│   │   ├── compliance_agent.py
│   │   └── orchestrator.py
│   └── mock_data/
│       └── watchlists.json
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        └── components/
            ├── UploadPanel.jsx
            ├── ProgressTracker.jsx
            └── AuditReport.jsx
```

---

## 3. BACKEND SPECIFICATIONS (PYTHON)

- **mock_data/watchlists.json:** Create a list of 5 mock sanctioned entities. Each entry must contain: `id`, `names` (list of name variations), `risk_tier` (HIGH / MEDIUM), and `country`.

- **backend/core/state.py:** Define a strict Pydantic v2 model `KYCState` as a `TypedDict` compatible with LangGraph. Fields: `case_id` (str), `raw_input` (str), `extracted_data` (dict), `compliance_flags` (list), `confidence_score` (float), `security_status` (str), `final_decision` (str), `audit_summary` (str), and `agent_logs` (list of str for real-time step tracking).

- **backend/core/llm_client.py:** Build a single async OpenAI-compatible client class `LLMClient` pointing to `http://localhost:8000/v1`. Expose one method: `async def complete(system_prompt, user_prompt) -> str`. Handle timeouts and connection errors gracefully with a fallback message.

- **backend/core/guardrails.py:** Implement two functions:
  - `inbound_shield(text: str) -> tuple[bool, str]`: Scan for prompt injection patterns (e.g., "ignore previous instructions", "disregard", "system prompt"). Return `(False, reason)` if triggered.
  - `outbound_sanitizer(data: dict) -> dict`: Mask standard PII patterns — tax IDs, passport numbers, and full serial numbers — using regex before any data leaves the system.

- **backend/agents/extraction_agent.py:** Accept raw text input and use the `LLMClient` with an explicit JSON-structuring prompt to extract structured fields: `full_name`, `date_of_birth`, `nationality`, `document_type`, `document_number`. Validate output against a Pydantic schema before returning.

- **backend/agents/compliance_agent.py:** Accept `extracted_data` and load `watchlists.json`. Use `fuzzywuzzy.process.extractBests` to compare the extracted `full_name` against all watchlist name variations. Flag any match scoring above **85% confidence**. Return a list of `compliance_flags` and a computed `confidence_score`.

- **backend/agents/orchestrator.py:** Accept the full populated `KYCState`. Compose a structured contextual payload and submit it to the `LLMClient`. Prompt the LLM to return a JSON object with two keys: `decision` (one of: `APPROVE`, `REVIEW`, `ESCALATE`) and `rationale` (exactly two sentences). Parse and validate the LLM response before returning.

- **backend/graph/nodes.py:** Wrap each agent as a standalone LangGraph node function. Each node must:
  - Accept and return the full `KYCState`.
  - Append a timestamped log entry to `agent_logs` describing its action and outcome.
  - Handle exceptions internally and set `final_decision` to `ESCALATE` on failure.

  Nodes to implement: `node_guardrail`, `node_extraction`, `node_compliance`, `node_orchestrator`, `node_sanitizer`.

- **backend/graph/kyc_graph.py:** Assemble the LangGraph `StateGraph` using `KYCState`. Define the following workflow:
  - **Linear edges:** `guardrail → extraction → compliance → orchestrator → sanitizer → END`
  - **Conditional edge after `node_guardrail`:** If `security_status == "BLOCKED"`, skip directly to `END`. Otherwise proceed to `extraction`.
  - **Conditional edge after `node_compliance`:** If `confidence_score > 0.95`, skip `orchestrator` and set `final_decision = "ESCALATE"` immediately.
  - Compile the graph with `checkpointer=None` (stateless per request). Export a `build_kyc_graph()` factory function and a `get_graph_diagram() -> str` helper that returns a Mermaid diagram string for the `/api/workflow/diagram` endpoint.

- **backend/app.py:** Build a FastAPI application with the following routes:
  - `POST /api/kyc/process` — Synchronous processing. Accepts `{ document_text: str }`. Initialises a fresh `KYCState`, invokes the compiled graph, and returns the full final state as a `KYCResponse` Pydantic model.
  - `POST /api/kyc/stream` — Streaming processing. Uses `graph.astream()` to yield NDJSON events per node step, enabling the frontend progress tracker to update in real time.
  - `GET /api/workflow/diagram` — Returns the Mermaid diagram string of the LangGraph workflow for live visualisation in the dashboard.
  - All routes must include CORS middleware configured for `http://localhost:5173`.

---

## 4. FRONTEND SPECIFICATIONS (REACT)

Generate a single-page React application with Tailwind CSS that consumes the streaming API endpoint:

- **UploadPanel.jsx:** A text area and file upload button. On submit, POST to `/api/kyc/stream` and open an NDJSON stream reader.
- **ProgressTracker.jsx:** A live step-by-step panel that renders each `agent_logs` entry as it arrives from the stream. Each step displays its node name, log message, and a status icon (spinner while active, tick when done).
- **AuditReport.jsx:** Rendered once the stream completes. Display the final `decision`, `confidence_score`, `compliance_flags`, `audit_summary`, and masked `extracted_data` in a two-column layout. Use high-contrast colour coding: **Green** for `APPROVE`, **Amber** for `REVIEW`, **Red** for `ESCALATE`.
- **WorkflowDiagram.jsx:** Fetch from `GET /api/workflow/diagram` and render the Mermaid graph using the `mermaid` JS library so judges can see the live agent workflow.

---

## 5. EXECUTION & VERIFICATION PROTOCOL

1. Write all configuration and code files strictly following the directory structure above.
2. Install all backend dependencies from `requirements.txt` into a Python virtual environment.
3. Self-test the full graph pipeline by invoking `kyc_graph` directly with a mock `KYCState` payload and assert that: (a) all five nodes execute in order, (b) `agent_logs` contains exactly five entries, and (c) `final_decision` is one of `APPROVE`, `REVIEW`, or `ESCALATE`.
4. Verify the FastAPI server starts without errors on `uvicorn backend.app:app --port 8001`.
5. Verify the React dev server starts without errors on `npm run dev` from the `frontend/` directory.

---

## 6. REQUIREMENTS.TXT

```
fastapi==0.104.0
uvicorn==0.24.0
pydantic==2.5.0
langgraph==0.1.0
langchain==0.1.16
langchain-openai==0.1.3
httpx==0.26.0
fuzzywuzzy==0.18.0
python-Levenshtein==0.25.0
easyocr==1.7.1
python-multipart==0.0.9
python-dotenv==1.0.0
```
