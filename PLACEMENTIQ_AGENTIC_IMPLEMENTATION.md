# PlacementIQ — Agentic AI Full Implementation Plan
## Gemini CLI Execution Guide + Multi-Provider Support

> **How to use this file with Gemini CLI:**
> Run `gemini` in your project root and paste sections or say:
> "Read PLACEMENTIQ_AGENTIC_IMPLEMENTATION.md and create all the files described in it."

---

## Overview

This plan converts PlacementIQ from hardcoded ML + rule tables into a **multi-agent system**
where Claude/Llama/Gemini agents orchestrate your existing XGBoost/LightGBM models as tools.

**Provider support:** Anthropic, OpenRouter, Groq, OpenAI — switchable via a single `.env` variable.

---

## File Tree to Create

```
backend/
├── config.py                          ← NEW: provider + env config
├── agents/
│   ├── __init__.py                    ← NEW
│   ├── provider.py                    ← NEW: multi-provider LLM client
│   ├── tools.py                       ← NEW: tool definitions + executors
│   ├── base_agent.py                  ← NEW: universal agentic loop
│   ├── nba_agent.py                   ← NEW: replaces rule table
│   ├── explainability_agent.py        ← NEW: replaces NLG templates
│   ├── market_agent.py                ← NEW: replaces threshold rules
│   ├── career_path_agent.py           ← NEW: replaces adjacency table
│   └── orchestrator.py               ← NEW: master coordinator
├── main.py                            ← MODIFY: wire orchestrator in
├── .env.example                       ← NEW
└── requirements.txt                   ← MODIFY: add new deps
```

---

## STEP 0 — Install Dependencies

Add to `backend/requirements.txt` (append these lines, keep existing ones):

```
anthropic>=0.40.0
openai>=1.50.0
python-dotenv>=1.0.0
litellm>=1.50.0
httpx>=0.27.0
```

Run:
```bash
cd backend
pip install anthropic openai python-dotenv litellm httpx
```

---

## STEP 1 — Create `backend/.env.example`

```
# ── LLM Provider ──────────────────────────────────────────────────────────────
# Set PROVIDER to one of: anthropic | openrouter | groq | openai
PROVIDER=anthropic

# ── API Keys (only set the one for your chosen provider) ─────────────────────
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...
GROQ_API_KEY=gsk_...
OPENAI_API_KEY=sk-...

# ── Model Overrides (optional — defaults are set per provider in config.py) ───
# OVERRIDE_MODEL=claude-sonnet-4-20250514

# ── PlacementIQ Settings ──────────────────────────────────────────────────────
RECOVERY_COST_INR=180000
SHOCK_THRESHOLD_WOW=0.15
PORT=8001
```

Copy to `.env` and fill in your key:
```bash
cp .env.example .env
```

---

## STEP 2 — Create `backend/config.py`

```python
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
        "default_model": "claude-sonnet-4-20250514",
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
        "default_model": "llama-3.3-70b-versatile",   # Best Groq model for tool use
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

# Resolve API key
API_KEY = os.getenv(PROVIDER_CONFIG["api_key_env"])
if not API_KEY:
    raise EnvironmentError(
        f"Provider '{ACTIVE_PROVIDER}' requires env var "
        f"'{PROVIDER_CONFIG['api_key_env']}' to be set."
    )

# ── Business Constants ────────────────────────────────────────────────────────
RECOVERY_COST_INR = int(os.getenv("RECOVERY_COST_INR", 180000))
SHOCK_THRESHOLD_WOW = float(os.getenv("SHOCK_THRESHOLD_WOW", 0.15))

print(f"[PlacementIQ] Provider: {ACTIVE_PROVIDER} | Model: {MODEL}")
```

---

## STEP 3 — Create `backend/agents/__init__.py`

```python
# backend/agents/__init__.py
"""PlacementIQ Agent Package"""
```

---

## STEP 4 — Create `backend/agents/provider.py`

This is the most important file. It abstracts the LLM call so all agents
work identically regardless of which provider is active.

```python
# backend/agents/provider.py
"""
Universal LLM client for PlacementIQ.
Supports Anthropic SDK (direct) and OpenAI-compatible APIs (Groq, OpenRouter, OpenAI).
Handles tool call format conversion and response parsing for both formats.
"""
import json
import anthropic
from openai import OpenAI
from config import ACTIVE_PROVIDER, PROVIDER_CONFIG, MODEL, API_KEY


# ── Tool Format Converters ────────────────────────────────────────────────────

def _to_openai_tools(anthropic_tools: list) -> list:
    """Convert Anthropic-format tools to OpenAI function-calling format."""
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["input_schema"],
            },
        }
        for t in anthropic_tools
    ]


def _to_anthropic_messages(openai_messages: list) -> list:
    """
    Convert OpenAI-style message list to Anthropic format.
    OpenAI uses role=tool with tool_call_id; Anthropic uses role=user with tool_result blocks.
    This function is used internally when building Anthropic message history.
    """
    # For our use case, messages are always built internally per-provider, so this
    # function handles the conversion when we have tool_result messages.
    converted = []
    for msg in openai_messages:
        if msg["role"] == "tool":
            # Wrap as Anthropic tool_result inside a user turn
            converted.append({
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": msg.get("tool_call_id", "unknown"),
                    "content": msg["content"]
                }]
            })
        else:
            converted.append(msg)
    return converted


# ── Unified LLM Call ──────────────────────────────────────────────────────────

class LLMResponse:
    """Normalized response object — same shape regardless of provider."""
    def __init__(self, text: str = None, tool_calls: list = None, stop_reason: str = "end_turn"):
        self.text = text                  # Final text answer
        self.tool_calls = tool_calls or []  # List of {"id", "name", "input"} dicts
        self.stop_reason = stop_reason    # "end_turn" or "tool_use"


def call_llm(
    system: str,
    messages: list,
    tools: list = None,
    max_tokens: int = 2000
) -> LLMResponse:
    """
    Make a single LLM call. Returns a normalized LLMResponse.
    `messages` should be in a neutral internal format:
      [{"role": "user"|"assistant"|"tool", "content": str, "tool_call_id": ...}]
    """
    tool_format = PROVIDER_CONFIG["tool_format"]

    if tool_format == "anthropic":
        return _call_anthropic(system, messages, tools, max_tokens)
    else:
        return _call_openai_compatible(system, messages, tools, max_tokens)


# ── Anthropic Implementation ──────────────────────────────────────────────────

def _call_anthropic(system, messages, tools, max_tokens) -> LLMResponse:
    client = anthropic.Anthropic(api_key=API_KEY)

    # Build Anthropic message list
    anthropic_messages = []
    for msg in messages:
        role = msg["role"]
        content = msg["content"]

        if role == "tool":
            # Tool result — must be wrapped in user role as tool_result block
            anthropic_messages.append({
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": msg.get("tool_call_id"),
                    "content": content
                }]
            })
        elif role == "assistant" and isinstance(content, list):
            # Assistant message with tool_use blocks (already in Anthropic format)
            anthropic_messages.append({"role": "assistant", "content": content})
        else:
            anthropic_messages.append({"role": role, "content": content})

    kwargs = {
        "model": MODEL,
        "max_tokens": max_tokens,
        "system": system,
        "messages": anthropic_messages,
    }
    if tools:
        kwargs["tools"] = tools  # Already in Anthropic format

    response = client.messages.create(**kwargs)

    # Parse response
    if response.stop_reason == "tool_use":
        tool_calls = []
        text_parts = []
        for block in response.content:
            if block.type == "tool_use":
                tool_calls.append({
                    "id": block.id,
                    "name": block.name,
                    "input": block.input,
                    "_raw_block": block  # Keep for message reconstruction
                })
            elif hasattr(block, "text"):
                text_parts.append(block.text)
        return LLMResponse(
            text=" ".join(text_parts) if text_parts else None,
            tool_calls=tool_calls,
            stop_reason="tool_use"
        )
    else:
        text = " ".join(b.text for b in response.content if hasattr(b, "text"))
        return LLMResponse(text=text, stop_reason="end_turn")


# ── OpenAI-Compatible Implementation (Groq, OpenRouter, OpenAI) ───────────────

def _call_openai_compatible(system, messages, tools, max_tokens) -> LLMResponse:
    extra_headers = PROVIDER_CONFIG.get("extra_headers", {})
    client = OpenAI(
        api_key=API_KEY,
        base_url=PROVIDER_CONFIG["base_url"],
        default_headers=extra_headers
    )

    # Build OpenAI message list
    openai_messages = [{"role": "system", "content": system}]
    for msg in messages:
        role = msg["role"]
        if role == "tool":
            openai_messages.append({
                "role": "tool",
                "tool_call_id": msg.get("tool_call_id"),
                "content": msg["content"]
            })
        elif role == "assistant" and "tool_calls" in msg:
            openai_messages.append({
                "role": "assistant",
                "content": msg.get("content"),
                "tool_calls": msg["tool_calls"]
            })
        else:
            openai_messages.append({"role": role, "content": msg["content"]})

    kwargs = {
        "model": MODEL,
        "max_tokens": max_tokens,
        "messages": openai_messages,
    }
    if tools:
        kwargs["tools"] = _to_openai_tools(tools)
        kwargs["tool_choice"] = "auto"

    response = client.chat.completions.create(**kwargs)
    choice = response.choices[0]
    message = choice.message

    if choice.finish_reason == "tool_calls" and message.tool_calls:
        tool_calls = []
        for tc in message.tool_calls:
            tool_calls.append({
                "id": tc.id,
                "name": tc.function.name,
                "input": json.loads(tc.function.arguments),
                "_raw_openai": tc  # Keep for message reconstruction
            })
        return LLMResponse(
            text=message.content,
            tool_calls=tool_calls,
            stop_reason="tool_use"
        )
    else:
        return LLMResponse(text=message.content, stop_reason="end_turn")
```

