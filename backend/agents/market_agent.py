# backend/agents/market_agent.py
"""
Market Intelligence Agent.
Replaces hardcoded threshold triggers in the Placement Shock Detector.
Reasons about severity, distinguishes seasonal dips from genuine shocks.
"""
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
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
    Uses ThreadPoolExecutor to assess segments in parallel for speed and limits 
    workers to prevent rapid rate limiting.
    """
    results = []
    
    with ThreadPoolExecutor(max_workers=5) as executor:
        future_to_pair = {
            executor.submit(assess_market_shock, pair["field"], pair["region"]): pair 
            for pair in field_region_pairs
        }
        
        for future in as_completed(future_to_pair):
            pair = future_to_pair[future]
            try:
                assessment = future.result(timeout=15)
                if assessment.get("severity", "NORMAL") != "NORMAL":
                    results.append(assessment)
            except Exception as e:
                print(f"[Market Agent] Error assessing segment {pair}: {e}")
                
    return results
