#!/bin/bash
# =============================================================================
#  AegisKYC — Start vLLM Server on AMD MI300X
#  Run this in a SEPARATE terminal tab BEFORE start_app.sh
# =============================================================================
#
#  Model: Qwen/Qwen3-4B (as specified in AMD Hackathon handbook)
#  API key: abc-123 (matches .env.amd)
#  Port: 8000
#
#  The MI300X has 192 GB VRAM — this 4B model uses ~8 GB, leaving
#  184 GB free. You could run 70B models on this hardware.
# =============================================================================

echo "============================================================"
echo "  Starting vLLM on AMD Instinct MI300X"
echo "  Model: Qwen/Qwen3-4B"
echo "  GPU:   AMD ROCm"
echo "  Port:  8000"
echo "============================================================"
echo ""
echo "  Downloading model on first run (~8 GB)..."
echo "  Subsequent runs load from cache instantly."
echo ""
echo "  Wait for: 'INFO:     Application startup complete.'"
echo "  Then open a NEW terminal and run: bash start_app.sh"
echo ""

# Exact command from AMD Hackathon handbook
VLLM_USE_TRITON_FLASH_ATTN=0 vllm serve Qwen/Qwen3-4B \
    --served-model-name Qwen3-4B \
    --api-key abc-123 \
    --port 8000 \
    --enable-auto-tool-choice \
    --tool-call-parser Hermes \
    --trust-remote-code \
    --max_model_len 24272