---

## STEP 5 — Create `backend/agents/tools.py`

All tool definitions + their executor functions. Agents call `execute_tool(name, input)`.

```python
# backend/agents/tools.py
"""
PlacementIQ Tool Registry.
TOOL_DEFINITIONS: list of tool specs in Anthropic format (auto-converted for other providers).
execute_tool(): dispatches tool name → actual Python function.
"""
import json
import os
import pandas as pd
import numpy as np

# Lazy-load scoring engine to avoid circular imports
_engine = None
_df = None

def _get_engine():
    global _engine
    if _engine is None:
        from scoring_engine import ScoringEngine
        _engine = ScoringEngine()
    return _engine

def _get_df():
    global _df
    if _df is None:
        csv_path = os.path.join(os.path.dirname(__file__), "..", "data", "synthetic_students.csv")
        _df = pd.read_csv(csv_path)
    return _df


# ── Tool Definitions (Anthropic format — auto-converted for other providers) ──

TOOL_DEFINITIONS = [
    {
        "name": "predict_placement_probability",
        "description": (
            "Run the XGBoost placement model to get placement probabilities at 3m/6m/12m "
            "horizons for a student given their feature vector. Also returns raw risk_band "
            "and confidence score from the model."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "student_features": {
                    "type": "object",
                    "description": (
                        "Feature dict with keys: cgpa (float 0-10), iqi (float 0-1), "
                        "field_demand_score (float 0-100), macro_climate_index (float 0-1), "
                        "institute_tier_score (float 1-10), behavioral_activity_score (float 0-100), "
                        "peer_velocity (float 0-1), course_type (str), institute_tier (str A/B/C/D), "
                        "region (str)."
                    )
                }
            },
            "required": ["student_features"]
        }
    },
    {
        "name": "estimate_salary_range",
        "description": (
            "Run LightGBM quantile regression to estimate expected starting salary "
            "range (low/median/high) in INR/month for a student. Use this to compute "
            "the EMI Comfort Ratio."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "student_features": {"type": "object"},
                "course_type": {
                    "type": "string",
                    "enum": ["Engineering", "MBA", "Nursing", "Architecture", "Law", "Pharmacy"]
                },
                "region": {
                    "type": "string",
                    "description": "City/region in India, e.g. Pune, Bengaluru, Mumbai, Delhi, Hyderabad"
                }
            },
            "required": ["student_features", "course_type", "region"]
        }
    },
    {
        "name": "get_shap_drivers",
        "description": (
            "Fetch top-5 SHAP feature attributions for a student. Returns feature name, "
            "SHAP value (positive = reduces risk, negative = increases risk), and the "
            "student's actual value for that feature. Use this to identify root causes."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "student_id": {"type": "string"}
            },
            "required": ["student_id"]
        }
    },
    {
        "name": "get_peer_cohort_stats",
        "description": (
            "Get aggregated cohort statistics for students with the same course type, "
            "institute tier, and graduation year. Returns median/quartile placement "
            "probabilities, median IQI, median behavioral score. Use to benchmark student."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "course_type": {"type": "string"},
                "institute_tier": {"type": "string", "enum": ["A", "B", "C", "D"]},
                "graduation_year": {"type": "integer"}
            },
            "required": ["course_type", "institute_tier", "graduation_year"]
        }
    },
    {
        "name": "get_intervention_cost_table",
        "description": (
            "Returns the full intervention catalog with: intervention type, cost in INR, "
            "average placement probability lift in percentage points (pp), and typical "
            "completion duration in days. Filter by course_type and relevant risk drivers."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "course_type": {"type": "string"},
                "risk_drivers": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Top negative SHAP driver names to filter relevant interventions"
                }
            },
            "required": ["course_type"]
        }
    },
    {
        "name": "get_emi_data",
        "description": (
            "Get a student's monthly EMI obligation and their predicted median salary "
            "to allow EMI Comfort Ratio calculation. Also returns emi_start_date."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "student_id": {"type": "string"}
            },
            "required": ["student_id"]
        }
    },
    {
        "name": "get_labor_market_data",
        "description": (
            "Fetch current labor market data for a field+region combination. Returns: "
            "demand_index (0-100), yoy_change (fraction, negative = decline), "
            "top_hiring_companies, recent_layoff_events list, job_openings_per_graduate, "
            "and a 4-week trend array. Use for Shock Detector and Career Path scoring."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "field": {
                    "type": "string",
                    "description": "e.g. 'Software Engineering', 'MBA-Finance', 'Mechanical Engineering', 'Nursing'"
                },
                "region": {
                    "type": "string",
                    "description": "e.g. 'Pune', 'Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai'"
                }
            },
            "required": ["field", "region"]
        }
    },
    {
        "name": "get_adjacent_fields",
        "description": (
            "Given a primary academic field, return a list of adjacent/pivot career fields "
            "that the student could transition to based on their academic background. "
            "Returns field names, skill overlap percentage, and typical transition effort."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "primary_field": {"type": "string"},
                "course_type": {"type": "string"}
            },
            "required": ["primary_field", "course_type"]
        }
    },
    {
        "name": "get_company_health_signals",
        "description": (
            "Fetch financial health signals for a hiring company. Returns: "
            "funding_status, headcount_trend_6m (fraction), glassdoor_rating_trend "
            "(from/to), layoff_announced (bool), active_job_postings (bool). "
            "Use for Offer Survival Score calculation."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "company_name": {"type": "string"},
                "student_id": {
                    "type": "string",
                    "description": "Optional — used to fetch the specific company from the student's offer record"
                }
            },
            "required": ["company_name"]
        }
    },
    {
        "name": "get_institute_momentum",
        "description": (
            "Get the Institute Momentum Index for a given institute. Returns: "
            "momentum_ratio (30d/90d recruiter visits), offer_momentum (30d/90d offers), "
            "momentum_flag (bool), and adjustment_pct applied to institute tier score."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "institute_id": {"type": "string"}
            },
            "required": ["institute_id"]
        }
    },
]


# ── Tool Executors ────────────────────────────────────────────────────────────

def execute_tool(tool_name: str, tool_input: dict) -> str:
    """Dispatch a tool call to its implementation. Always returns a JSON string."""
    try:
        result = _dispatch(tool_name, tool_input)
        return json.dumps(result)
    except Exception as e:
        return json.dumps({"error": str(e), "tool": tool_name})


def _dispatch(name: str, inp: dict) -> dict:
    if name == "predict_placement_probability":
        engine = _get_engine()
        features = inp["student_features"]
        result = engine.predict(features)
        return {
            "placement_probability": result.get("placement_probability", {
                "within_3_months": 0.45,
                "within_6_months": 0.70,
                "within_12_months": 0.88
            }),
            "risk_band": result.get("risk_band", "MEDIUM"),
            "risk_score": result.get("risk_score", 50),
        }

    elif name == "estimate_salary_range":
        engine = _get_engine()
        result = engine.estimate_salary(
            inp["student_features"],
            inp.get("course_type", "Engineering"),
            inp.get("region", "Pune")
        )
        return result or {"low": 35000, "median": 55000, "high": 80000, "currency": "INR"}

    elif name == "get_shap_drivers":
        engine = _get_engine()
        student_id = inp["student_id"]
        try:
            shap = engine.get_shap_values(student_id)
        except Exception:
            # Fallback synthetic SHAP for demo
            shap = [
                {"feature": "institute_tier_score", "shap_value": -0.12, "student_value": 4.2,
                 "readable_name": "Institute Tier", "direction": "negative"},
                {"feature": "iqi", "shap_value": -0.09, "student_value": 0.25,
                 "readable_name": "Internship Quality Index", "direction": "negative"},
                {"feature": "field_demand_score", "shap_value": -0.08, "student_value": 28.0,
                 "readable_name": "Field Demand Score", "direction": "negative"},
                {"feature": "behavioral_activity_score", "shap_value": 0.06, "student_value": 72.0,
                 "readable_name": "Behavioral Activity Score", "direction": "positive"},
                {"feature": "cgpa", "shap_value": 0.04, "student_value": 7.8,
                 "readable_name": "CGPA", "direction": "positive"},
            ]
        return {"student_id": student_id, "top_drivers": shap}

    elif name == "get_peer_cohort_stats":
        df = _get_df()
        cohort = df[
            (df["course_type"] == inp["course_type"]) &
            (df["institute_tier"] == inp["institute_tier"])
        ]
        if len(cohort) == 0:
            return {"error": "No matching cohort found", "cohort_size": 0}
        return {
            "cohort_size": len(cohort),
            "median_placement_6m": float(cohort.get("placement_6m_prob", pd.Series([0.65])).median()),
            "top_quartile_placement_6m": float(cohort.get("placement_6m_prob", pd.Series([0.82])).quantile(0.75)),
            "median_iqi": float(cohort.get("iqi", pd.Series([0.55])).median()),
            "median_behavioral_score": float(cohort.get("behavioral_activity_score", pd.Series([60])).median()),
            "median_cgpa": float(cohort.get("cgpa", pd.Series([7.2])).median()),
        }

    elif name == "get_intervention_cost_table":
        course = inp.get("course_type", "Engineering")
        drivers = inp.get("risk_drivers", [])
        # Full intervention catalog
        catalog = {
            "SKILL_UP_PYTHON_ANALYTICS": {
                "cost_inr": 2000, "avg_pp_lift": 9, "duration_days": 30,
                "best_for": ["iqi", "behavioral_activity_score", "field_demand_score"],
                "courses": ["Engineering", "MBA"]
            },
            "SKILL_UP_DATA_ANALYTICS": {
                "cost_inr": 3500, "avg_pp_lift": 11, "duration_days": 45,
                "best_for": ["iqi", "field_demand_score"],
                "courses": ["Engineering", "MBA"]
            },
            "MOCK_INTERVIEW_X2": {
                "cost_inr": 0, "avg_pp_lift": 6, "duration_days": 14,
                "best_for": ["behavioral_activity_score"],
                "courses": ["Engineering", "MBA", "Nursing", "Law"]
            },
            "RESUME_REVIEW": {
                "cost_inr": 500, "avg_pp_lift": 4, "duration_days": 7,
                "best_for": ["behavioral_activity_score"],
                "courses": ["Engineering", "MBA", "Nursing"]
            },
            "INTERNSHIP_REFERRAL": {
                "cost_inr": 0, "avg_pp_lift": 13, "duration_days": 60,
                "best_for": ["iqi"],
                "courses": ["Engineering", "MBA"]
            },
            "CAREER_COUNSELLING_SESSION": {
                "cost_inr": 1000, "avg_pp_lift": 5, "duration_days": 3,
                "best_for": ["field_demand_score", "behavioral_activity_score"],
                "courses": ["Engineering", "MBA", "Nursing", "Architecture"]
            },
            "CLINICAL_PLACEMENT_CONNECT": {
                "cost_inr": 0, "avg_pp_lift": 10, "duration_days": 30,
                "best_for": ["iqi", "field_demand_score"],
                "courses": ["Nursing", "Pharmacy"]
            },
            "CASE_MANAGER_ASSIGNMENT": {
                "cost_inr": 0, "avg_pp_lift": 3, "duration_days": 1,
                "best_for": ["institute_tier_score", "macro_climate_index"],
                "courses": ["Engineering", "MBA", "Nursing", "Architecture", "Law", "Pharmacy"]
            },
            "EMI_GRACE_REVIEW": {
                "cost_inr": 0, "avg_pp_lift": 0, "duration_days": 1,
                "best_for": ["emi_comfort"],
                "courses": ["Engineering", "MBA", "Nursing", "Architecture", "Law", "Pharmacy"]
            },
            "SALARY_NEGOTIATION_COACHING": {
                "cost_inr": 800, "avg_pp_lift": 2, "duration_days": 7,
                "best_for": ["emi_comfort"],
                "courses": ["Engineering", "MBA"]
            },
        }
        # Filter by course
        filtered = {k: v for k, v in catalog.items() if course in v.get("courses", [])}
        return {"interventions": filtered, "course_type": course}

    elif name == "get_emi_data":
        student_id = inp["student_id"]
        df = _get_df()
        student_rows = df[df["student_id"] == student_id]
        if len(student_rows) > 0:
            row = student_rows.iloc[0]
            emi = float(row.get("monthly_emi", 18000))
            salary = float(row.get("predicted_salary_median", 55000))
        else:
            emi, salary = 18000, 55000
        return {
            "student_id": student_id,
            "monthly_emi_inr": emi,
            "predicted_median_salary_inr": salary,
            "emi_comfort_ratio": round(salary / emi, 2) if emi > 0 else None,
            "emi_start_date": "2026-09-01"
        }

    elif name == "get_labor_market_data":
        field = inp["field"]
        region = inp["region"]
        # Synthetic labor market data — replace with NAUKRI/LinkedIn API in production
        import random
        rng = random.Random(hash(f"{field}{region}") % 10000)
        base_demand = rng.randint(25, 85)
        yoy = round(rng.uniform(-0.20, 0.15), 3)
        return {
            "field": field,
            "region": region,
            "demand_index": base_demand,
            "yoy_change": yoy,
            "wow_change": round(rng.uniform(-0.12, 0.08), 3),
            "job_openings_per_graduate": round(rng.uniform(0.8, 4.5), 1),
            "top_hiring_companies": ["TCS", "Infosys", "Wipro", "HCL"][:rng.randint(1, 4)],
            "recent_layoff_events": (
                [{"company": "TechCorp", "count": 1200, "date": "2026-04-15"}]
                if yoy < -0.10 else []
            ),
            "4week_trend": [base_demand + rng.randint(-5, 5) for _ in range(4)],
        }

    elif name == "get_adjacent_fields":
        primary = inp["primary_field"].lower()
        adjacency_map = {
            "mechanical engineering": [
                {"field": "Supply Chain Management", "overlap_pct": 72, "transition_effort": "Low"},
                {"field": "Quality Assurance Engineering", "overlap_pct": 68, "transition_effort": "Low"},
                {"field": "Operations Management", "overlap_pct": 61, "transition_effort": "Medium"},
                {"field": "Manufacturing Consulting", "overlap_pct": 55, "transition_effort": "Medium"},
                {"field": "Product Management", "overlap_pct": 48, "transition_effort": "High"},
            ],
            "civil engineering": [
                {"field": "Urban Planning", "overlap_pct": 70, "transition_effort": "Low"},
                {"field": "Real Estate Consulting", "overlap_pct": 65, "transition_effort": "Low"},
                {"field": "Infrastructure Project Management", "overlap_pct": 80, "transition_effort": "Low"},
                {"field": "Environmental Consulting", "overlap_pct": 55, "transition_effort": "Medium"},
            ],
            "electrical engineering": [
                {"field": "Embedded Systems", "overlap_pct": 82, "transition_effort": "Low"},
                {"field": "Power Systems Consulting", "overlap_pct": 75, "transition_effort": "Low"},
                {"field": "IoT Solutions", "overlap_pct": 65, "transition_effort": "Medium"},
                {"field": "Data Centre Operations", "overlap_pct": 55, "transition_effort": "Medium"},
            ],
            "mba-finance": [
                {"field": "Financial Technology (FinTech)", "overlap_pct": 78, "transition_effort": "Low"},
                {"field": "Risk Management", "overlap_pct": 85, "transition_effort": "Low"},
                {"field": "Investment Banking", "overlap_pct": 90, "transition_effort": "Low"},
                {"field": "Corporate Strategy", "overlap_pct": 72, "transition_effort": "Medium"},
            ],
            "nursing": [
                {"field": "Healthcare Administration", "overlap_pct": 70, "transition_effort": "Medium"},
                {"field": "Medical Coding & Billing", "overlap_pct": 60, "transition_effort": "Low"},
                {"field": "Clinical Research Coordinator", "overlap_pct": 75, "transition_effort": "Low"},
                {"field": "Health Informatics", "overlap_pct": 55, "transition_effort": "High"},
            ],
        }
        for key in adjacency_map:
            if key in primary or primary in key:
                return {"primary_field": inp["primary_field"], "adjacent_fields": adjacency_map[key]}
        return {
            "primary_field": inp["primary_field"],
            "adjacent_fields": [
                {"field": "Business Analytics", "overlap_pct": 55, "transition_effort": "Medium"},
                {"field": "Project Management", "overlap_pct": 60, "transition_effort": "Low"},
                {"field": "Operations Research", "overlap_pct": 50, "transition_effort": "Medium"},
            ]
        }

    elif name == "get_company_health_signals":
        company = inp["company_name"]
        # Synthetic — replace with Tracxn/Crunchbase/LinkedIn API in production
        import random
        rng = random.Random(hash(company) % 10000)
        health_score = rng.randint(30, 95)
        return {
            "company_name": company,
            "funding_status": rng.choice([
                "Series B - active", "Series C - recent", "Profitable - no funding needed",
                "Series A - early stage", "Series B - 8 months overdue"
            ]),
            "headcount_trend_6m": round(rng.uniform(-0.25, 0.20), 3),
            "glassdoor_rating_trend": {
                "from": round(rng.uniform(3.0, 4.5), 1),
                "to": round(rng.uniform(2.8, 4.5), 1)
            },
            "layoff_announced": rng.random() < 0.15,
            "active_job_postings": rng.random() > 0.2,
            "overall_health_score": health_score,
        }

    elif name == "get_institute_momentum":
        institute_id = inp["institute_id"]
        import random
        rng = random.Random(hash(institute_id) % 10000)
        ratio = round(rng.uniform(0.45, 1.55), 2)
        return {
            "institute_id": institute_id,
            "recruiter_momentum_ratio": ratio,
            "offer_momentum_ratio": round(rng.uniform(0.50, 1.50), 2),
            "momentum_flag": ratio < 0.6,
            "adjustment_pct": -15 if ratio < 0.6 else (10 if ratio > 1.4 else 0),
            "last_updated": "2026-05-01"
        }

    raise ValueError(f"Unknown tool: {name}")
```

