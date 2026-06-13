#!/bin/bash
# =============================================================================
#  AegisKYC — AMD AI Notebook Pod Setup Script
#  Run this ONCE after git clone in the JupyterLab terminal
# =============================================================================
#
#  Usage (in pod terminal):
#    git clone https://github.com/RIsHaBHMiShrA2710/AMD-Hackathon.git
#    cd AMD-Hackathon/aegis-kyc-platform
#    bash pod_setup.sh
#
# =============================================================================

set -e  # Exit on any error

echo "============================================================"
echo "  AegisKYC — AMD Pod Setup"
echo "  AMD Instinct MI300X | ROCm | vLLM | Qwen3-4B"
echo "============================================================"

# ── 1. Backend Python dependencies ────────────────────────────────────────────
echo ""
echo "[1/4] Installing Python backend dependencies..."
cd "$(dirname "$0")/backend"
pip install -r requirements.txt --quiet
echo "      [OK] Backend deps installed"

# ── 2. Configure AMD environment ──────────────────────────────────────────────
echo ""
echo "[2/4] Configuring AMD environment variables..."
if [ ! -f ".env" ]; then
    cp .env.amd .env
    echo "      [OK] .env created from .env.amd"
else
    echo "      [SKIP] .env already exists"
fi

# ── 3. Build React frontend ────────────────────────────────────────────────────
echo ""
echo "[3/4] Building React frontend (this takes ~30 seconds)..."
cd ../frontend

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "      Node.js not found — installing via nvm..."
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
fi

npm install --silent
npm run build
echo "      [OK] Frontend built to frontend/dist/"

# ── 4. Verify setup ────────────────────────────────────────────────────────────
echo ""
echo "[4/4] Verifying setup..."
cd ../backend
python -c "
import sys
sys.path.insert(0, '.')
from graph.kyc_graph import build_kyc_graph
g = build_kyc_graph()
print('      [OK] LangGraph compiled successfully')
"

echo ""
echo "============================================================"
echo "  Setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Start vLLM server:  bash start_vllm.sh"
echo "  2. Start AegisKYC:     bash start_app.sh"
echo "  3. Access via Jupyter proxy:"
echo "     https://notebooks.amd.com/tcs-hackathon/user/YOUR-TEAM-ID/proxy/8001/"
echo "============================================================"
