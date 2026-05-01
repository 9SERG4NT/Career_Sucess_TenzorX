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

_tool_cache = {}

def execute_tool(tool_name: str, tool_input: dict) -> str:
    """Dispatch a tool call to its implementation. Always returns a JSON string."""
    try:
        # Cache key based on tool name and inputs
        cache_key = json.dumps({"name": tool_name, "input": tool_input}, sort_keys=True)
        if cache_key in _tool_cache:
            return json.dumps(_tool_cache[cache_key])
            
        result = _dispatch(tool_name, tool_input)
        _tool_cache[cache_key] = result
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