---

## STEP 6 — Create `backend/agents/base_agent.py`

The universal agentic loop. Works with any provider.

```python
# backend/agents/base_agent.py
"""
Provider-agnostic agentic loop.
Calls LLM, handles tool use, feeds results back, loops until done.
"""
import json
from provider import call_llm, LLMResponse
from tools import execute_tool, TOOL_DEFINITIONS
import config


def run_agent(
    system_prompt: str,
    user_message: str,
    tools: list = None,
    max_iterations: int = 6,
) -> str:
    """
    Agentic loop: runs the LLM until it produces a final text response.
    The agent may call tools multiple times before answering.

    Args:
        system_prompt: Role + rules for this agent
        user_message: Task description with student context
        tools: List of tool definitions (defaults to TOOL_DEFINITIONS)
        max_iterations: Safety cap on tool-call rounds

    Returns:
        Final text response from the agent
    """
    if tools is None:
        tools = TOOL_DEFINITIONS

    messages = [{"role": "user", "content": user_message}]

    for iteration in range(max_iterations):
        response: LLMResponse = call_llm(
            system=system_prompt,
            messages=messages,
            tools=tools,
            max_tokens=2000
        )

        # Agent is done — return final answer
        if response.stop_reason == "end_turn":
            return response.text or ""

        # Agent wants to call tools
        if response.stop_reason == "tool_use" and response.tool_calls:
            # Add assistant turn to history (format depends on provider)
            _append_assistant_turn(messages, response, config.PROVIDER_CONFIG["tool_format"])

            # Execute each requested tool and collect results
            tool_results = []
            for tc in response.tool_calls:
                result_str = execute_tool(tc["name"], tc["input"])
                print(f"  [Tool] {tc['name']}({list(tc['input'].keys())}) → {result_str[:120]}...")
                tool_results.append({
                    "tool_call_id": tc["id"],
                    "result": result_str,
                    "tool_name": tc["name"]
                })

            # Add tool results to message history
            _append_tool_results(messages, tool_results, config.PROVIDER_CONFIG["tool_format"])
            continue

        # Unexpected stop
        break

    return response.text or "Agent did not produce a final answer within iteration limit."


def _append_assistant_turn(messages: list, response: LLMResponse, tool_format: str):
    """Append the assistant's tool-calling turn in the correct format for the provider."""
    if tool_format == "anthropic":
        # Anthropic: assistant content is a list of blocks
        content_blocks = []
        if response.text:
            content_blocks.append({"type": "text", "text": response.text})
        for tc in response.tool_calls:
            content_blocks.append({
                "type": "tool_use",
                "id": tc["id"],
                "name": tc["name"],
                "input": tc["input"]
            })
        messages.append({"role": "assistant", "content": content_blocks})
    else:
        # OpenAI format: tool_calls array
        openai_tool_calls = []
        for tc in response.tool_calls:
            openai_tool_calls.append({
                "id": tc["id"],
                "type": "function",
                "function": {
                    "name": tc["name"],
                    "arguments": json.dumps(tc["input"])
                }
            })
        messages.append({
            "role": "assistant",
            "content": response.text,
            "tool_calls": openai_tool_calls
        })


def _append_tool_results(messages: list, tool_results: list, tool_format: str):
    """Append tool results to message history in the correct format for the provider."""
    if tool_format == "anthropic":
        # Anthropic: all results go in a single user message as tool_result blocks
        result_blocks = []
        for tr in tool_results:
            result_blocks.append({
                "type": "tool_result",
                "tool_use_id": tr["tool_call_id"],
                "content": tr["result"]
            })
        messages.append({"role": "user", "content": result_blocks})
    else:
        # OpenAI: each result is a separate "tool" role message
        for tr in tool_results:
            messages.append({
                "role": "tool",
                "tool_call_id": tr["tool_call_id"],
                "content": tr["result"]
            })
```

