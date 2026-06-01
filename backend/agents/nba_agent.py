# backend/agents/nba_agent.py
"""
NBA (Next-Best-Action) Agent.
Replaces the PRD Section 13 rule table with dynamic, context-aware reasoning.
"""
import json
from base_agent import run_agent
from tools import execute_tool
import config

NBA_SYSTEM_PROMPT = f"""
You are the NBA (Next-Best-Action) Agent for PlacementIQ — an education loan risk platform.
Your job: recommend the highest-ROI, cost-aware interventions for an at-risk student.

REASONING PROCESS (follow in order):
1. Read the SHAP risk drivers provided to identify root cause risk factors
2. Read the EMI data to understand financial urgency (EMI Comfort Ratio)
3. Read the intervention cost table provided and match interventions to the risk drivers
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
- ROI = recovery_cost_avoided / course_cost_inr. For free (zero-cost) interventions, set roi_label to "High ROI" (never use "∞" or "infinity").

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
    Pre-fetches the tool data in Python (deterministic) and asks the LLM for a
    single-shot JSON output. Avoids multi-round tool-call loops that smaller/open
    models (Gemma, Llama-8B, Mistral-7B) handle unreliably.
    """
    course_type = student_context.get("course_type", "Engineering")

    shap_json         = execute_tool("get_shap_drivers", {"student_id": student_id})
    emi_json          = execute_tool("get_emi_data", {"student_id": student_id})
    intervention_json = execute_tool("get_intervention_cost_table", {"course_type": course_type})

    user_message = f"""
Generate Next-Best-Action recommendations for student: {student_id}

Student profile:
- Course type: {course_type}
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

SHAP risk drivers (top-down attributions on the ML risk score):
{shap_json}

EMI data (financial urgency):
{emi_json}

Available interventions for course_type={course_type}:
{intervention_json}

Now produce the ranked NBA JSON output. Return ONLY the JSON object, no preamble, no markdown fence.
"""

    try:
        raw = run_agent(NBA_SYSTEM_PROMPT, user_message, tools=[])
    except Exception as e:
        print(f"[NBA] LLM call failed: {type(e).__name__}: {e}")
        return {
            "reasoning": f"NBA agent unavailable ({type(e).__name__}). Showing heuristic fallback.",
            "actions": [],
            "_error": str(e),
        }

    parsed = _extract_json_object(raw)
    if parsed is None:
        return {
            "reasoning": (raw or "Agent returned no text.")[:300],
            "actions": [],
        }
    # Ensure required keys always exist so downstream `.get("actions", [])` is honest
    parsed.setdefault("reasoning", "")
    parsed.setdefault("actions", [])
    return parsed


def _extract_json_object(text: str) -> dict | None:
    """Robust extraction: scans for the outermost balanced {...} block, ignoring
    braces inside strings. Falls back to the naive slice if scan fails."""
    if not text:
        return None
    depth = 0
    start = -1
    in_str = False
    esc = False
    for i, ch in enumerate(text):
        if esc:
            esc = False
            continue
        if ch == '\\' and in_str:
            esc = True
            continue
        if ch == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if ch == '{':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start != -1:
                try:
                    return json.loads(text[start:i + 1])
                except json.JSONDecodeError:
                    start = -1  # keep scanning for next candidate
    try:
        s = text.find("{"); e = text.rfind("}") + 1
        return json.loads(text[s:e]) if s != -1 and e > s else None
    except (json.JSONDecodeError, ValueError):
        return None
