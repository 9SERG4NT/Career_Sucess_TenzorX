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