---

## STEP 7 — Create `backend/agents/nba_agent.py`

Replaces the hardcoded rule table in PRD Section 13.

```python
# backend/agents/nba_agent.py
"""
NBA (Next-Best-Action) Agent.
Replaces the PRD Section 13 rule table with dynamic, context-aware reasoning.
"""
import json
from base_agent import run_agent
from tools import TOOL_DEFINITIONS
import config

NBA_SYSTEM_PROMPT = f"""
You are the NBA (Next-Best-Action) Agent for PlacementIQ — an education loan risk platform.
Your job: recommend the highest-ROI, cost-aware interventions for an at-risk student.

REASONING PROCESS (follow in order):
1. Call get_shap_drivers to identify root cause risk factors
2. Call get_emi_data to understand financial urgency (EMI Comfort Ratio)
3. Call get_intervention_cost_table with the student's course_type and the top negative driver names
4. Reason about the combination of risk factors — address root causes, not symptoms
5. Rank interventions by: (pp_lift × default_risk_reduction_pct) / cost_inr
   For zero-cost interventions, rank by pp_lift alone
6. Select at most 3 interventions — never recommend more (decision fatigue kills completion)

HARD RULES (always apply, no exceptions):
- If EMI Comfort Ratio < 1.0 → EMI_GRACE_REVIEW is ALWAYS the first action
- If behavioral_activity_score < 40 → job search coaching before skill-up courses
- If field_demand_score < 30 → include career counselling or alternate path recommendation
- If iqi < 0.3 → internship referral outranks skill-up courses
- Never recommend a 45-day course if graduation is within 30 days
- Recovery cost avoided = default_risk_reduction_pct × {config.RECOVERY_COST_INR}
- ROI = recovery_cost_avoided / course_cost_inr (infinity for free interventions → label as "∞")

OUTPUT: Return ONLY valid JSON in this exact structure (no markdown, no preamble):
{{
  "reasoning": "2-3 sentence plain-English assessment of why this student is at risk and what the priority is",
  "actions": [
    {{
      "rank": 1,
      "action_type": "SKILL_UP | MOCK_INTERVIEW | EMI_GRACE_REVIEW | INTERNSHIP_REFERRAL | CAREER_COUNSELLING | CASE_MANAGER | SALARY_NEGOTIATION",
      "detail": "Specific recommendation text — name the course, the mock interview source, etc.",
      "estimated_pp_lift": 9,
      "cost_inr": 2000,
      "default_risk_reduction_pct": 12,
      "roi_label": "10.8x",
      "rationale": "One sentence: why THIS action for THIS specific student's situation"
    }}
  ]
}}
"""

def get_nba_recommendations(student_id: str, student_context: dict) -> dict:
    """
    Generate Next-Best-Action recommendations for a student.
    Returns parsed dict with reasoning + ranked actions list.
    """
    user_message = f"""
Generate Next-Best-Action recommendations for student: {student_id}

Student profile:
- Course type: {student_context.get('course_type', 'Unknown')}
- Institute tier: {student_context.get('institute_tier', 'Unknown')}
- Region: {student_context.get('region', 'Unknown')}
- Current risk band: {student_context.get('risk_band', 'MEDIUM')}
- CGPA: {student_context.get('cgpa', 'N/A')}
- IQI (Internship Quality Index): {student_context.get('iqi', 'N/A')}
- Behavioral activity score: {student_context.get('behavioral_activity_score', 'N/A')}
- Field demand score: {student_context.get('field_demand_score', 'N/A')}
- Months to graduation: {student_context.get('months_to_graduation', 'N/A')}
- Peer velocity (cohort placement rate): {student_context.get('peer_velocity', 'N/A')}
- 6-month placement probability: {student_context.get('placement_6m', 'N/A')}

Steps:
1. Call get_shap_drivers for student {student_id}
2. Call get_emi_data for student {student_id}
3. Call get_intervention_cost_table for course_type="{student_context.get('course_type', 'Engineering')}"
4. Produce ranked NBA JSON output
"""

    raw = run_agent(NBA_SYSTEM_PROMPT, user_message, TOOL_DEFINITIONS)

    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        return json.loads(raw[start:end])
    except (json.JSONDecodeError, ValueError):
        return {
            "reasoning": raw[:300] if raw else "Agent could not generate recommendations.",
            "actions": []
        }
```

