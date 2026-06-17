"""
AegisKYC — Async LLM Client
============================
Provides a single async OpenAI-compatible HTTP client targeting a vLLM
inference server running on AMD ROCm GPU hardware (local or cloud).

Configuration is driven entirely by environment variables (via .env file)
so you never need to edit code to switch between local dev and the AMD
AI Developer Cloud production instance.

Priority order for endpoint resolution:
  1. AMD_INFERENCE_URL  env var  (AMD Developer Cloud instance)
  2. VLLM_BASE_URL      env var  (custom self-hosted)
  3. http://localhost:8000/v1   (local fallback for development)

All LLM calls are async so FastAPI can handle concurrent requests without
blocking the event loop. Connection errors fall back gracefully so the
rest of the pipeline can still produce a deterministic ESCALATE decision.
"""

import json
import logging
import os

import httpx
from dotenv import load_dotenv

# Load .env from the backend directory
load_dotenv()

logger = logging.getLogger(__name__)

# ── Configuration (all overridable via .env) ──────────────────────────────────

# AMD Developer Cloud / custom vLLM endpoint
# Set AMD_INFERENCE_URL in .env to your cloud instance URL, e.g.:
#   AMD_INFERENCE_URL=https://your-instance.amd-developer-cloud.com/v1
VLLM_BASE_URL: str = (
    os.getenv("AMD_INFERENCE_URL")          # AMD Developer Cloud — highest priority
    or os.getenv("VLLM_BASE_URL")           # Generic self-hosted vLLM
    or "http://localhost:8000/v1"           # Local dev fallback
)

# Model name — must match whatever is loaded in your vLLM server
# AMD Developer Cloud typically serves: meta-llama/Llama-3.1-8B-Instruct
#                                  or: mistralai/Mistral-7B-Instruct-v0.3
DEFAULT_MODEL: str = os.getenv(
    "LLM_MODEL",
    "Qwen3-4B",
)

# API key for authenticated cloud endpoints
# AMD Developer Cloud provides this in your dashboard
# Leave empty for local unauthenticated vLLM instances
API_KEY: str = os.getenv("AMD_API_KEY", "") or os.getenv("OPENAI_API_KEY", "")

# Timeout — increase for cloud instances with network latency
REQUEST_TIMEOUT: float = float(os.getenv("LLM_TIMEOUT", "60.0"))


class LLMClient:
    """
    Async OpenAI-compatible client for vLLM on AMD ROCm GPU hardware.

    Works with:
      - AMD Developer Cloud (MI300X instances) — set AMD_INFERENCE_URL + AMD_API_KEY
      - Local vLLM server                      — default localhost:8000
      - Any OpenAI-compatible endpoint          — set VLLM_BASE_URL + OPENAI_API_KEY

    Uses httpx.AsyncClient for non-blocking HTTP requests within FastAPI's
    asyncio event loop.
    """

    def __init__(
        self,
        base_url: str = VLLM_BASE_URL,
        model: str = DEFAULT_MODEL,
        api_key: str = API_KEY,
        timeout: float = REQUEST_TIMEOUT,
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

        # Build auth headers — only include Authorization if a key is provided
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
            logger.info("LLMClient: using authenticated endpoint (API key configured)")
        else:
            logger.info("LLMClient: no API key — connecting to unauthenticated local vLLM")

        logger.info("LLMClient: endpoint = %s | model = %s", self.base_url, self.model)

        # Persistent async HTTP client — reuse across requests for connection pooling
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(timeout),
            headers=headers,
        )

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.1,   # low temperature for deterministic compliance outputs
        max_tokens: int = 512,
    ) -> str:
        """
        Send a chat completion request to the vLLM server and return the
        assistant's reply as a plain string.

        Falls back to a safe ESCALATE string on timeout or connection failure
        so downstream nodes can handle it without crashing.
        """
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        try:
            response = await self._client.post("/chat/completions", json=payload)
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            # Clean reasoning/thinking tokens (like <think>...</think>)
            import re
            cleaned_content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
            if "<think>" in cleaned_content:
                cleaned_content = cleaned_content.split("<think>")[0].strip()
            
            # Extract the raw JSON block robustly
            first_brace = cleaned_content.find("{")
            last_brace = cleaned_content.rfind("}")
            if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
                cleaned_content = cleaned_content[first_brace:last_brace + 1]
            return cleaned_content

        except httpx.ConnectError:
            logger.warning("LLM server not reachable at %s — using fallback", self.base_url)
            return self._fallback_response("LLM_CONNECTION_ERROR")

        except httpx.TimeoutException:
            logger.warning("LLM request timed out after %.1fs — consider increasing LLM_TIMEOUT", self.timeout)
            return self._fallback_response("LLM_TIMEOUT")

        except (KeyError, IndexError, json.JSONDecodeError) as exc:
            logger.error("Unexpected LLM response format: %s", exc)
            return self._fallback_response("LLM_PARSE_ERROR")

        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if status == 401:
                logger.error("LLM auth failed (401) — check AMD_API_KEY in .env")
            elif status == 404:
                logger.error("LLM model not found (404) — check LLM_MODEL in .env matches what's loaded on the server")
            else:
                logger.error("LLM server HTTP error %s: %s", status, exc)
            return self._fallback_response(f"LLM_HTTP_{status}")

    def _fallback_response(self, error_code: str) -> str:
        """
        Return a JSON-shaped fallback that downstream agents can detect and
        treat as a signal to ESCALATE for human review.
        """
        return json.dumps(
            {
                "decision": "ESCALATE",
                "rationale": (
                    f"Automated decision unavailable due to {error_code}. "
                    "Case has been escalated to human review as a precautionary measure."
                ),
                "_error": error_code,
            }
        )

    async def aclose(self):
        """Close the underlying HTTP client — call on app shutdown."""
        await self._client.aclose()


# ── Module-level singleton ─────────────────────────────────────────────────────
# Instantiated once at import time; reused across all requests in the process.
# All configuration is read from env vars at this point.
llm_client = LLMClient()
