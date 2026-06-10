"""
AegisKYC — Security Guardrails
================================
Two-layer security boundary:
  1. inbound_shield   — blocks prompt injection before text enters the LLM
  2. outbound_sanitizer — masks PII patterns before data leaves the system

These functions are intentionally kept simple and regex-based so they run
synchronously without any external dependencies and cannot themselves be
compromised by the document content they inspect.
"""

import re
from typing import Any

# ── Inbound: Prompt Injection Detection ───────────────────────────────────────

# Patterns that indicate an attempt to hijack LLM instructions
_INJECTION_PATTERNS: list[re.Pattern] = [
    re.compile(r"ignore\s+(all\s+)?previous\s+instructions", re.IGNORECASE),
    re.compile(r"disregard\s+(all\s+)?previous", re.IGNORECASE),
    re.compile(r"forget\s+(all\s+)?previous\s+instructions", re.IGNORECASE),
    re.compile(r"system\s+prompt", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+a", re.IGNORECASE),
    re.compile(r"act\s+as\s+(if\s+you\s+(are|were)|a)", re.IGNORECASE),
    re.compile(r"jailbreak", re.IGNORECASE),
    re.compile(r"DAN\b", re.IGNORECASE),  # "Do Anything Now" jailbreak
    re.compile(r"override\s+(safety|guardrail|filter)", re.IGNORECASE),
    re.compile(r"<\s*\|?\s*(system|assistant|user)\s*\|?\s*>", re.IGNORECASE),  # token injection
    re.compile(r"\[INST\]|\[\/INST\]", re.IGNORECASE),  # Llama instruction tags
    re.compile(r"###\s*(Instruction|System|Human|Assistant)", re.IGNORECASE),
]


def inbound_shield(text: str) -> tuple[bool, str]:
    """
    Scan incoming document text for prompt injection patterns.

    Returns:
        (True, "")              — text is safe to process
        (False, reason: str)    — injection detected; reason describes which pattern matched

    The caller (node_guardrail) sets security_status = "BLOCKED" and short-circuits
    the graph if this returns False.
    """
    if not text or not text.strip():
        return False, "Empty or blank document text submitted"

    for pattern in _INJECTION_PATTERNS:
        match = pattern.search(text)
        if match:
            reason = (
                f"Prompt injection detected — matched pattern "
                f"'{pattern.pattern}' at position {match.start()}"
            )
            return False, reason

    # Check for abnormally long single token sequences (potential tokenizer attack)
    words = text.split()
    if any(len(word) > 500 for word in words):
        return False, "Suspicious token detected: single token exceeds 500 characters"

    return True, ""


# ── Outbound: PII Masking ─────────────────────────────────────────────────────

# Map of PII type → (regex pattern, replacement string)
_PII_PATTERNS: list[tuple[str, re.Pattern, str]] = [
    # Passport numbers: 1-2 letters followed by 6-9 digits
    ("passport", re.compile(r"\b[A-Z]{1,2}[0-9]{6,9}\b"), "[PASSPORT-REDACTED]"),

    # US Social Security Number (with or without dashes)
    ("ssn", re.compile(r"\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b"), "[SSN-REDACTED]"),

    # Generic tax ID / national ID: 8-12 consecutive digits
    ("tax_id", re.compile(r"\b\d{8,12}\b"), "[TAX-ID-REDACTED]"),

    # Credit card numbers: 4 groups of 4 digits (Visa/MC/Amex patterns)
    ("card", re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b"), "[CARD-REDACTED]"),

    # IBAN-style serial numbers
    ("iban", re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{1,30}\b"), "[IBAN-REDACTED]"),
]


def outbound_sanitizer(data: dict[str, Any]) -> dict[str, Any]:
    """
    Walk through all string values in a dict (shallowly) and replace known
    PII patterns with redacted placeholders.

    This runs on extracted_data before it is returned in the API response,
    ensuring raw document numbers never leave the system in cleartext.

    Returns a new dict — does NOT mutate the original state.
    """
    sanitized: dict[str, Any] = {}

    for key, value in data.items():
        if isinstance(value, str):
            masked = value
            for pii_type, pattern, replacement in _PII_PATTERNS:
                masked = pattern.sub(replacement, masked)
            sanitized[key] = masked
        elif isinstance(value, dict):
            # Recurse one level for nested dicts
            sanitized[key] = outbound_sanitizer(value)
        elif isinstance(value, list):
            sanitized[key] = [
                outbound_sanitizer(item) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            sanitized[key] = value

    return sanitized
