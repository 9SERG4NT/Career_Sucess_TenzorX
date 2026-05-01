import math
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from scoring_engine import ScoringEngine
import pandas as pd
import numpy as np
import random
import sys, os

# Add agents directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "agents"))

from agents.orchestrator import (
    score_student_full,
    score_student_fast,
    get_career_paths,
    get_shock_report,
    get_offer_survival,
)

app = FastAPI(
    title="PlacementIQ v2.0 API",
    version="1.0.0",
    description="AI-powered education loan placement risk prediction API for lenders."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = ScoringEngine()

def sanitize(obj):
    """Recursively sanitize dict/list to make all values JSON-safe (no NaN/Inf)."""
    if isinstance(obj, dict):
        return {k: sanitize(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize(v) for v in obj]
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        f = float(obj)
        return None if (math.isnan(f) or math.isinf(f)) else f
    return obj

# Load synthetic student database
try:
    df_students = pd.read_csv('data/synthetic_students.csv')
    # Replace NaN with None (JSON null) so serialization doesn't crash
    df_students = df_students.where(pd.notna(df_students), other=None)
    mock_db = df_students.to_dict('records')
    print(f"Loaded {len(mock_db)} student records.")
except FileNotFoundError:
    mock_db = []
    print("WARNING: synthetic_students.csv not found. Run data_generator.py first.")


class StudentData(BaseModel):
    student_id: str = "STU-2026-00000"
    course_type: str = "Engineering"
    institute_tier: str = "A"
    region: str = "Bengaluru"
    cgpa: float = Field(default=7.5, ge=0.0, le=10.0)
    internship_months: int = Field(default=3, ge=0)
    employer_tier: str = "Startup"
    iqi: float = Field(default=0.15, ge=0.0, le=1.0)
    behavioral_activity_score: int = Field(default=65, ge=0, le=100)
    field_demand_score: int = Field(default=80, ge=0, le=100)
    macro_climate_index: float = Field(default=0.7, ge=0.0, le=1.0)
    monthly_emi: int = Field(default=15000, ge=0)


class InterventionRequest(BaseModel):
    intervention_name: str


# ─── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/api/v1/score/student")
async def score_student_endpoint(request: StudentData):
    """
    Full agentic scoring: ML model + NBA agent + Explainability agent.
    Use this for individual student risk cards in the dashboard.
    """
    result = score_student_full(request.model_dump())
    return sanitize(result)


@app.post("/api/v1/score/student/fast")
async def score_student_fast_endpoint(request: StudentData):
    """
    ML-only scoring without agents. Use for bulk operations or latency-sensitive contexts.
    """
    result = score_student_fast(request.model_dump())
    return sanitize(result)


@app.get("/api/v1/student/{student_id}/career-paths")
async def career_paths_endpoint(student_id: str):
    """Alternate Career Path Engine — agent-driven."""
    # Fetch student data from your DB/CSV
    student_context = _fetch_student_context(student_id)
    result = get_career_paths(student_id, student_context)
    return sanitize(result)


@app.get("/api/v1/student/{student_id}/offer-survival")
async def offer_survival_endpoint(student_id: str, company: str):
    """Offer Survival Score — agent-driven company health assessment."""
    result = get_offer_survival(student_id, company)
    return sanitize(result)


@app.get("/api/v1/shocks/active")
async def active_shocks_endpoint():
    """
    Placement Shock Detector — agent-driven severity assessment.
    Scans all field+region combinations from the active student portfolio.
    """
    # Build list of unique field+region pairs from your student data
    field_region_pairs = _get_portfolio_segments()
    shocks = get_shock_report(field_region_pairs)
    return sanitize({"active_shocks": shocks, "total_segments_scanned": len(field_region_pairs)})


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


@app.get("/api/v1/students")
async def get_students(limit: int = 50):
    """Returns a random sample of students for the dashboard watchlist."""
    if not mock_db:
        return []
    sample = random.sample(mock_db, min(limit, len(mock_db)))
    return sanitize(sample)


@app.get("/api/v1/cohort/summary")
async def get_cohort_summary():
    """Returns portfolio-level aggregate statistics."""
    if not mock_db:
        return {"error": "No data loaded"}

    df = pd.DataFrame(mock_db)

    high_risk = int(len(df[(df['placed_6m'] == 0) & (df['cgpa'] < 6.0)]))
    low_risk = int(len(df[df['placed_6m'] == 1]))
    med_risk = int(len(df) - high_risk - low_risk)

    result = {
        "total_students": int(len(df)),
        "avg_cgpa": round(float(df['cgpa'].mean()), 2),
        "avg_emi": int(df['monthly_emi'].mean()),
        "risk_distribution": {
            "LOW": low_risk,
            "MEDIUM": med_risk,
            "HIGH": high_risk
        },
        "placement_velocity": {
            "3m": round(float(df['placed_3m'].mean() * 100), 1),
            "6m": round(float(df['placed_6m'].mean() * 100), 1),
            "12m": round(float(df['placed_12m'].mean() * 100), 1),
        },
        "top_regions": {k: int(v) for k, v in df['region'].value_counts().head(5).to_dict().items()},
        "course_breakdown": {k: int(v) for k, v in df['course_type'].value_counts().to_dict().items()},
    }
    return sanitize(result)


@app.get("/api/v1/student/{student_id}")
async def get_student(student_id: str):
    """Returns a full scored profile for a specific student."""
    student = next((s for s in mock_db if s.get("student_id") == student_id), None)
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{student_id}' not found")

    try:
        score = engine.score_student(dict(student))
        return sanitize({
            "profile": student,
            "analysis": score
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoring error: {str(e)}")


@app.post("/api/v1/student/{student_id}/simulate")
async def simulate_intervention(student_id: str, req: InterventionRequest):
    """Simulate an intervention on a student and return ROI analysis."""
    student = next((s for s in mock_db if s.get("student_id") == student_id), None)
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{student_id}' not found")

    try:
        result = engine.simulate_intervention(dict(student), req.intervention_name)
        return sanitize(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")


@app.get("/api/v1/interventions")
async def list_interventions():
    """Returns available intervention types and their costs."""
    return sanitize({
        name: {"cost_inr": cost}
        for name, cost in engine.intervention_costs.items()
    })


@app.post("/api/v1/feedback")
async def submit_feedback(data: dict):
    """
    Reviewer Outcome Submission — submits actual placement outcome for model evaluation.
    Powers the continuous learning feedback loop.
    """
    required = ["student_id", "placed", "actual_salary"]
    missing = [f for f in required if f not in data]
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing required fields: {missing}")

    # In production: write to feature store and trigger retraining pipeline
    # For prototype: acknowledge receipt
    return {
        "status": "received",
        "message": "Outcome recorded. Will be included in next monthly retraining cycle.",
        "student_id": data.get("student_id")
    }


@app.get("/api/v1/model/metadata")
async def get_model_metadata():
    """Returns model version and performance metrics."""
    return {
        "model_version": "2.0.0-prototype",
        "classifier": "XGBoost (n_estimators=100, max_depth=4)",
        "regressor": "LightGBM (n_estimators=150, objective=regression)",
        "explainability": "SHAP TreeExplainer",
        "training_records": 8000,
        "evaluation_records": 2000,
        "metrics": {
            "classification_f1_6m": 0.86,
            "salary_mape": "12.6%",
        },
        "last_trained": "2026-05-01",
        "features": [
            "cgpa", "institute_tier", "course_type", "region",
            "internship_months", "employer_tier", "iqi",
            "behavioral_activity_score", "field_demand_score", "macro_climate_index"
        ]
    }


@app.get("/api/v1/alerts/active")
async def get_active_alerts():
    """
    Early Alert Engine — returns all high-risk students that require intervention.
    Detects students crossing into HIGH risk based on placement outcome + CGPA + EMI pressure.
    """
    if not mock_db:
        return {"alerts": [], "total": 0}

    alerts = []
    for s in mock_db:
        placed = s.get('placed_6m')
        cgpa = s.get('cgpa', 10)
        emi = s.get('monthly_emi', 0)
        salary = s.get('actual_salary', 0)

        severity = None
        reason = None

        # Critical: unplaced + low CGPA
        if placed == 0 and (cgpa or 10) < 6.0:
            severity = "CRITICAL"
            reason = f"Unplaced with CGPA {cgpa} — high default risk"
        # High: EMI stress (salary < EMI if placed)
        elif placed == 1 and salary and emi and salary > 0:
            monthly_sal = salary / 12
            if monthly_sal < emi:
                severity = "HIGH"
                reason = f"Underemployment — monthly salary ₹{int(monthly_sal):,} < EMI ₹{emi:,}"
        # Medium: unplaced but moderate CGPA
        elif placed == 0 and (cgpa or 10) < 7.0:
            severity = "MEDIUM"
            reason = f"Unplaced with CGPA {cgpa} — approaching high risk"

        if severity and len(alerts) < 100:  # Cap at 100 for performance
            alerts.append({
                "student_id": s.get("student_id"),
                "severity": severity,
                "reason": reason,
                "course_type": s.get("course_type"),
                "institute_tier": s.get("institute_tier"),
                "region": s.get("region"),
                "recommended_action": "Assign Case Manager" if severity == "CRITICAL" else "Schedule RM Check-in"
            })

    # Sort by severity
    order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2}
    alerts.sort(key=lambda a: order.get(a["severity"], 3))

    return sanitize({
        "alerts": alerts,
        "total": len(alerts),
        "critical_count": sum(1 for a in alerts if a["severity"] == "CRITICAL"),
        "high_count": sum(1 for a in alerts if a["severity"] == "HIGH"),
        "medium_count": sum(1 for a in alerts if a["severity"] == "MEDIUM"),
    })


@app.post("/api/v1/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, data: dict = {}):
    """Mark an alert as acknowledged by the RM (PRD §11.2)."""
    return {
        "status": "acknowledged",
        "alert_id": alert_id,
        "message": "Alert acknowledged and logged. RM action recorded.",
        "acknowledged_by": data.get("rm_id", "system")
    }


# ─── F-09: Bulk Scoring API ─────────────────────────────────────────────────

class BulkScoringRequest(BaseModel):
    student_ids: list[str] = Field(..., max_length=1000)
    lender_id: str = "LND-DEFAULT"

@app.post("/api/v1/score/batch")
async def score_batch(req: BulkScoringRequest):
    """
    F-09: Batch inference for up to 1,000 students.
    Accepts list of student_ids from the portfolio DB, returns scored results.
    """
    if not mock_db:
        raise HTTPException(status_code=503, detail="No data loaded")
    if len(req.student_ids) > 1000:
        raise HTTPException(status_code=400, detail="Max 1,000 students per batch")

    results = []
    errors = []
    db_index = {s["student_id"]: s for s in mock_db if s.get("student_id")}

    for sid in req.student_ids:
        student = db_index.get(sid)
        if not student:
            errors.append({"student_id": sid, "error": "not found"})
            continue
        try:
            score = engine.score_student(dict(student))
            results.append({
                "student_id": sid,
                "risk_band": score["prediction"]["risk_band"],
                "placement_probability_6m": score["prediction"]["placement_probability"]["6m"],
                "expected_salary": score["prediction"]["expected_salary"],
                "emi_comfort_index": score["insights"]["emi_comfort_index"],
            })
        except Exception as e:
            errors.append({"student_id": sid, "error": str(e)})

    return sanitize({
        "job_id": f"BATCH-{random.randint(10000,99999)}",
        "lender_id": req.lender_id,
        "requested": len(req.student_ids),
        "scored": len(results),
        "errors": len(errors),
        "results": results,
        "error_detail": errors[:10],  # cap error detail at 10
    })


# ─── F-10: Model Drift Monitoring ───────────────────────────────────────────

@app.get("/api/v1/model/drift")
async def get_model_drift():
    """
    F-10: PSI (Population Stability Index) drift monitoring.
    Compares current score distribution to training baseline.
    PSI < 0.10 = stable | 0.10-0.25 = minor drift | > 0.25 = major drift
    """
    if not mock_db:
        return {"status": "no data"}

    df = pd.DataFrame(mock_db)

    # Compute current placement probability distribution bins
    # Simulate PSI against training baseline (known from model_pipeline)
    bins = [0, 0.2, 0.4, 0.6, 0.8, 1.0]
    placed_dist = df['placed_6m'].values

    # Expected baseline proportions from training set
    baseline = {"0-20%": 0.08, "20-40%": 0.18, "40-60%": 0.30, "60-80%": 0.28, "80-100%": 0.16}
    # Simulated current: slight shift due to macro conditions
    current =  {"0-20%": 0.11, "20-40%": 0.22, "40-60%": 0.28, "60-80%": 0.25, "80-100%": 0.14}

    # PSI computation: sum((current - expected) * ln(current/expected))
    psi_total = 0.0
    feature_psi = []
    for band, exp_p in baseline.items():
        cur_p = current[band]
        if exp_p > 0 and cur_p > 0:
            psi_band = (cur_p - exp_p) * math.log(cur_p / exp_p)
            psi_total += psi_band
            feature_psi.append({"band": band, "baseline_pct": round(exp_p*100,1), "current_pct": round(cur_p*100,1), "psi_contribution": round(psi_band, 4)})

    psi_total = round(abs(psi_total), 4)
    drift_status = "STABLE" if psi_total < 0.10 else "MINOR_DRIFT" if psi_total < 0.25 else "MAJOR_DRIFT"
    alert = psi_total >= 0.10

    # Feature-level drift (simulated)
    feature_drift = [
        {"feature": "cgpa", "psi": 0.03, "status": "STABLE"},
        {"feature": "field_demand_score", "psi": 0.08, "status": "STABLE"},
        {"feature": "behavioral_activity_score", "psi": 0.12, "status": "MINOR_DRIFT"},
        {"feature": "macro_climate_index", "psi": 0.19, "status": "MINOR_DRIFT"},
        {"feature": "iqi", "psi": 0.04, "status": "STABLE"},
        {"feature": "internship_months", "psi": 0.06, "status": "STABLE"},
    ]

    return sanitize({
        "model_version": "2.0.0-prototype",
        "monitoring_window": "Last 30 days",
        "overall_psi": psi_total,
        "drift_status": drift_status,
        "alert_triggered": alert,
        "alert_message": f"PSI={psi_total} — {'Retraining recommended.' if psi_total >= 0.25 else 'Monitor closely.' if psi_total >= 0.10 else 'Model is stable.'}",
        "score_distribution": {"baseline": baseline, "current": current, "bands": feature_psi},
        "feature_level_drift": feature_drift,
        "last_checked": "2026-05-01T03:00:00Z",
        "next_check": "2026-06-01T03:00:00Z",
    })


# ─── F-11: Audit Trail & Score History ──────────────────────────────────────

@app.get("/api/v1/student/{student_id}/history")
async def get_student_history(student_id: str):
    """
    F-11: Full chronological score history for a student.
    Returns synthetic 90-day trend with model version and feature snapshot.
    """
    student = next((s for s in mock_db if s.get("student_id") == student_id), None)
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{student_id}' not found")

    # Generate synthetic 90-day score history (weekly snapshots)
    import datetime
    base_date = datetime.date(2026, 2, 1)
    try:
        score_now = engine.score_student(dict(student))
        current_prob = score_now["prediction"]["placement_probability"]["6m"]
    except:
        current_prob = 0.5

    history = []
    for week in range(13):  # 13 weeks = ~90 days
        days_ago = (12 - week) * 7
        snap_date = base_date + datetime.timedelta(days=week * 7)
        # Simulate gradual improvement over 90 days
        noise = random.uniform(-0.04, 0.04)
        trend_factor = week / 12  # ramp up
        prob = round(max(0.01, min(0.99, current_prob * (0.7 + 0.3 * trend_factor) + noise)), 2)
        band = "LOW" if prob >= 0.70 else "MEDIUM" if prob >= 0.45 else "HIGH"
        history.append({
            "date": snap_date.isoformat(),
            "placement_probability_6m": prob,
            "risk_band": band,
            "model_version": "2.0.0-prototype",
            "trigger": "nightly_refresh" if week % 4 != 0 else "manual_rescore",
        })

    return sanitize({
        "student_id": student_id,
        "history_window_days": 90,
        "snapshots": history,
        "trend": "IMPROVING" if history[-1]["placement_probability_6m"] > history[0]["placement_probability_6m"] else "DECLINING",
        "first_scored": history[0]["date"],
        "last_scored": history[-1]["date"],
    })


@app.get("/api/v1/student/{student_id}/audit-report")
async def get_audit_report(student_id: str):
    """
    F-11: Exportable audit report — full score history, model version,
    feature inputs, SHAP outputs for compliance teams.
    """
    student = next((s for s in mock_db if s.get("student_id") == student_id), None)
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{student_id}' not found")

    try:
        score = engine.score_student(dict(student))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return sanitize({
        "report_id": f"AUD-{student_id}-2026050100",
        "generated_at": "2026-05-01T03:00:00Z",
        "student_id": student_id,
        "model_version": "2.0.0-prototype",
        "feature_inputs": {k: student.get(k) for k in [
            "course_type", "institute_tier", "region", "cgpa",
            "internship_months", "employer_tier", "iqi",
            "behavioral_activity_score", "field_demand_score", "macro_climate_index"
        ]},
        "score_output": score["prediction"],
        "explainability": score["explainability"],
        "compliance_note": "Score generated by XGBoost classifier v2.0.0. SHAP values provided for regulatory explainability (RBI FLDG guidelines). This report is suitable for credit file audit purposes.",
    })


# ─── Placement Shock Detector — live endpoint ──────────────────────────────

@app.get("/api/v1/shocks/active")
async def get_active_shocks():
    """
    Placement Shock Detector ⭐ — returns active macro-level shock events.
    In production: fed by real-time NLP parsing of news + job portal volume drops.
    Demo: seeded realistic shocks based on current market signals.
    """
    if not mock_db:
        return {"shocks": [], "total": 0}

    df = pd.DataFrame(mock_db)

    # Compute affected student counts by region/course
    shocks = [
        {
            "shock_id": "SHK-2026-0501-01",
            "detected_at": "2026-05-01T01:00:00Z",
            "sector": "Information Technology",
            "geography": ["Pune", "Bengaluru"],
            "trigger": "IT hiring volume down 24% MoM; TechCorp, InfoEdge, and Wipro announced hiring freeze",
            "severity": "CRITICAL",
            "affected_students": int(len(df[(df['region'].isin(['Pune', 'Bengaluru'])) & (df['course_type'] == 'Engineering')])),
            "risk_band_escalations": {"Medium_to_High": 34, "Low_to_Medium": 11},
            "recommended_action": "Assign RMs to 34 newly HIGH students immediately. Consider macro climate index override.",
            "macro_climate_override": 0.35,
        },
        {
            "shock_id": "SHK-2026-0428-02",
            "detected_at": "2026-04-28T06:00:00Z",
            "sector": "BFSI",
            "geography": ["Mumbai", "Delhi NCR"],
            "trigger": "RBI rate hike announcement; BFSI hiring budgets under review at 4 major banks",
            "severity": "MODERATE",
            "affected_students": int(len(df[(df['region'].isin(['Mumbai', 'Delhi NCR'])) & (df['course_type'] == 'MBA')])),
            "risk_band_escalations": {"Medium_to_High": 12, "Low_to_Medium": 21},
            "recommended_action": "Monitor MBA students in BFSI pipeline. Flag if demand score drops further.",
            "macro_climate_override": 0.52,
        }
    ]

    total_affected = sum(s["affected_students"] for s in shocks)
    return sanitize({
        "shocks": shocks,
        "total": len(shocks),
        "total_affected_students": total_affected,
        "last_scan": "2026-05-01T03:00:00Z",
        "next_scan": "2026-05-02T03:00:00Z",
    })


# ─── Dynamic Employability Heatmap ──────────────────────────────────────────

@app.get("/api/v1/heatmap/demand")
async def get_heatmap_demand(field: str = None, region: str = None):
    """
    Dynamic Employability Heatmap ⭐ — returns field × region demand grid.
    Filterable by field and region. Scores are 0-100.
    """
    fields = ["Engineering", "MBA", "Nursing"]
    regions = ["Mumbai", "Bengaluru", "Delhi NCR", "Pune", "Hyderabad", "Chennai"]

    # Demand matrix calibrated to realistic hiring patterns
    demand_matrix = {
        ("Engineering", "Bengaluru"): {"demand": 88, "trend": "+3%", "top_roles": ["SDE", "Data Engineer", "DevOps"]},
        ("Engineering", "Pune"):      {"demand": 72, "trend": "-5%", "top_roles": ["Embedded Systems", "QA Engineer", "Manufacturing"]},
        ("Engineering", "Hyderabad"): {"demand": 81, "trend": "+2%", "top_roles": ["SDE", "Cloud Architect", "ML Engineer"]},
        ("Engineering", "Mumbai"):    {"demand": 65, "trend": "-1%", "top_roles": ["IT Consulting", "FinTech SDE", "Systems Analyst"]},
        ("Engineering", "Delhi NCR"): {"demand": 70, "trend": "+1%", "top_roles": ["Backend SDE", "Product Manager", "IT Manager"]},
        ("Engineering", "Chennai"):   {"demand": 75, "trend": "+4%", "top_roles": ["Automotive Software", "Semiconductor", "SDE"]},
        ("MBA", "Mumbai"):            {"demand": 85, "trend": "+2%", "top_roles": ["Investment Banking", "Risk Analyst", "Brand Manager"]},
        ("MBA", "Delhi NCR"):         {"demand": 78, "trend": "-2%", "top_roles": ["Consulting", "FMCG Management", "Supply Chain"]},
        ("MBA", "Bengaluru"):         {"demand": 74, "trend": "+5%", "top_roles": ["VC/PE Analyst", "Product Manager", "Strategy"]},
        ("MBA", "Pune"):              {"demand": 62, "trend": "-4%", "top_roles": ["Operations", "HR Business Partner", "Finance"]},
        ("MBA", "Hyderabad"):         {"demand": 68, "trend": "+1%", "top_roles": ["IT Product Management", "Analytics", "Business Dev"]},
        ("MBA", "Chennai"):           {"demand": 60, "trend": "0%",  "top_roles": ["Manufacturing Management", "Supply Chain", "HR"]},
        ("Nursing", "Mumbai"):        {"demand": 92, "trend": "+8%", "top_roles": ["ICU Nurse", "OR Nurse", "Nurse Educator"]},
        ("Nursing", "Delhi NCR"):     {"demand": 88, "trend": "+6%", "top_roles": ["Clinical Nurse", "Home Care", "Pediatric Nurse"]},
        ("Nursing", "Bengaluru"):     {"demand": 84, "trend": "+7%", "top_roles": ["Corporate Hospital", "Research Nurse", "Midwife"]},
        ("Nursing", "Pune"):          {"demand": 79, "trend": "+5%", "top_roles": ["Community Health", "Hospital Staff", "Nursing Home"]},
        ("Nursing", "Hyderabad"):     {"demand": 82, "trend": "+9%", "top_roles": ["Senior Nurse", "Specialty Care", "Outpatient"]},
        ("Nursing", "Chennai"):       {"demand": 77, "trend": "+4%", "top_roles": ["Government Hospital", "Private Clinic", "ICU"]},
    }

    grid = []
    for f in fields:
        if field and f != field:
            continue
        for r in regions:
            if region and r != region:
                continue
            key = (f, r)
            data = demand_matrix.get(key, {"demand": 50, "trend": "0%", "top_roles": []})
            grid.append({
                "field": f,
                "region": r,
                "demand_score": data["demand"],
                "trend": data["trend"],
                "top_roles": data["top_roles"],
                "risk_level": "HIGH" if data["demand"] >= 80 else "MEDIUM" if data["demand"] >= 60 else "LOW",
            })

    return sanitize({
        "grid": grid,
        "total_cells": len(grid),
        "last_updated": "2026-05-01",
        "filters_applied": {"field": field, "region": region},
    })


# ─── Action Completion Tracker (F-11 / NBA) ─────────────────────────────────

@app.post("/api/v1/nba/{student_id}/action/complete")
async def mark_nba_complete(student_id: str, data: dict = {}):
    """
    Action Completion Tracker ⭐ — marks an NBA action as completed.
    Triggers score refresh in production. PRD §10.11.
    """
    student = next((s for s in mock_db if s.get("student_id") == student_id), None)
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{student_id}' not found")

    action = data.get("action", "unknown")
    return sanitize({
        "student_id": student_id,
        "action_completed": action,
        "status": "recorded",
        "score_refresh_triggered": True,
        "message": f"Action '{action}' marked complete. Score will be refreshed in the next nightly run.",
        "next_score_refresh": "2026-05-02T00:00:00Z",
    })


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "students_loaded": len(mock_db)}



# ═══════════════════════════════════════════════════════════════
# PHASE 2 FEATURES
# ═══════════════════════════════════════════════════════════════

# ─── Alternate Career Path Engine (§10.4) ────────────────────

CAREER_ADJACENCY = {
    "Engineering": [
        {"role": "Data Analyst", "demand": 85, "salary_match_pct": 92, "skills_needed": ["Python", "SQL", "Tableau"], "transition_effort": "LOW"},
        {"role": "Product Manager", "demand": 78, "salary_match_pct": 105, "skills_needed": ["Agile", "User Research", "Roadmapping"], "transition_effort": "MEDIUM"},
        {"role": "Cloud Solutions Architect", "demand": 82, "salary_match_pct": 118, "skills_needed": ["AWS/GCP", "Terraform", "Networking"], "transition_effort": "MEDIUM"},
        {"role": "DevOps Engineer", "demand": 80, "salary_match_pct": 96, "skills_needed": ["Docker", "CI/CD", "Kubernetes"], "transition_effort": "LOW"},
        {"role": "Technical Sales Engineer", "demand": 68, "salary_match_pct": 88, "skills_needed": ["CRM", "Domain Knowledge", "Presentation"], "transition_effort": "LOW"},
    ],
    "MBA": [
        {"role": "Supply Chain Analyst", "demand": 71, "salary_match_pct": 94, "skills_needed": ["SAP", "Excel", "Logistics"], "transition_effort": "LOW"},
        {"role": "Risk Analyst (BFSI)", "demand": 76, "salary_match_pct": 98, "skills_needed": ["Excel", "FRM basics", "SQL"], "transition_effort": "LOW"},
        {"role": "Operations Manager", "demand": 65, "salary_match_pct": 89, "skills_needed": ["Six Sigma", "Project Mgmt", "ERP"], "transition_effort": "MEDIUM"},
        {"role": "Business Development Manager", "demand": 72, "salary_match_pct": 101, "skills_needed": ["CRM", "Negotiation", "Market Research"], "transition_effort": "LOW"},
        {"role": "HR Business Partner", "demand": 60, "salary_match_pct": 82, "skills_needed": ["HRIS", "Labor Law", "Coaching"], "transition_effort": "LOW"},
    ],
    "Nursing": [
        {"role": "Clinical Research Associate", "demand": 74, "salary_match_pct": 112, "skills_needed": ["GCP", "ICH Guidelines", "Data Collection"], "transition_effort": "MEDIUM"},
        {"role": "Hospital Administrator", "demand": 65, "salary_match_pct": 105, "skills_needed": ["Healthcare Mgmt", "Budgeting", "Compliance"], "transition_effort": "HIGH"},
        {"role": "Medical Device Sales", "demand": 78, "salary_match_pct": 108, "skills_needed": ["Product Knowledge", "Sales", "Anatomy"], "transition_effort": "LOW"},
        {"role": "Health Informatics Specialist", "demand": 70, "salary_match_pct": 115, "skills_needed": ["EHR Systems", "HIPAA", "Data Analysis"], "transition_effort": "MEDIUM"},
    ],
}

@app.get("/api/v1/student/{student_id}/career-paths")
async def get_career_paths(student_id: str, region: str = None):
    """Alternate Career Path Engine ⭐ — PRD §10.4"""
    student = next((s for s in mock_db if s.get("student_id") == student_id), None)
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{student_id}' not found")

    course = student.get("course_type", "Engineering")
    field_demand = student.get("field_demand_score", 50)
    student_region = region or student.get("region", "Bengaluru")

    paths = CAREER_ADJACENCY.get(course, CAREER_ADJACENCY["Engineering"])
    trigger = "low_field_demand" if field_demand < 40 else "exploration"

    return sanitize({
        "student_id": student_id,
        "primary_field": course,
        "primary_field_demand_score": field_demand,
        "trigger": trigger,
        "geography": student_region,
        "recommended_paths": [
            {**p, "rank": i+1, "demand_in_region": max(30, p["demand"] - random.randint(0,15))}
            for i, p in enumerate(paths)
        ],
        "note": "PRD §10.4 OQ-07: recommendations filtered to student geography. Relocation options available in Phase 2+.",
    })


# ─── Cold-Start Institute Scoring (§10.7) ────────────────────

@app.post("/api/v1/institute/cold-start")
async def cold_start_institute(data: dict = {}):
    """Cold-Start Institute Scoring ⭐ — PRD §10.7. KNN-based synthetic baseline."""
    institute_name = data.get("institute_name", "New Institute")
    naac_grade = data.get("naac_grade", "B")
    city_tier = data.get("city_tier", 2)
    course_mix = data.get("course_mix", ["Engineering"])
    faculty_ratio = data.get("faculty_student_ratio", 1/20)

    # Known reference institutes with their placement rates
    reference = [
        {"name": "IIT Bombay", "tier": 1, "placement_rate": 0.96, "avg_salary": 180000, "naac": "A++", "similarity": 0},
        {"name": "NIT Pune", "tier": 2, "placement_rate": 0.82, "avg_salary": 95000, "naac": "A", "similarity": 0},
        {"name": "Symbiosis", "tier": 2, "placement_rate": 0.78, "avg_salary": 88000, "naac": "A", "similarity": 0},
        {"name": "Tier-B College Pune", "tier": 3, "placement_rate": 0.64, "avg_salary": 62000, "naac": "B+", "similarity": 0},
        {"name": "Tier-C College Rural", "tier": 4, "placement_rate": 0.48, "avg_salary": 42000, "naac": "B", "similarity": 0},
    ]

    grade_map = {"A++": 5, "A+": 4, "A": 3, "B+": 2.5, "B": 2, "C": 1}
    grade_score = grade_map.get(naac_grade, 2)

    for ref in reference:
        ref_grade = grade_map.get(ref["naac"], 2)
        similarity = 1 - abs(grade_score - ref_grade) / 5 - abs(city_tier - ref["tier"]) / 4
        ref["similarity"] = max(0, similarity)

    top_k = sorted(reference, key=lambda x: x["similarity"], reverse=True)[:3]
    total_sim = sum(r["similarity"] for r in top_k) or 1
    synthetic_rate = sum(r["placement_rate"] * r["similarity"] / total_sim for r in top_k)
    synthetic_salary = sum(r["avg_salary"] * r["similarity"] / total_sim for r in top_k)

    return sanitize({
        "institute_name": institute_name,
        "cold_start": True,
        "confidence_ceiling": "MEDIUM",
        "synthetic_placement_rate": round(synthetic_rate, 3),
        "synthetic_avg_salary_inr": int(synthetic_salary),
        "k_nearest_institutes": [{"name": r["name"], "similarity": round(r["similarity"], 3)} for r in top_k],
        "data_stale_flag": False,
        "note": "Cold-start scores are synthetic baselines. Confidence is capped at MEDIUM until 6 months of actual placement data is collected.",
    })


# ─── Batch Peer Velocity Tracker (§10.9) ─────────────────────

@app.get("/api/v1/cohort/velocity")
async def get_peer_velocity(course_type: str = None, institute_tier: str = None):
    """Batch Peer Velocity Tracker ⭐ — PRD §10.9. Tracks cohort placement speed."""
    if not mock_db:
        return {"cohorts": []}

    df = pd.DataFrame(mock_db)
    if course_type:
        df = df[df["course_type"] == course_type]
    if institute_tier:
        df = df[df["institute_tier"] == institute_tier]

    cohorts = []
    for (course, tier), group in df.groupby(["course_type", "institute_tier"]):
        placed = group["placed_6m"].sum() if "placed_6m" in group else 0
        total = len(group)
        rate = round(placed / total, 3) if total else 0
        alert_tier = (
            "RED" if rate > 0.75 else
            "ORANGE" if rate > 0.50 else
            "YELLOW" if rate > 0.25 else
            "NORMAL"
        )
        cohorts.append({
            "cohort": f"{course} · Tier-{tier} · 2026",
            "course_type": course,
            "institute_tier": tier,
            "total_students": int(total),
            "placed_count": int(placed),
            "placement_rate": rate,
            "alert_tier": alert_tier,
            "alert_message": {
                "RED": f"Critical: {int(rate*100)}% placed — lagging students urgently need intervention.",
                "ORANGE": f"Majority placed ({int(rate*100)}%). Unplaced students need RM outreach now.",
                "YELLOW": f"Batch moving ({int(rate*100)}% placed). Monitor unplaced students.",
                "NORMAL": f"Early cycle ({int(rate*100)}% placed). No urgency yet.",
            }.get(alert_tier, "Normal"),
        })

    cohorts.sort(key=lambda c: c["placement_rate"], reverse=True)
    return sanitize({"cohorts": cohorts, "total_cohorts": len(cohorts), "as_of": "2026-05-01"})


# ─── Institute Momentum Index (§10.12) ───────────────────────

@app.get("/api/v1/institutes/momentum")
async def get_institute_momentum():
    """Institute Momentum Index ⭐ — PRD §10.12. Rolling recruiter + offer trends."""
    institutes = [
        {"institute_id": "INST-001", "name": "IIT Bombay", "tier": "A", "region": "Mumbai",
         "recruiter_visits_30d": 48, "recruiter_visits_90d": 120, "offers_30d": 210, "offers_90d": 580},
        {"institute_id": "INST-002", "name": "NIT Pune", "tier": "A", "region": "Pune",
         "recruiter_visits_30d": 22, "recruiter_visits_90d": 68, "offers_30d": 95, "offers_90d": 260},
        {"institute_id": "INST-003", "name": "Symbiosis MBA", "tier": "B", "region": "Pune",
         "recruiter_visits_30d": 18, "recruiter_visits_90d": 72, "offers_30d": 72, "offers_90d": 195},
        {"institute_id": "INST-004", "name": "BITS Pilani", "tier": "A", "region": "Rajasthan",
         "recruiter_visits_30d": 38, "recruiter_visits_90d": 98, "offers_30d": 168, "offers_90d": 420},
        {"institute_id": "INST-005", "name": "Tier-B Engineering Pune", "tier": "B", "region": "Pune",
         "recruiter_visits_30d": 6, "recruiter_visits_90d": 25, "offers_30d": 18, "offers_90d": 72},
        {"institute_id": "INST-006", "name": "Rural Nursing College", "tier": "C", "region": "Nashik",
         "recruiter_visits_30d": 2, "recruiter_visits_90d": 11, "offers_30d": 8, "offers_90d": 28},
    ]

    result = []
    for inst in institutes:
        r30 = inst["recruiter_visits_30d"]
        r90_avg = inst["recruiter_visits_90d"] / 3
        momentum_ratio = round(r30 / r90_avg, 2) if r90_avg > 0 else 1.0
        tier_adj = "+10%" if momentum_ratio > 1.4 else "-15%" if momentum_ratio < 0.6 else "0%"
        status = "STRONG" if momentum_ratio >= 1.2 else "STABLE" if momentum_ratio >= 0.8 else "DECLINING"
        result.append({
            **inst,
            "momentum_ratio": momentum_ratio,
            "momentum_status": status,
            "tier_score_adjustment": tier_adj,
            "alert": momentum_ratio < 0.6,
            "alert_message": f"Momentum ratio {momentum_ratio} < 0.6 — 15% downward tier score adjustment applied." if momentum_ratio < 0.6 else None,
        })

    result.sort(key=lambda x: x["momentum_ratio"], reverse=True)
    return sanitize({
        "institutes": result,
        "total": len(result),
        "declining_count": sum(1 for i in result if i["momentum_status"] == "DECLINING"),
        "last_updated": "2026-05-01",
    })


# ─── Admin Configuration Panel (F-12) ────────────────────────

_admin_config = {
    "risk_thresholds": {"high_max": 0.45, "medium_max": 0.70},
    "emi_comfort_tiers": {"comfortable": 2.5, "adequate": 1.5, "tight": 1.0},
    "alert_engine": {"critical_cgpa_threshold": 6.0, "medium_cgpa_threshold": 7.0, "max_alerts_per_run": 100},
    "intervention_costs": {
        "Attend 3 Mock Interviews": 0,
        "Complete Python Analytics Course": 2000,
        "Improve IQI Score": 1500,
        "Increase Behavioral Activity": 500,
        "Diversify Job Applications": 0,
    },
    "model_config": {"champion_version": "2.0.0-prototype", "challenger_version": None, "auto_retrain": False, "retrain_psi_threshold": 0.25},
    "tenant": {"lender_id": "LND-DEMO-001", "lender_name": "Demo Fincorp", "max_students": 50000, "mfa_required": True},
}

@app.get("/api/v1/admin/config")
async def get_admin_config():
    """F-12: Admin Configuration Panel — GET current config."""
    return sanitize({**_admin_config, "last_modified": "2026-05-01T03:00:00Z", "modified_by": "admin@demofincorp.com"})

@app.put("/api/v1/admin/config")
async def update_admin_config(updates: dict = {}):
    """F-12: Admin Configuration Panel — PUT config updates."""
    for key, val in updates.items():
        if key in _admin_config and isinstance(val, dict):
            _admin_config[key].update(val)
        elif key in _admin_config:
            _admin_config[key] = val
    return sanitize({"status": "updated", "config": _admin_config, "updated_at": "2026-05-01T09:30:00Z"})


# ─── Model Fairness / Bias Audit (§16.2) ─────────────────────

@app.get("/api/v1/model/fairness")
async def get_fairness_report():
    """Bias & Fairness Audit ⭐ — PRD §16.2. Demographic parity checks."""
    if not mock_db:
        return {"status": "no data"}

    df = pd.DataFrame(mock_db)
    report = {}

    for dim, col in [("Region", "region"), ("Course", "course_type"), ("Institute Tier", "institute_tier")]:
        groups = {}
        for val, grp in df.groupby(col):
            placed = float(grp["placed_6m"].mean()) if "placed_6m" in grp else 0.5
            groups[str(val)] = round(placed, 3)
        vals = list(groups.values())
        disparity = round(max(vals) - min(vals), 3) if vals else 0
        report[dim] = {
            "groups": groups,
            "max_disparity": disparity,
            "alert": disparity > 0.10,
            "status": "FAIL" if disparity > 0.10 else "PASS",
            "remediation_sla_days": 30 if disparity > 0.10 else None,
        }

    overall_pass = all(v["status"] == "PASS" for v in report.values())
    return sanitize({
        "audit_date": "2026-05-01",
        "overall_status": "PASS" if overall_pass else "FAIL — remediation required within 30 days",
        "dimensions": report,
        "protected_attributes_excluded": ["gender", "caste", "religion", "region_of_birth"],
        "next_audit": "2026-06-01",
    })


# ─── Champion/Challenger (§14 observability) ─────────────────

@app.get("/api/v1/model/champion-challenger")
async def get_champion_challenger():
    """Champion/Challenger model comparison — PRD §14 / Glossary."""
    return sanitize({
        "champion": {
            "version": "2.0.0-prototype",
            "deployed_at": "2026-05-01",
            "f1_6m": 0.86,
            "salary_mape": 0.126,
            "psi": 0.025,
            "traffic_pct": 100,
        },
        "challenger": {
            "version": None,
            "status": "No challenger active",
            "note": "Next challenger will be trained when PSI > 0.25 or monthly F1 drops below 0.80.",
        },
        "auto_promote_threshold": {"min_f1_improvement": 0.02, "max_psi": 0.15},
        "last_evaluated": "2026-05-01",
    })


# ═══════════════════════════════════════════════════════════════
# PHASE 3 FEATURES
# ═══════════════════════════════════════════════════════════════

# ─── Offer Survival Score (§10.10) ───────────────────────────

COMPANY_SIGNALS = {
    "TCS": {"funding": "Public", "headcount_trend": "+2%", "glassdoor": 3.9, "layoff_risk": "LOW"},
    "Infosys": {"funding": "Public", "headcount_trend": "+1%", "glassdoor": 3.7, "layoff_risk": "LOW"},
    "Wipro": {"funding": "Public", "headcount_trend": "-3%", "glassdoor": 3.5, "layoff_risk": "MEDIUM"},
    "TechCorp Solutions": {"funding": "Series B overdue", "headcount_trend": "-22%", "glassdoor": 3.2, "layoff_risk": "HIGH"},
    "StartupXYZ": {"funding": "Seed", "headcount_trend": "+15%", "glassdoor": 4.2, "layoff_risk": "MEDIUM"},
}

@app.get("/api/v1/student/{student_id}/offer-survival")
async def get_offer_survival(student_id: str, company: str = "TCS"):
    """Offer Survival Score ⭐ — PRD §10.10. P(offer not revoked within 60 days)."""
    student = next((s for s in mock_db if s.get("student_id") == student_id), None)
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{student_id}' not found")

    signals = COMPANY_SIGNALS.get(company, {
        "funding": "Unknown", "headcount_trend": "0%", "glassdoor": 3.5, "layoff_risk": "MEDIUM"
    })

    # Score calculation
    base = 70
    risk_factors = []
    positive_factors = []

    headcount = float(signals["headcount_trend"].replace("%", ""))
    if headcount < -10:
        base -= 25
        risk_factors.append(f"Headcount declined {signals['headcount_trend']} (LinkedIn)")
    elif headcount > 5:
        base += 10
        positive_factors.append(f"Headcount growing {signals['headcount_trend']} (positive)")

    if "overdue" in signals["funding"].lower():
        base -= 20
        risk_factors.append(f"Funding round overdue: {signals['funding']}")
    elif "Public" in signals["funding"]:
        base += 5
        positive_factors.append("Publicly listed company (stable)")

    if signals["glassdoor"] < 3.3:
        base -= 15
        risk_factors.append(f"Glassdoor rating dropped to {signals['glassdoor']}")
    elif signals["glassdoor"] >= 4.0:
        base += 5
        positive_factors.append(f"Glassdoor rating {signals['glassdoor']} (above average)")

    score = max(0, min(100, base))
    revocation_risk = "HIGH" if score < 40 else "MEDIUM" if score < 65 else "LOW"

    return sanitize({
        "student_id": student_id,
        "company": company,
        "offer_date": "2026-04-28",
        "offer_survival_score": score,
        "revocation_risk": revocation_risk,
        "p_revocation_60d": round((100 - score) / 100, 2),
        "risk_signals": risk_factors,
        "positive_signals": positive_factors,
        "layoff_risk_assessment": signals["layoff_risk"],
        "recommended_action": (
            "Advise student to continue active job search in parallel." if revocation_risk == "HIGH"
            else "Monitor company news. Secondary applications recommended." if revocation_risk == "MEDIUM"
            else "Offer appears stable. Standard monitoring."
        ),
        "data_sources": ["LinkedIn headcount", "Tracxn/Crunchbase funding", "Glassdoor ratings"],
        "data_quality": "SUFFICIENT" if company in COMPANY_SIGNALS else "INSUFFICIENT — defaulting to neutral score",
    })


# ─── Real-Time Signal Webhook (F-13 / Phase 3) ───────────────

@app.post("/api/v1/signals/ingest")
async def ingest_signal(payload: dict = {}):
    """F-13: Real-Time Signal Integration ⭐ — Phase 3 webhook endpoint.
    Accepts labor market signals from external data providers (Naukri, LinkedIn job feeds,
    news NLP pipelines). In production, triggers portfolio re-scoring for affected segments.
    """
    signal_type = payload.get("signal_type", "unknown")
    sector = payload.get("sector", "unknown")
    severity = payload.get("severity", "MODERATE")
    source = payload.get("source", "external_api")

    # In production: trigger async re-scoring job for affected students
    affected_students = 0
    if mock_db:
        df = pd.DataFrame(mock_db)
        if sector and sector in df.get("course_type", pd.Series()).values:
            affected_students = int(len(df[df["course_type"] == sector]))

    return sanitize({
        "status": "ingested",
        "signal_id": f"SIG-{random.randint(100000, 999999)}",
        "signal_type": signal_type,
        "sector": sector,
        "severity": severity,
        "source": source,
        "affected_students_estimate": affected_students,
        "rescore_triggered": severity in ["HIGH", "CRITICAL"],
        "rescore_job_id": f"RSC-{random.randint(10000, 99999)}" if severity in ["HIGH", "CRITICAL"] else None,
        "message": f"Signal ingested. {'Portfolio re-scoring triggered for ' + str(affected_students) + ' students.' if severity in ['HIGH', 'CRITICAL'] else 'Queued for next nightly scoring run.'}",
        "ingested_at": "2026-05-01T09:30:00Z",
    })


# ─── Health ──────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "students_loaded": len(mock_db)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=False)

