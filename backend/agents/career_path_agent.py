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