---

## STEP 8 — Create `backend/agents/explainability_agent.py`

Replaces NLG template strings with contextual, cohort-aware narratives.

```python
# backend/agents/explainability_agent.py
"""
Explainability Agent.
Converts SHAP values + cohort stats into human-readable risk narratives.
Replaces hardcoded NLG template strings.
"""
import json
from base_agent import run_agent
from tools import TOOL_DEFINITIONS

EXPLAIN_SYSTEM_PROMPT = """
You are the Explainability Agent for PlacementIQ — an AI risk system for education loans.
Your job: translate raw SHAP values and model scores into clear, specific, actionable
narratives for non-technical Relationship Managers and compliance auditors.

WRITING RULES (strictly follow):
- Never mention "the model", "the algorithm", or "SHAP values" — speak about the student's actual situation
- Be specific with numbers: say "IQI of 0.25 vs cohort median of 0.55" not "low internship quality"
- Always contextualize against the cohort, not in isolation
- Acknowledge positive factors genuinely — don't bury good news in a list of risks
- Summary must be under 80 words — relationship managers read dozens of these
- If risk is HIGH, end with ONE urgent action sentence
- If data gaps limit confidence, mention it once at the end

TOOL USAGE:
1. Call get_shap_drivers to get the actual feature attributions
2. Call get_peer_cohort_stats to get the cohort benchmark for comparison
3. Write the narrative using both

OUTPUT: Return ONLY valid JSON (no markdown, no preamble):
{
  "summary": "Plain-English risk narrative under 80 words",
  "positive_factors": ["Specific positive factor with student's actual value"],
  "negative_factors": ["Specific negative factor with student's value vs cohort median"],
  "urgency_note": "One urgent action sentence for HIGH risk, or null for LOW/MEDIUM"
}
"""

def generate_explainability_narrative(student_id: str, student_context: dict) -> dict:
    user_message = f"""
Generate an explainability narrative for student {student_id}.

Current prediction outputs:
- Risk band: {student_context.get('risk_band')}
- Placement probability (6m): {student_context.get('placement_6m')}
- Peer percentile: {student_context.get('peer_percentile')}th percentile in their cohort
- EMI Comfort Ratio: {student_context.get('emi_comfort_ratio')}
- Confidence level: {student_context.get('confidence_level', 'MEDIUM')}

Student data:
- Course type: {student_context.get('course_type')}
- Institute tier: {student_context.get('institute_tier')}
- Graduation year: {student_context.get('graduation_year', 2026)}
- CGPA: {student_context.get('cgpa')}
- IQI: {student_context.get('iqi')}
- Behavioral activity: {student_context.get('behavioral_activity_score')}
- Field demand: {student_context.get('field_demand_score')}

Steps:
1. Call get_shap_drivers for student {student_id}
2. Call get_peer_cohort_stats: course_type="{student_context.get('course_type', 'Engineering')}",
   institute_tier="{student_context.get('institute_tier', 'B')}",
   graduation_year={student_context.get('graduation_year', 2026)}
3. Write the narrative JSON
"""

    raw = run_agent(EXPLAIN_SYSTEM_PROMPT, user_message, TOOL_DEFINITIONS)

    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        return json.loads(raw[start:end])
    except (json.JSONDecodeError, ValueError):
        return {
            "summary": raw[:300] if raw else "Explainability narrative unavailable.",
            "positive_factors": [],
            "negative_factors": [],
            "urgency_note": None
        }
```

