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
echo "  Access the app at:"
echo "  https://notebooks.amd.com/tcs-hackathon/user/\$(whoami)/proxy/8001/"
echo ""

cd "$BACKEND_DIR"
python -m uvicorn app:app --host 0.0.0.0 --port 8001 --workers 1
