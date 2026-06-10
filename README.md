<div align="center">

<img src="https://img.shields.io/badge/AMD-ROCm%20GPU-ED1C24?style=for-the-badge&logo=amd&logoColor=white" />
<img src="https://img.shields.io/badge/LangGraph-Multi--Agent-4A90D9?style=for-the-badge&logo=python&logoColor=white" />
<img src="https://img.shields.io/badge/FastAPI-0.136-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
<img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
<img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />

# ⚔️ AegisKYC
### Agentic KYC Intelligence Platform

**A production-grade, multi-agent AI system for end-to-end Know Your Customer (KYC) compliance verification — powered by AMD ROCm GPU-accelerated vLLM inference and a LangGraph state machine.**

*Built for the AMD AI Hackathon 2026*

[Live Demo](#-getting-started) · [Architecture](#-system-architecture) · [API Docs](#-api-reference) · [Frontend](#-frontend-dashboard)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [AMD GPU Advantage](#-amd-gpu-advantage)
- [System Architecture](#-system-architecture)
- [Agent Pipeline](#-agent-pipeline)
- [Project Structure](#-project-structure)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Configuration](#-configuration)
- [API Reference](#-api-reference)
- [Frontend Dashboard](#-frontend-dashboard)
- [Security Model](#-security-model)
- [Self-Test & Verification](#-self-test--verification)
- [Roadmap](#-roadmap)

---

## 🎯 Overview

**AegisKYC** is an end-to-end, explainable KYC (Know Your Customer) compliance system that orchestrates five specialized AI agents through a deterministic LangGraph state machine. It ingests raw identity document text, extracts structured fields via an LLM, screens against sanctions watchlists using fuzzy logic, applies security guardrails, and delivers an auditable compliance decision with a full reasoning trail.

### Key Capabilities

| Feature | Description |
|---------|-------------|
| 🤖 **Multi-Agent Pipeline** | 5 specialized agents: Guardrail → Extraction → Compliance → Orchestrator → Sanitizer |
| ⚡ **AMD GPU Inference** | vLLM server targets AMD ROCm for accelerated LLM calls |
| 📡 **Real-time Streaming** | NDJSON event stream shows every agent step live in the browser |
| ⚖️ **Fuzzy Watchlist Matching** | FuzzyWuzzy `token_sort_ratio` handles name variations, word reorders, typos |
| 🛡️ **Security Guardrails** | Inbound prompt injection shield + outbound PII masking |
| 📊 **Explainable AI** | Every decision includes timestamped agent logs, rationale, and confidence score |
| 🗺️ **Live Workflow Diagram** | Mermaid graph of the LangGraph pipeline rendered from the live backend |

---

## ⚡ AMD GPU Advantage

AegisKYC is explicitly designed to showcase AMD ROCm GPU acceleration:

```
┌─────────────────────────────────────────────────────────┐
│              AMD ROCm Inference Stack                    │
│                                                         │
│  vLLM Server (port 8000)                               │
│  ├── Backend: AMD ROCm (HIP) GPU Runtime               │
│  ├── Model: meta-llama/Llama-3.1-8B-Instruct           │
│  ├── Endpoint: OpenAI-compatible /v1/chat/completions  │
│  └── Concurrent async requests via httpx               │
│                                                         │
│  LLM Nodes using GPU:                                  │
│  ├── node_extraction  → Field extraction from docs     │
│  └── node_orchestrator → Final compliance decision     │
└─────────────────────────────────────────────────────────┘
```

**Starting the AMD vLLM server:**
```bash
# Requires AMD GPU with ROCm drivers installed
pip install vllm
vllm serve meta-llama/Llama-3.1-8B-Instruct \
  --port 8000 \
  --dtype float16 \
  --gpu-memory-utilization 0.90
```

> **Fallback mode:** If no vLLM server is running, AegisKYC gracefully falls back — all 5 agents still execute, FuzzyWuzzy screening still runs, and LLM-dependent nodes safely default to `ESCALATE` for human review.

---

## 🏗️ System Architecture

```
                    ┌──────────────────────────┐
                    │    React Frontend         │
                    │  (Vite + Tailwind CSS)    │
                    │                          │
                    │  ┌────────────────────┐  │
                    │  │   UploadPanel      │  │
                    │  │   ProgressTracker  │  │
                    │  │   AuditReport      │  │
                    │  │   WorkflowDiagram  │  │
                    │  └────────────────────┘  │
                    └──────────┬───────────────┘
                               │  POST /api/kyc/stream
                               │  NDJSON Event Stream
                               ▼
                    ┌──────────────────────────┐
                    │    FastAPI Backend        │
                    │    (port 8001)            │
                    │                          │
                    │  POST /api/kyc/process   │
                    │  POST /api/kyc/stream    │
                    │  GET  /api/workflow/..   │
                    └──────────┬───────────────┘
                               │
                               ▼
                    ┌──────────────────────────┐
                    │   LangGraph StateGraph   │
                    │                          │
                    │  ┌──────────────────┐    │
                    │  │  node_guardrail  │    │
                    │  └────────┬─────────┘    │
                    │           │ OK / BLOCKED  │
                    │  ┌────────▼─────────┐    │
                    │  │ node_extraction  │◄───┼── AMD GPU
                    │  └────────┬─────────┘    │
                    │  ┌────────▼─────────┐    │
                    │  │ node_compliance  │    │
                    │  └────────┬─────────┘    │
                    │       ≤0.95│  >0.95       │
                    │  ┌────────▼─────────┐    │
                    │  │node_orchestrator │◄───┼── AMD GPU
                    │  └────────┬─────────┘    │
                    │  ┌────────▼─────────┐    │
                    │  │  node_sanitizer  │    │
                    │  └──────────────────┘    │
                    └──────────┬───────────────┘
                               │
                               ▼
                    ┌──────────────────────────┐
                    │   vLLM Inference Server  │
                    │   AMD ROCm GPU (port 8000)│
                    │   OpenAI-compatible API  │
                    └──────────────────────────┘
```

---

## 🤖 Agent Pipeline

### Node 1 — `node_guardrail` 🛡️
**Purpose:** Security boundary — scans all incoming document text before it touches the LLM.

- Runs 12 regex patterns for prompt injection attacks (e.g., *"ignore previous instructions"*, *"jailbreak"*, Llama instruction tags `[INST]`)
- Detects abnormally long tokens (tokenizer attack vector)
- Sets `security_status = "BLOCKED"` → conditional edge skips all downstream nodes

### Node 2 — `node_extraction` 🔍 *(AMD GPU)*
**Purpose:** Extract structured identity fields from raw document text.

- Sends document text to vLLM via async OpenAI-compatible client
- System prompt engineered for deterministic JSON output
- Validates response against Pydantic v2 `ExtractedDocument` schema
- Fields: `full_name`, `date_of_birth`, `nationality`, `document_type`, `document_number`

### Node 3 — `node_compliance` ⚖️
**Purpose:** Sanctions watchlist screening via fuzzy name matching.

- Loads `mock_data/watchlists.json` (5 sanctioned entities, 20+ name variants)
- Uses `fuzzywuzzy.process.extractBests` with `token_sort_ratio` scorer
- **Threshold: 85%** — any match above triggers a compliance flag
- **Auto-escalation edge:** if `confidence_score > 0.95`, skip orchestrator → immediately ESCALATE

### Node 4 — `node_orchestrator` 🧠 *(AMD GPU)*
**Purpose:** Final reasoning — synthesize all pipeline context into a compliance decision.

- Composes a structured case summary (identity, flags, confidence, prior logs)
- LLM returns `{ "decision": "APPROVE|REVIEW|ESCALATE", "rationale": "two sentences" }`
- Validates decision is one of the three allowed values; invalid defaults to ESCALATE

### Node 5 — `node_sanitizer` 🔒
**Purpose:** Outbound PII masking — redacts sensitive identifiers before data leaves the system.

- Masks passport numbers, SSNs, tax IDs, credit card numbers, IBANs via regex
- Returns sanitized copy of `extracted_data` (does not mutate original state)

---

## 📁 Project Structure

```
AMD-Hackathon/
├── AegisKYC_Project_Spec.md        # Original hackathon specification
├── README.md                        # ← You are here
│
└── aegis-kyc-platform/              # Main project
    ├── setup.bat                    # One-click environment setup (Windows)
    ├── start.bat                    # Launch both servers + open browser
    │
    ├── backend/
    │   ├── app.py                   # FastAPI application (3 API endpoints)
    │   ├── requirements.txt         # Python dependencies (latest stable)
    │   ├── test_graph.py            # Pipeline self-test script
    │   │
    │   ├── core/
    │   │   ├── __init__.py
    │   │   ├── state.py             # KYCState TypedDict schema
    │   │   ├── llm_client.py        # Async OpenAI-compat vLLM client
    │   │   └── guardrails.py        # Injection shield + PII masker
    │   │
    │   ├── graph/
    │   │   ├── __init__.py
    │   │   ├── kyc_graph.py         # StateGraph assembly + Mermaid diagram
    │   │   └── nodes.py             # 5 LangGraph node functions
    │   │
    │   ├── agents/
    │   │   ├── __init__.py
    │   │   ├── extraction_agent.py  # LLM field extractor
    │   │   ├── compliance_agent.py  # FuzzyWuzzy watchlist screener
    │   │   └── orchestrator.py      # LLM decision reasoner
    │   │
    │   └── mock_data/
    │       └── watchlists.json      # 5 sanctioned entities, 20+ name variants
    │
    └── frontend/
        ├── index.html               # HTML entry (Inter + JetBrains Mono fonts)
        ├── package.json             # npm dependencies
        ├── vite.config.js           # Vite + /api proxy to port 8001
        ├── tailwind.config.js       # Brand palette + micro-animations
        ├── postcss.config.js
        │
        └── src/
            ├── main.jsx             # React DOM mount
            ├── index.css            # Global styles (glassmorphism, AMD shimmer)
            ├── App.jsx              # Shell: header, AMD badge, tab nav
            │
            └── components/
                ├── UploadPanel.jsx      # Textarea, drag-drop, NDJSON reader
                ├── ProgressTracker.jsx  # Live pipeline node animation
                ├── AuditReport.jsx      # Decision hero, flags, confidence meter
                └── WorkflowDiagram.jsx  # Mermaid diagram from live API
```

---

## 🛠️ Tech Stack

### Backend
| Package | Version | Purpose |
|---------|---------|---------|
| `fastapi` | ≥ 0.115 | REST API framework with async support |
| `uvicorn[standard]` | ≥ 0.30 | ASGI server with WebSocket/streaming |
| `pydantic` | ≥ 2.7 | v2 schema validation for all LLM outputs |
| `langgraph` | ≥ 0.2.28 | State machine graph — orchestrates agent flow |
| `langchain` | ≥ 0.3 | LLM abstractions and prompt utilities |
| `httpx` | ≥ 0.27 | Async HTTP client for vLLM API calls |
| `fuzzywuzzy` | 0.18 | Fuzzy string matching for name screening |
| `python-Levenshtein` | ≥ 0.25 | C-accelerated edit distance (speeds up FuzzyWuzzy) |
| `python-multipart` | ≥ 0.0.9 | File upload support |
| `python-dotenv` | ≥ 1.0 | Environment variable management |

### Frontend
| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.3.1 | UI framework |
| `react-dom` | ^18.3.1 | DOM rendering |
| `mermaid` | ^11.4.0 | LangGraph workflow diagram rendering |
| `vite` | ^5.4 | Build tool with HMR dev server |
| `tailwindcss` | ^3.4 | Utility-first CSS framework |
| `@vitejs/plugin-react` | ^4.3 | React fast-refresh plugin |

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10 or higher
- Node.js 18 or higher
- Git

### Option A — One-Click Setup (Windows)

```bat
cd aegis-kyc-platform
setup.bat    # Creates venv, installs deps, installs npm packages
start.bat    # Launches backend + frontend + opens browser
```

### Option B — Manual Setup

#### 1. Backend

```bash
cd aegis-kyc-platform/backend

# Create and activate virtual environment
python -m venv venv

# Install dependencies
pip install -r requirements.txt

# Run self-test (optional but recommended)
venv\Scripts\python test_graph.py          # Windows
# python test_graph.py                     # Linux/macOS (after activating venv)

# Start the FastAPI server — use the venv's uvicorn directly
venv\Scripts\uvicorn app:app --host 0.0.0.0 --port 8001 --reload   # Windows
# uvicorn app:app --host 0.0.0.0 --port 8001 --reload               # Linux/macOS
```

Backend available at: http://localhost:8001  
Interactive API docs: http://localhost:8001/docs

#### 2. Frontend

```bash
cd aegis-kyc-platform/frontend

npm install
npm run dev
```

App available at: http://localhost:5173

#### 3. AMD vLLM Server (for full LLM functionality)

```bash
# Install vLLM with ROCm support
pip install vllm

# Start the server (AMD GPU required)
vllm serve meta-llama/Llama-3.1-8B-Instruct \
  --host 0.0.0.0 \
  --port 8000 \
  --dtype float16

# Verify it's running
curl http://localhost:8000/v1/models
```

> **Without vLLM:** The pipeline runs all 5 nodes. Extraction and Orchestrator nodes use a safe fallback response and output `ESCALATE`. FuzzyWuzzy compliance screening and security guardrails work with zero LLM dependency.

---

## ⚙️ Configuration

The LLM endpoint and model are configured in `backend/core/llm_client.py`:

```python
VLLM_BASE_URL = "http://localhost:8000/v1"   # vLLM AMD GPU server
DEFAULT_MODEL  = "meta-llama/Llama-3.1-8B-Instruct"
REQUEST_TIMEOUT = 30.0  # seconds
```

To change the model or endpoint, update these constants or set environment variables via a `.env` file in `backend/`:

```env
VLLM_BASE_URL=http://your-gpu-server:8000/v1
DEFAULT_MODEL=mistralai/Mistral-7B-Instruct-v0.3
```

The compliance match threshold is in `backend/agents/compliance_agent.py`:

```python
MATCH_THRESHOLD = 85  # Flag any name match ≥ 85%
```

The auto-escalation threshold is in `backend/graph/kyc_graph.py`:

```python
AUTO_ESCALATE_THRESHOLD = 0.95  # Skip orchestrator if confidence > 95%
```

---

## 📡 API Reference

### `POST /api/kyc/process`
Synchronous KYC processing. Runs the full pipeline and returns the complete final state.

**Request:**
```json
{
  "document_text": "Passport No: P1234567. Name: John Doe. Born: 1985-03-15. Nationality: British."
}
```

**Response:**
```json
{
  "case_id": "550e8400-e29b-41d4-a716-446655440000",
  "final_decision": "APPROVE",
  "confidence_score": 0.0,
  "extracted_data": {
    "full_name": "John Doe",
    "date_of_birth": "1985-03-15",
    "nationality": "British",
    "document_type": "PASSPORT",
    "document_number": "[PASSPORT-REDACTED]"
  },
  "compliance_flags": [],
  "audit_summary": "Case ... | Decision: APPROVE | Confidence: 0.00% | Flags: 0",
  "security_status": "OK",
  "agent_logs": ["[2026-...] [GUARDRAIL] ...", "..."],
  "stream_events": [...]
}
```

---

### `POST /api/kyc/stream`
Streaming KYC processing. Returns a **NDJSON** event stream — one JSON object per line.

**Request:** Same as `/api/kyc/process`

**Stream Event Types:**

| Event Type | Description |
|------------|-------------|
| `case_start` | Pipeline initiated with case ID |
| `node_start` | Agent node began execution |
| `node_progress` | Agent is mid-processing (e.g., waiting for LLM) |
| `node_complete` | Agent finished — includes result data |
| `node_error` | Agent encountered an error |
| `pipeline_complete` | All nodes done — includes full final state |
| `pipeline_error` | Unrecoverable pipeline failure |

**Example stream:**
```ndjson
{"type":"case_start","case_id":"550e...","message":"AegisKYC pipeline initiated"}
{"type":"node_start","node":"guardrail","message":"Initializing security shield..."}
{"type":"node_complete","node":"guardrail","data":{"security_status":"OK"}}
{"type":"node_start","node":"extraction","message":"Sending to AMD GPU-accelerated LLM..."}
{"type":"node_complete","node":"extraction","data":{"extracted_name":"John Doe"}}
{"type":"node_complete","node":"compliance","data":{"flags_count":0,"confidence_score":0.0}}
{"type":"node_complete","node":"orchestrator","data":{"decision":"APPROVE"}}
{"type":"node_complete","node":"sanitizer","data":{"masked_fields":["document_number"]}}
{"type":"pipeline_complete","final_state":{...}}
```

---

### `GET /api/workflow/diagram`
Returns the Mermaid flowchart string of the live LangGraph pipeline.

**Response:**
```json
{
  "diagram": "flowchart TD\n    START([START]) --> G\n    G[node_guardrail...]..."
}
```

---

### `GET /api/health`
Health check.

**Response:**
```json
{
  "status": "healthy",
  "service": "AegisKYC",
  "graph_ready": true,
  "llm_endpoint": "http://localhost:8000/v1"
}
```

---

## 🖥️ Frontend Dashboard

The single-page React application provides two views:

### ⚡ Process Document Tab

**UploadPanel** — Document submission interface:
- Textarea for pasting document text (passport, national ID, driving license)
- Drag-and-drop `.txt` file upload
- 3 built-in sample documents for instant testing:
  - ✅ Clean passport (APPROVE path)
  - 🚨 Sanctioned entity (ESCALATE path — matches Viktor Sokolov)
  - 🟡 Review case (partial match — triggers REVIEW)

**Live Pipeline Monitor** — Real-time agent visualization:
- Each of the 5 agent nodes has its own animated card
- **Waiting** → greyed out
- **Running** → blue/purple pulsing spinner with `LIVE` badge
- **Complete** → green tick with inline data badges (extracted name, flag count, confidence %)
- Animated connector lines between nodes pulse while active
- Collapsible raw event log with colour-coded event types

**Audit Report** — Final compliance result:
- **Decision hero** — full-width colour-coded badge:
  - 🟢 Green gradient → `APPROVE`
  - 🟡 Amber gradient → `REVIEW`
  - 🔴 Red gradient → `ESCALATE`
- Confidence score meter bar (0% → 85% review threshold → 95% auto-escalate)
- Two-column grid: extracted identity fields | case metadata
- Compliance flag cards showing watchlist ID, match score, risk tier, country
- AI-generated audit summary paragraph
- Collapsible timestamped agent execution logs

### 🗺️ Workflow Diagram Tab

- Fetches Mermaid diagram from `GET /api/workflow/diagram`
- Renders the complete LangGraph state machine with dark theme
- Shows conditional edges, node labels, and AMD GPU indicators
- Pipeline stats: 5 agents, 2 conditional branches, 2 LLM calls
- Collapsible raw Mermaid source for transparency

---

## 🔐 Security Model

### Inbound Security — Prompt Injection Shield

12 regex patterns detect attempts to manipulate the LLM:
- `"ignore previous instructions"` / `"disregard"` / `"forget all"`
- `"system prompt"` / `"override safety"` / `"jailbreak"` / `"DAN"`
- Llama token injection: `[INST]`, `[/INST]`
- Instruction-format headers: `### System`, `### Human`, `### Assistant`
- Abnormal single-token length (> 500 chars — tokenizer attack)

### Outbound Security — PII Masking

5 regex patterns redact sensitive data before it leaves the system:

| PII Type | Pattern | Replacement |
|----------|---------|-------------|
| Passport numbers | `[A-Z]{1,2}[0-9]{6,9}` | `[PASSPORT-REDACTED]` |
| US SSN | `\d{3}-\d{2}-\d{4}` | `[SSN-REDACTED]` |
| Tax / National ID | 8–12 consecutive digits | `[TAX-ID-REDACTED]` |
| Credit card | 4×4 digit groups | `[CARD-REDACTED]` |
| IBAN | `[A-Z]{2}\d{2}[A-Z0-9]+` | `[IBAN-REDACTED]` |

---

## ✅ Self-Test & Verification

Run the built-in pipeline self-test (no vLLM server required):

```bash
cd aegis-kyc-platform/backend
venv\Scripts\python test_graph.py    # Windows
# python test_graph.py              # Linux/macOS
```

**Expected output:**
```
============================================================
  AegisKYC - Pipeline Self-Test
============================================================

[1/3] Building LangGraph state machine...
      [OK] Graph compiled successfully

[2/3] Running pipeline for case xxxxxxxx...
      Input: 240 chars

[3/3] Validating results...

  Agent logs (10 entries):
    [2026-...] [GUARDRAIL] Starting inbound security scan
    [2026-...] [GUARDRAIL] Document passed security screening
    [2026-...] [EXTRACTION] Submitting raw text to LLM...
    [2026-...] [COMPLIANCE] Starting watchlist screening
    [2026-...] [ORCHESTRATOR] Composing final compliance decision
    [2026-...] [SANITIZER] Applying outbound PII masking

  [OK] (a) Required nodes executed
  [OK] (b) agent_logs has 10 entries
  [OK] (c) final_decision = 'ESCALATE' (valid)

============================================================
  RESULT:     ESCALATE    (LLM fallback — no GPU server)
  Security:   OK
  Confidence: 0.00%
  Flags:      0
  Events:     14
============================================================

All assertions PASSED - pipeline is working correctly!
```

---

## 🗺️ Roadmap

- [ ] **EasyOCR Integration** — Image-based document ingestion (passport scan, photo ID)
- [ ] **PDF Upload** — Direct PDF parsing via `pdfplumber`
- [ ] **CPU vs GPU Benchmark Panel** — Side-by-side throughput comparison displayed in the dashboard
- [ ] **Persistent Case Store** — SQLite/PostgreSQL case history with audit trail
- [ ] **Multi-language Support** — Non-English document extraction
- [ ] **Real OFAC/UN API Integration** — Live sanctions list feed
- [ ] **Docker Compose** — One-command deployment with GPU passthrough
- [ ] **Webhook Notifications** — Push compliance results to external systems

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with ❤️ for the AMD AI Hackathon 2026**

⚔️ *AegisKYC — Guarding Compliance with Intelligence*

[![AMD](https://img.shields.io/badge/Powered%20by-AMD%20ROCm-ED1C24?style=flat-square&logo=amd)](https://rocm.amd.com/)
[![LangGraph](https://img.shields.io/badge/Orchestrated%20by-LangGraph-4A90D9?style=flat-square)](https://github.com/langchain-ai/langgraph)

</div>
