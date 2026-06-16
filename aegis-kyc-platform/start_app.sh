#!/bin/bash
# =============================================================================
#  AegisKYC — Start FastAPI Backend
#  Run this AFTER start_vllm.sh shows "Application startup complete"
# =============================================================================
#
#  Serves:
#    - All /api/* endpoints (KYC pipeline, streaming, diagram, health)
#    - React frontend at / (served as static files from frontend/dist/)
#
#  Access at:
#    https://notebooks.amd.com/tcs-hackathon/user/YOUR-TEAM-ID/proxy/8001/
#    https://notebooks.amd.com/tcs-hackathon/user/YOUR-TEAM-ID/proxy/8001/api/docs
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

echo "============================================================"
echo "  AegisKYC — Starting FastAPI Server"
echo "  Port:     8001"
echo "  Frontend: Served as static files from frontend/dist/"
echo "============================================================"
echo ""

# Verify vLLM is reachable before starting
echo "  Checking vLLM server at http://localhost:8000/v1 ..."
if curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer abc-123" \
    http://localhost:8000/v1/models | grep -q "200"; then
    echo "  [OK] vLLM server is running — Qwen3-4B loaded"
else
    echo "  [WARN] vLLM server not responding yet."
    echo "         AegisKYC will still start (LLM nodes will use fallback until vLLM is ready)"
fi

echo ""
echo "  Starting server..."
echo ""

# ── Auto-detect the Jupyter proxy URL ────────────────────────────────────────
# AMD notebooks use a custom URL like:
#   https://notebooks.amd.com/jupyter-hack-team-XXXX-YYYYMMDD-hash/proxy/8001/
# The JUPYTERHUB_SERVICE_PREFIX env var gives the base path (e.g. /jupyter-hack-.../):
if [ -n "$JUPYTERHUB_SERVICE_PREFIX" ]; then
    # Standard JupyterHub: prefix is like /user/team-id/
    BASE_URL="https://notebooks.amd.com${JUPYTERHUB_SERVICE_PREFIX}proxy/8001"
elif [ -n "$JUPYTER_SERVER_URL" ]; then
    # Some deployments set the full server URL
    BASE_URL="${JUPYTER_SERVER_URL%/}/proxy/8001"
else
    # Fallback: parse from running jupyter server
    JUPYTER_BASE=$(jupyter server list 2>/dev/null | grep -oP 'http://[^?]+' | head -1 | sed 's|http://0.0.0.0|https://notebooks.amd.com|' | sed 's|http://127.0.0.1|https://notebooks.amd.com|')
    BASE_URL="${JUPYTER_BASE%/}/proxy/8001"
fi

echo "  ============================================================"
echo "  App URL:  ${BASE_URL}/"
echo "  API Docs: ${BASE_URL}/api/docs"
echo "  Health:   ${BASE_URL}/api/health"
echo "  ============================================================"
echo ""

if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "  [INFO] .env file not found. Auto-creating from .env.amd template..."
    cp "$BACKEND_DIR/.env.amd" "$BACKEND_DIR/.env"
fi

cd "$BACKEND_DIR"
python -m uvicorn app:app --host 0.0.0.0 --port 8001 --workers 1