---

## STEP 9 — Create `backend/agents/market_agent.py`

Replaces the 15% WoW threshold rule with reasoning-based severity assessment.

```python
# backend/agents/market_agent.py
"""
Market Intelligence Agent.
Replaces hardcoded threshold triggers in the Placement Shock Detector.
Reasons about severity, distinguishes seasonal dips from genuine shocks.
"""
import json
from base_agent import run_agent
from tools import TOOL_DEFINITIONS
import config

MARKET_SYSTEM_PROMPT = f"""
You are the Market Intelligence Agent for PlacementIQ.
Monitor labor market signals and assess placement shock severity for student portfolios.

SEVERITY SCALE:
- NORMAL: Demand stable or minor fluctuation (<5% WoW). No action needed.
- WATCH: Demand declining 5–10% WoW OR 1–2 minor layoff events. Flag for awareness.
- ALERT: Demand down 10–15% WoW OR 1 major layoff event (500+ employees). Escalate to RM.
- SHOCK: Demand down 15%+ WoW OR 1,000+ layoffs at a major employer. Emergency escalation.

REASONING GUIDELINES:
- Distinguish seasonal dips from structural decline (use YoY not just WoW alone)
- A single company's troubles ≠ sector shock unless they are a top-5 employer in that field
- Consider whether the field has high student concentration in the portfolio
- When WoW and YoY disagree, weight YoY more heavily (seasonal filter)
- Only trigger SHOCK if you are confident — false positives cause alert fatigue

TOOL USAGE:
1. Call get_labor_market_data for the field+region combination
2. Reason about severity using both WoW and YoY signals
3. Output your assessment

OUTPUT: Valid JSON only (no markdown):
{{
  "field": "...",
  "region": "...",
  "severity": "NORMAL | WATCH | ALERT | SHOCK",
  "demand_index": 65,
  "wow_change": -0.12,
  "yoy_change": -0.08,
  "trigger_reason": "Specific reason or null",
  "confidence": "HIGH | MEDIUM | LOW",
  "recommended_action": "What the lender risk team should do now",
  "affected_segment_description": "Which students are most exposed"
}}
"""

def assess_market_shock(field: str, region: str) -> dict:
    user_message = f"""
Assess current placement shock severity for:
- Field: {field}
- Region: {region}

Call get_labor_market_data, then provide your severity assessment.
"""
    raw = run_agent(MARKET_SYSTEM_PROMPT, user_message, TOOL_DEFINITIONS)
    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        return json.loads(raw[start:end])
    except (json.JSONDecodeError, ValueError):
        return {"field": field, "region": region, "severity": "NORMAL",
                "trigger_reason": "Assessment unavailable", "confidence": "LOW"}


def scan_portfolio_for_shocks(field_region_pairs: list) -> list:
    """
    Scan multiple field+region combinations and return only non-NORMAL ones.
    field_region_pairs: list of {"field": str, "region": str}
    """
    results = []
    for pair in field_region_pairs:
        assessment = assess_market_shock(pair["field"], pair["region"])
        if assessment.get("severity", "NORMAL") != "NORMAL":
            results.append(assessment)
    return results
```

---

## STEP 10 — Create `backend/agents/career_path_agent.py`

Replaces static adjacency table with demand-aware, geography-filtered reasoning.

```python
# backend/agents/career_path_agent.py
"""
Career Path Agent.
Replaces the static role-adjacency mapping table in PRD Section 10.4.
Fetches adjacent fields AND their current demand in the student's region.
"""
import json
from base_agent import run_agent
from tools import TOOL_DEFINITIONS

CAREER_SYSTEM_PROMPT = """
You are the Career Path Agent for PlacementIQ.
When a student's primary field has weak demand, recommend adjacent career pivots
that are (a) compatible with their academic background and (b) have strong current demand
in their specific region.

TOOL USAGE:
1. Call get_adjacent_fields to get academically compatible pivot options
2. For each adjacent field (up to 4), call get_labor_market_data with the student's region
3. Rank pivots by: demand_index × (overlap_pct / 100) — the "reachability-weighted demand" score
4. Only recommend pivots where demand_index > 40 AND overlap_pct > 50
5. Include the skill gap each pivot requires (inferred from overlap_pct)

WRITING RULES:
- Be concrete about why each pivot fits this student's background
- Include demand_index and salary_match as numbers
- Mention what specific skills/certifications bridge the gap
- If no pivots score well (all demand < 40), recommend geographic mobility as an option

OUTPUT: Valid JSON only:
{
  "primary_field": "...",
  "primary_demand_index": 28,
  "primary_demand_assessment": "One sentence on why the primary field is weak",
  "recommended_pivots": [
    {
      "rank": 1,
      "field": "Supply Chain Management",
      "demand_index": 71,
      "overlap_pct": 72,
      "reachability_score": 51.1,
      "transition_effort": "Low | Medium | High",
      "bridge_skills": ["Excel Advanced", "SAP Basics"],
      "rationale": "Why this pivot specifically for this student"
    }
  ]
}
"""

def get_career_path_recommendations(student_id: str, student_context: dict) -> dict:
    user_message = f"""
Generate alternative career path recommendations for student {student_id}.

Student profile:
- Primary field: {student_context.get('field', student_context.get('course_type'))}
- Course type: {student_context.get('course_type')}
- Region: {student_context.get('region')}
- Field demand score (primary): {student_context.get('field_demand_score')} / 100
- CGPA: {student_context.get('cgpa')}
- Certifications: {student_context.get('certifications', 'None listed')}

Steps:
1. Call get_adjacent_fields: primary_field="{student_context.get('field', '')}",
   course_type="{student_context.get('course_type', '')}"
2. For top 4 adjacent fields, call get_labor_market_data with region="{student_context.get('region', 'Pune')}"
3. Rank and filter pivots, output JSON
"""
    raw = run_agent(CAREER_SYSTEM_PROMPT, user_message, TOOL_DEFINITIONS)
    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        return json.loads(raw[start:end])
    except (json.JSONDecodeError, ValueError):
        return {"primary_field": student_context.get("field", ""), "recommended_pivots": []}
```

