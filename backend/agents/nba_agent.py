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
