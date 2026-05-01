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