---

## STEP 11 — Create `backend/agents/offer_survival_agent.py`

Phase 3 feature — agent-driven Offer Survival Score.

```python
# backend/agents/offer_survival_agent.py
"""
Offer Survival Agent.
Scores P(offer not revoked in 60 days) by reasoning about company health signals.
Replaces the gradient boosted classifier approach with LLM reasoning over signals.
"""
import json
from base_agent import run_agent
from tools import TOOL_DEFINITIONS

OFFER_SURVIVAL_SYSTEM_PROMPT = """
You are the Offer Survival Agent for PlacementIQ.
A student has received a job offer. Your job: assess whether that offer is at risk
of revocation within the next 60 days based on the hiring company's financial health.

SIGNAL WEIGHTS (use for scoring, not as rigid rules):
- Headcount declined > 15% in 6 months: Very High Risk (-25 points from 100)
- Funding round overdue by > 6 months: High Risk (-20 points)
- Glassdoor rating dropped > 0.5 points in 90 days: Moderate Risk (-15 points)
- Layoff announced: Very High Risk (-30 points)
- Active job postings ongoing: Weak positive (+10 points)
- Recent successful funding: Strong positive (+20 points)
- Large public company: Strong positive (+15 points)

Start from a baseline of 75 (most offers survive). Apply signal adjustments.
Cap at 0 (floor) and 100 (ceiling).

Score interpretation:
- 70–100: LOW RISK — standard monitoring
- 40–69: MEDIUM RISK — advise parallel job search
- 0–39: HIGH RISK — urgently advise parallel search; flag for RM

TOOL USAGE:
1. Call get_company_health_signals with the company name
2. Apply signal weights to compute a score
3. Produce your assessment

OUTPUT: Valid JSON only:
{
  "company_name": "...",
  "offer_survival_score": 72,
  "risk_level": "LOW | MEDIUM | HIGH",
  "positive_signals": ["signal description"],
  "risk_signals": ["signal description with severity"],
  "score_reasoning": "2-3 sentences explaining the score",
  "recommended_action": "What to tell the student and RM"
}
"""

def get_offer_survival_score(student_id: str, company_name: str) -> dict:
    user_message = f"""
Assess offer survival risk for student {student_id}.
Hiring company: {company_name}

Call get_company_health_signals for "{company_name}", then compute
the offer survival score and produce your assessment JSON.
"""
    raw = run_agent(OFFER_SURVIVAL_SYSTEM_PROMPT, user_message, TOOL_DEFINITIONS)
    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        return json.loads(raw[start:end])
    except (json.JSONDecodeError, ValueError):
        return {
            "company_name": company_name,
            "offer_survival_score": 75,
            "risk_level": "LOW",
            "score_reasoning": "Insufficient signals to assess.",
            "recommended_action": "Standard monitoring."
        }
```

---

## STEP 12 — Create `backend/agents/orchestrator.py`

The master coordinator. This is what your FastAPI endpoints call.

```python
# backend/agents/orchestrator.py
"""
Master Orchestrator for PlacementIQ.
Coordinates all sub-agents. FastAPI endpoints call functions from here.
ML scoring engine runs first (fast + reliable), then agents add reasoning layers.
"""
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from nba_agent import get_nba_recommendations
from explainability_agent import generate_explainability_narrative
from market_agent import assess_market_shock, scan_portfolio_for_shocks
from career_path_agent import get_career_path_recommendations
from offer_survival_agent import get_offer_survival_score


def score_student_full(student_data: dict) -> dict:
    """
    Full agentic pipeline for a single student scoring request.
    
    Flow:
    1. ML models run first (XGBoost + LightGBM) — fast, deterministic
    2. NBA + Explainability agents run in parallel — agent-driven, contextual
    3. Results merged into final response
    
    This keeps API latency predictable: ML is fast (~50ms),
    agents add ~1–2s for contextual reasoning.
    """
    student_id = student_data.get("student_id", "UNKNOWN")

    # ── Step 1: Run ML scoring engine (fast path) ─────────────────────────────
    try:
        from scoring_engine import ScoringEngine
        engine = ScoringEngine()
        ml_scores = engine.predict(student_data)
    except Exception as e:
        # Graceful fallback if scoring engine unavailable
        ml_scores = _fallback_ml_scores(student_data)
        print(f"[Orchestrator] Scoring engine error: {e} — using fallback")

    # ── Step 2: Enrich context with ML outputs ────────────────────────────────
    student_context = {
        **student_data,
        "risk_band": ml_scores.get("risk_band", "MEDIUM"),
        "placement_6m": ml_scores.get("placement_probability", {}).get("within_6_months", 0.65),
        "peer_percentile": ml_scores.get("peer_benchmark", {}).get("student_percentile", 50),
        "emi_comfort_ratio": ml_scores.get("emi_comfort", {}).get("ratio", 2.5),
        "confidence_level": ml_scores.get("confidence", {}).get("level", "MEDIUM"),
    }

    # ── Step 3: Run NBA + Explainability in parallel ──────────────────────────
    nba_result = {}
    explain_result = {}

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = {
            executor.submit(get_nba_recommendations, student_id, student_context): "nba",
            executor.submit(generate_explainability_narrative, student_id, student_context): "explain",
        }
        for future in as_completed(futures):
            key = futures[future]
            try:
                result = future.result(timeout=30)
                if key == "nba":
                    nba_result = result
                else:
                    explain_result = result
            except Exception as e:
                print(f"[Orchestrator] Agent '{key}' error: {e}")

    # ── Step 4: Assemble final response ───────────────────────────────────────
    return {
        **ml_scores,
        "agentic_nba": {
            "reasoning": nba_result.get("reasoning"),
            "actions": nba_result.get("actions", []),
        },
        "agentic_explainability": {
            "summary": explain_result.get("summary"),
            "positive_factors": explain_result.get("positive_factors", []),
            "negative_factors": explain_result.get("negative_factors", []),
            "urgency_note": explain_result.get("urgency_note"),
        }
    }


def score_student_fast(student_data: dict) -> dict:
    """
    ML-only scoring (no agents). Use for bulk scoring or latency-sensitive requests.
    NBA and explainability will use hardcoded fallbacks.
    """
    try:
        from scoring_engine import ScoringEngine
        engine = ScoringEngine()
        return engine.predict(student_data)
    except Exception as e:
        return _fallback_ml_scores(student_data)


def get_career_paths(student_id: str, student_context: dict) -> dict:
    """Get alternate career path recommendations for a student."""
    return get_career_path_recommendations(student_id, student_context)


def get_shock_report(field_region_pairs: list) -> list:
    """Run the Market Intelligence Agent across a list of field+region pairs."""
    return scan_portfolio_for_shocks(field_region_pairs)


def get_offer_survival(student_id: str, company_name: str) -> dict:
    """Get Offer Survival Score for a student with an active offer."""
    return get_offer_survival_score(student_id, company_name)


def _fallback_ml_scores(student_data: dict) -> dict:
    """Emergency fallback scores when the scoring engine is unavailable."""
    return {
        "student_id": student_data.get("student_id"),
        "risk_band": "MEDIUM",
        "risk_score": 50,
        "placement_probability": {
            "within_3_months": 0.45,
            "within_6_months": 0.68,
            "within_12_months": 0.87
        },
        "salary_estimate": {"low": 35000, "median": 55000, "high": 80000, "currency": "INR"},
        "emi_comfort": {"ratio": 2.5, "tier": "ADEQUATE"},
        "confidence": {"level": "LOW", "percentage": 40, "data_gaps": ["Scoring engine unavailable"]},
        "peer_benchmark": {"student_percentile": 50, "cohort_median_probability_6m": 0.65},
        "risk_drivers": []
    }
```

