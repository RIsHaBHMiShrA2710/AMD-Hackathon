"""
AegisKYC — Async LLM Client
============================
Provides a single async OpenAI-compatible HTTP client targeting a local
vLLM inference server (simulating AMD ROCm GPU acceleration).

All LLM calls are async so FastAPI can handle concurrent requests without
blocking the event loop. Connection errors fall back gracefully so the
rest of the pipeline can still produce a deterministic ESCALATE decision.
"""

import asyncio
import json
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────
# Points to the local vLLM server (AMD ROCm GPU-accelerated inference)
VLLM_BASE_URL = "http://localhost:8000/v1"
DEFAULT_MODEL = "meta-llama/Llama-3.1-8B-Instruct"  # swap to any model loaded in vLLM
REQUEST_TIMEOUT = 30.0  # seconds; generous for local GPU inference


class LLMClient:
    """
    Async OpenAI-compatible client for the local vLLM inference server.
    Uses httpx.AsyncClient for non-blocking HTTP requests within FastAPI's
    asyncio event loop.
    """

    def __init__(
        self,
        base_url: str = VLLM_BASE_URL,
        model: str = DEFAULT_MODEL,
        timeout: float = REQUEST_TIMEOUT,
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

        # Persistent async HTTP client — reuse across requests for connection pooling
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(timeout),
            headers={"Content-Type": "application/json"},
        )

    async def complete(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.1,  # low temperature for deterministic compliance outputs
        max_tokens: int = 512,
    ) -> str:
        """
        Send a chat completion request to the vLLM server and return the
        assistant's reply as a plain string.

        Falls back to a safe error string on timeout or connection failure
        so downstream nodes can handle it gracefully.
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
            # Standard OpenAI-compatible response format
            return data["choices"][0]["message"]["content"].strip()

        except httpx.ConnectError:
            # vLLM server is not running — return a safe fallback
            logger.warning("LLM server not reachable at %s — using fallback", self.base_url)
            return self._fallback_response("LLM_CONNECTION_ERROR")

        except httpx.TimeoutException:
            logger.warning("LLM request timed out after %.1fs", self.timeout)
            return self._fallback_response("LLM_TIMEOUT")

        except (KeyError, IndexError, json.JSONDecodeError) as exc:
            logger.error("Unexpected LLM response format: %s", exc)
            return self._fallback_response("LLM_PARSE_ERROR")

        except httpx.HTTPStatusError as exc:
            logger.error("LLM server HTTP error %s: %s", exc.response.status_code, exc)
            return self._fallback_response(f"LLM_HTTP_{exc.response.status_code}")

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
llm_client = LLMClient()
