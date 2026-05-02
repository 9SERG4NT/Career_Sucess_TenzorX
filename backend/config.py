# backend/config.py
"""
Central configuration for PlacementIQ.
Reads provider choice and API keys from .env.
All agents import from here — never hardcode keys anywhere else.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ── Provider Registry ─────────────────────────────────────────────────────────
# Each entry defines: base_url, default model, tool format, and API key env var.
# tool_format: "anthropic" uses Anthropic SDK; "openai" uses OpenAI-compatible SDK.

PROVIDER_REGISTRY = {
    "anthropic": {
        "base_url": None,                          # Uses Anthropic SDK directly
        "default_model": "claude-sonnet-4-6",
        "tool_format": "anthropic",
        "api_key_env": "ANTHROPIC_API_KEY",
    },
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "default_model": "anthropic/claude-3.5-sonnet",  # Or "meta-llama/llama-3.3-70b-instruct"
        "tool_format": "openai",
        "api_key_env": "OPENROUTER_API_KEY",
        "extra_headers": {
            "HTTP-Referer": "https://placementiq.io",
            "X-Title": "PlacementIQ"
        }
    },
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "default_model": "llama-3.1-8b-instant",   # Best Groq model for tool use
        "tool_format": "openai",
        "api_key_env": "GROQ_API_KEY",
    },
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "default_model": "gpt-4o",
        "tool_format": "openai",
        "api_key_env": "OPENAI_API_KEY",
    },
}

# ── Active Provider ───────────────────────────────────────────────────────────
ACTIVE_PROVIDER = os.getenv("PROVIDER", "anthropic").lower()

if ACTIVE_PROVIDER not in PROVIDER_REGISTRY:
    raise ValueError(
        f"Unknown PROVIDER='{ACTIVE_PROVIDER}'. "
        f"Choose from: {list(PROVIDER_REGISTRY.keys())}"
    )

PROVIDER_CONFIG = PROVIDER_REGISTRY[ACTIVE_PROVIDER]

# Allow model override from env
MODEL = os.getenv("OVERRIDE_MODEL") or PROVIDER_CONFIG["default_model"]

# Resolve API key — optional at startup, required only for agentic endpoints
API_KEY = os.getenv(PROVIDER_CONFIG["api_key_env"])
if not API_KEY:
    print(
        f"[PlacementIQ] WARNING: '{PROVIDER_CONFIG['api_key_env']}' not set. "
        f"Non-agentic endpoints work normally. "
        f"Agentic endpoints (/score/student, /career-paths, /offer-survival, /shocks) will fail until a key is provided."
    )

# ── Business Constants ────────────────────────────────────────────────────────
RECOVERY_COST_INR = int(os.getenv("RECOVERY_COST_INR", 180000))
SHOCK_THRESHOLD_WOW = float(os.getenv("SHOCK_THRESHOLD_WOW", 0.15))

print(f"[PlacementIQ] Provider: {ACTIVE_PROVIDER} | Model: {MODEL}")