---

## STEP 13 — Modify `backend/main.py`

Add these imports and new/updated endpoints. **Do not delete existing endpoints** — add alongside them.

Find your existing imports block and add:
```python
# Add at top of main.py, after existing imports
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "agents"))

from agents.orchestrator import (
    score_student_full,
    score_student_fast,
    get_career_paths,
    get_shock_report,
    get_offer_survival,
)
```

Replace (or add alongside) your existing `/api/v1/score/student` endpoint:
```python
# In main.py — update or add these endpoints

@app.post("/api/v1/score/student")
async def score_student_endpoint(request: StudentScoreRequest):
    """
    Full agentic scoring: ML model + NBA agent + Explainability agent.
    Use this for individual student risk cards in the dashboard.
    """
    result = score_student_full(request.dict())
    return result


@app.post("/api/v1/score/student/fast")
async def score_student_fast_endpoint(request: StudentScoreRequest):
    """
    ML-only scoring without agents. Use for bulk operations or latency-sensitive contexts.
    """
    result = score_student_fast(request.dict())
    return result


@app.get("/api/v1/student/{student_id}/career-paths")
async def career_paths_endpoint(student_id: str):
    """Alternate Career Path Engine — agent-driven."""
    # Fetch student data from your DB/CSV
    student_context = _fetch_student_context(student_id)
    result = get_career_paths(student_id, student_context)
    return result


@app.get("/api/v1/student/{student_id}/offer-survival")
async def offer_survival_endpoint(student_id: str, company: str):
    """Offer Survival Score — agent-driven company health assessment."""
    result = get_offer_survival(student_id, company)
    return result


@app.get("/api/v1/shocks/active")
async def active_shocks_endpoint():
    """
    Placement Shock Detector — agent-driven severity assessment.
    Scans all field+region combinations from the active student portfolio.
    """
    # Build list of unique field+region pairs from your student data
    field_region_pairs = _get_portfolio_segments()
    shocks = get_shock_report(field_region_pairs)
    return {"active_shocks": shocks, "total_segments_scanned": len(field_region_pairs)}


# ── Helper functions (add to main.py) ────────────────────────────────────────

def _fetch_student_context(student_id: str) -> dict:
    """Fetch student data from CSV. Replace with DB query in production."""
    import pandas as pd
    try:
        df = pd.read_csv("data/synthetic_students.csv")
        row = df[df["student_id"] == student_id].iloc[0]
        return row.to_dict()
    except Exception:
        return {"student_id": student_id, "course_type": "Engineering",
                "region": "Pune", "field": "Software Engineering"}


def _get_portfolio_segments() -> list:
    """Get unique field+region pairs from active student portfolio."""
    import pandas as pd
    try:
        df = pd.read_csv("data/synthetic_students.csv")
        pairs = df[["course_type", "region"]].drop_duplicates()
        return [
            {"field": row["course_type"], "region": row["region"]}
            for _, row in pairs.iterrows()
        ]
    except Exception:
        return [
            {"field": "Software Engineering", "region": "Pune"},
            {"field": "MBA-Finance", "region": "Mumbai"},
        ]
```

---

## STEP 14 — Provider Switching Instructions

### Switch to OpenRouter (access Claude, Gemini, Llama via one key):
```bash
# .env
PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
# Optional: choose a specific model
OVERRIDE_MODEL=meta-llama/llama-3.3-70b-instruct  # cheapest
# or
OVERRIDE_MODEL=anthropic/claude-3.5-sonnet        # best quality
# or
OVERRIDE_MODEL=google/gemini-2.0-flash-001        # fast + cheap
```

### Switch to Groq (fastest inference, free tier):
```bash
# .env
PROVIDER=groq
GROQ_API_KEY=gsk_...
# Default model: llama-3.3-70b-versatile (best tool use on Groq)
# Groq free tier: 14,400 requests/day — enough for demo
```

### Switch to Anthropic (most reliable tool use):
```bash
# .env
PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

### Switch to OpenAI:
```bash
# .env
PROVIDER=openai
OPENAI_API_KEY=sk-...
OVERRIDE_MODEL=gpt-4o-mini  # cheaper, still supports tool use
```

---

## STEP 15 — Test the Full Pipeline

```bash
# From backend/ directory
cd backend

# Test a single agent directly
python -c "
import sys; sys.path.insert(0, 'agents')
from agents.nba_agent import get_nba_recommendations
result = get_nba_recommendations('STU-001', {
    'course_type': 'MBA',
    'institute_tier': 'C',
    'region': 'Pune',
    'risk_band': 'HIGH',
    'cgpa': 6.2,
    'iqi': 0.2,
    'behavioral_activity_score': 32,
    'field_demand_score': 25,
    'months_to_graduation': 3,
    'placement_6m': 0.38
})
import json; print(json.dumps(result, indent=2))
"

# Test orchestrator
python -c "
import sys; sys.path.insert(0, 'agents')
from agents.orchestrator import score_student_full
result = score_student_full({
    'student_id': 'STU-001',
    'course_type': 'MBA',
    'institute_tier': 'C',
    'region': 'Pune',
    'cgpa': 6.2,
    'iqi': 0.2,
    'behavioral_activity_score': 32,
    'field_demand_score': 25,
    'monthly_emi': 18000
})
import json; print(json.dumps(result, indent=2))
"

# Start the API
python main.py
```

---

## Provider Capability Matrix

| Provider | Tool Use Quality | Speed | Cost | Best For |
|---|---|---|---|---|
| Anthropic Claude Sonnet | ⭐⭐⭐⭐⭐ | Medium | Medium | Production, hackathon demo |
| OpenRouter + Claude | ⭐⭐⭐⭐⭐ | Medium | Medium | If you need OpenRouter billing |
| OpenRouter + Llama 3.3 | ⭐⭐⭐⭐ | Fast | Very Low | Cost-optimized production |
| Groq + Llama 3.3 | ⭐⭐⭐⭐ | ⚡ Fastest | Free tier | Live demos, prototyping |
| OpenAI GPT-4o | ⭐⭐⭐⭐ | Fast | Medium | Alternative to Anthropic |
| OpenAI GPT-4o-mini | ⭐⭐⭐ | Fast | Low | Budget option |

**Recommendation for TenzorX demo:** Use `PROVIDER=groq` (free, fast) during development.
Switch to `PROVIDER=anthropic` or `PROVIDER=openrouter` with Claude for the final demo
(best tool use reliability).

---

## Gemini CLI Prompt to Execute Everything

Paste this into Gemini CLI:

```
Read the file PLACEMENTIQ_AGENTIC_IMPLEMENTATION.md.

For each file described in the "File Tree to Create" section, create the exact file
at the exact path shown, with the exact code in the corresponding code block.

Order of creation:
1. backend/.env.example
2. backend/config.py
3. backend/agents/__init__.py
4. backend/agents/provider.py
5. backend/agents/tools.py
6. backend/agents/base_agent.py
7. backend/agents/nba_agent.py
8. backend/agents/explainability_agent.py
9. backend/agents/market_agent.py
10. backend/agents/career_path_agent.py
11. backend/agents/offer_survival_agent.py
12. backend/agents/orchestrator.py
13. Modify backend/main.py as described in Step 13

Then run: cd backend && pip install anthropic openai python-dotenv httpx

Do not modify any existing files except main.py and requirements.txt.
Do not delete any existing endpoints in main.py — only add new ones.
```
