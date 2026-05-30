import math
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from scoring_engine import ScoringEngine, compute_profile_boost
from profile_fetchers import (
    fetch_github, github_score,
    fetch_linkedin, fetch_linkedin_pdl, fetch_linkedin_proxycurl, linkedin_score,
    fetch_naukri_cohort,
)
import pandas as pd
import numpy as np
import random
import sys, os

# Real market data (World Bank + news signals — fetched 2026-05-02)
from real_data_fetcher import (
    get_market_data,
    get_field_demand,
    get_active_shocks as _get_real_shocks,
    get_macro_climate_index,
)

# Add agents directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "agents"))

from agents.orchestrator import (
    score_student_full,
    score_student_fast,
    get_career_paths,
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


# ─── Derived Borrower Signals (PRD §A + §D coverage) ───────────────────────
# Problem-statement gaps from "Career Success.docx":
#   A.5 Skill certifications  — was not tracked
#   D   Interview pipeline    — was not tracked
#   D   Resume updates        — was not tracked
# These are derived deterministically per student_id so the prototype can demo
# the full data model without re-generating the underlying CSV.

CERTS_BY_FIELD = {
    "Engineering": [
        "Python for Analytics", "AWS Cloud Practitioner", "ML Specialization (Coursera)",
        "Java Spring Boot", "Linux LPIC-1", "Docker Certified Associate", "CCNA",
    ],
    "MBA": [
        "CFA Level I", "PMP", "Lean Six Sigma Green Belt", "Google Analytics IQ",
        "Tableau Desktop Specialist", "Bloomberg Market Concepts", "NISM Series-V",
    ],
    "Nursing": [
        "BLS (Basic Life Support)", "ACLS (Advanced Cardiac)", "Trauma Care (TNCC)",
        "Pediatric Advanced Life Support", "Infection Control Specialist",
        "Critical Care Nursing", "Wound Care Certified",
    ],
}

def _stable_hash(*parts) -> int:
    """Deterministic non-crypto hash (0..1B) for repeatable per-student signals."""
    s = "|".join(str(p) for p in parts)
    h = 5381
    for ch in s:
        h = ((h << 5) + h + ord(ch)) & 0xFFFFFFFF
    return h


def derive_student_signals(student: dict) -> dict:
    """
    Returns the three problem-statement signals that the underlying CSV doesn't
    carry: skill_certs_count + named list, interview_progress_score + breakdown,
    resume_freshness_days. Stable per student_id.
    """
    sid = student.get("student_id", "unknown")
    course = student.get("course_type", "Engineering")
    cgpa = float(student.get("cgpa", 7.0) or 7.0)
    internship = int(student.get("internship_months", 0) or 0)
    behavior = float(student.get("behavioral_activity_score", 50) or 50)
    iqi = float(student.get("iqi", 0.5) or 0.5)

    h = _stable_hash(sid)

    # — Skill certifications —
    # Better students (higher cgpa + internship + behavior) tend to hold more certs
    base = (cgpa - 4.0) * 0.25 + (internship / 6.0) * 0.4 + (behavior / 100.0) * 0.4
    base = max(0.0, min(1.0, base))
    # 0..5 certs, biased by base; sprinkle hash randomness
    cert_count = int(round(base * 4.2 + (h % 100) / 100.0))
    cert_count = max(0, min(5, cert_count))

    pool = CERTS_BY_FIELD.get(course, CERTS_BY_FIELD["Engineering"])
    picks = []
    if cert_count > 0:
        # Deterministic shuffle by walking the hash
        idxs = list(range(len(pool)))
        hh = h
        for i in range(len(idxs) - 1, 0, -1):
            hh = (hh * 1103515245 + 12345) & 0x7FFFFFFF
            j = hh % (i + 1)
            idxs[i], idxs[j] = idxs[j], idxs[i]
        picks = [pool[i] for i in idxs[:cert_count]]

    # — Interview pipeline progress (PRD D.2) —
    # Score combines behavioral signal (job-portal activity proxy) + internship + cgpa
    raw = behavior * 0.55 + (cgpa - 4) / 6 * 100 * 0.20 + min(internship, 6) / 6 * 100 * 0.25
    interview_progress = max(0, min(100, int(round(raw))))

    # Per-30d activity — scales with progress + small noise
    interviews_scheduled_30d = max(0, int(round(interview_progress / 14 + (h % 7) - 3)))
    cleared_ratio = 0.35 + (iqi * 0.30) + ((h >> 8) % 100) / 100 * 0.10
    interviews_cleared_30d = min(
        interviews_scheduled_30d,
        int(round(interviews_scheduled_30d * cleared_ratio))
    )

    # Stage breakdown (sums to scheduled count, approximately)
    stages = {
        "screening":  max(0, int(interviews_scheduled_30d * 0.45)),
        "technical":  max(0, int(interviews_scheduled_30d * 0.30)),
        "final":      max(0, int(interviews_scheduled_30d * 0.15)),
        "offer":      max(0, int(interviews_scheduled_30d * 0.10)),
    }

    # — Resume freshness (PRD D.3) —
    # Lower is better (more recent update). 0..120 days.
    freshness_base = 90 - behavior * 0.7
    resume_freshness_days = max(0, min(120, int(round(freshness_base + ((h >> 16) % 21) - 10))))

    return {
        "skill_certs_count": cert_count,
        "skill_certifications": picks,
        "interview_progress_score": interview_progress,
        "interviews_scheduled_30d": interviews_scheduled_30d,
        "interviews_cleared_30d": interviews_cleared_30d,
        "interview_stages_30d": stages,
        "resume_freshness_days": resume_freshness_days,
        "resume_last_updated_label": (
            "this week" if resume_freshness_days <= 7
            else "this month" if resume_freshness_days <= 30
            else f"{resume_freshness_days // 7}+ weeks ago"
        ),
    }


# ─── Recruiter Universe (PRD A.2 + NBA recruiter-matches gap) ─────────────
# Plausible employer set per (field × region) with sector + tier + open-roles
# signal. The matching endpoint joins on this and weights by student's iqi /
# employer_tier preference / interview_progress.

RECRUITER_UNIVERSE = {
    ("Engineering", "Bengaluru"): [
        {"name": "Infosys",        "sector": "IT Services",   "tier": "MNC",     "open_roles_30d": 1240, "avg_offer_inr": 620000},
        {"name": "Wipro",          "sector": "IT Services",   "tier": "MNC",     "open_roles_30d": 870,  "avg_offer_inr": 590000},
        {"name": "Flipkart",       "sector": "E-commerce",    "tier": "Unicorn", "open_roles_30d": 220,  "avg_offer_inr": 1850000},
        {"name": "Razorpay",       "sector": "Fintech",       "tier": "Unicorn", "open_roles_30d": 130,  "avg_offer_inr": 1620000},
        {"name": "Bosch Global",   "sector": "Manufacturing", "tier": "MNC",     "open_roles_30d": 95,   "avg_offer_inr": 780000},
        {"name": "Cisco India",    "sector": "Networking",    "tier": "MNC",     "open_roles_30d": 180,  "avg_offer_inr": 1450000},
    ],
    ("Engineering", "Hyderabad"): [
        {"name": "Microsoft IDC",  "sector": "Big Tech",      "tier": "MNC",     "open_roles_30d": 310,  "avg_offer_inr": 2400000},
        {"name": "TCS Hyderabad",  "sector": "IT Services",   "tier": "MNC",     "open_roles_30d": 920,  "avg_offer_inr": 580000},
        {"name": "ServiceNow",     "sector": "SaaS",          "tier": "MNC",     "open_roles_30d": 140,  "avg_offer_inr": 1900000},
        {"name": "Cognizant",      "sector": "IT Services",   "tier": "MNC",     "open_roles_30d": 680,  "avg_offer_inr": 560000},
        {"name": "Salesforce IDC", "sector": "SaaS",          "tier": "MNC",     "open_roles_30d": 160,  "avg_offer_inr": 1850000},
    ],
    ("Engineering", "Mumbai"): [
        {"name": "L&T Technology", "sector": "Engg Services", "tier": "MNC",     "open_roles_30d": 280, "avg_offer_inr": 720000},
        {"name": "Tata Consultancy","sector": "IT Services",  "tier": "MNC",     "open_roles_30d": 810, "avg_offer_inr": 580000},
        {"name": "JP Morgan Tech", "sector": "BFSI Tech",     "tier": "MNC",     "open_roles_30d": 95,  "avg_offer_inr": 1700000},
        {"name": "Reliance Jio",   "sector": "Telecom",       "tier": "MNC",     "open_roles_30d": 220, "avg_offer_inr": 850000},
    ],
    ("Engineering", "Pune"): [
        {"name": "Bajaj Auto Tech","sector": "Automotive",    "tier": "MNC",     "open_roles_30d": 110, "avg_offer_inr": 680000},
        {"name": "Persistent Systems","sector": "IT Services","tier": "MNC",     "open_roles_30d": 240, "avg_offer_inr": 640000},
        {"name": "ZS Associates",  "sector": "Analytics",     "tier": "MNC",     "open_roles_30d": 70,  "avg_offer_inr": 1250000},
        {"name": "Tata Motors",    "sector": "Automotive",    "tier": "MNC",     "open_roles_30d": 130, "avg_offer_inr": 720000},
    ],
    ("Engineering", "Delhi NCR"): [
        {"name": "HCL Technologies","sector": "IT Services",  "tier": "MNC",     "open_roles_30d": 530, "avg_offer_inr": 600000},
        {"name": "Adobe Noida",    "sector": "Big Tech",      "tier": "MNC",     "open_roles_30d": 110, "avg_offer_inr": 2150000},
        {"name": "Paytm",          "sector": "Fintech",       "tier": "Unicorn", "open_roles_30d": 80,  "avg_offer_inr": 1320000},
        {"name": "Maruti Suzuki R&D","sector": "Automotive",  "tier": "MNC",     "open_roles_30d": 95,  "avg_offer_inr": 760000},
    ],
    ("Engineering", "Chennai"): [
        {"name": "Zoho",           "sector": "SaaS",          "tier": "MNC",     "open_roles_30d": 180, "avg_offer_inr": 880000},
        {"name": "Freshworks",     "sector": "SaaS",          "tier": "Unicorn", "open_roles_30d": 130, "avg_offer_inr": 1450000},
        {"name": "Ford India",     "sector": "Automotive",    "tier": "MNC",     "open_roles_30d": 60,  "avg_offer_inr": 780000},
        {"name": "Infosys Chennai","sector": "IT Services",   "tier": "MNC",     "open_roles_30d": 720, "avg_offer_inr": 580000},
    ],

    ("MBA", "Mumbai"): [
        {"name": "HDFC Bank",       "sector": "BFSI",   "tier": "MNC",      "open_roles_30d": 220, "avg_offer_inr": 1450000},
        {"name": "Kotak Mahindra",  "sector": "BFSI",   "tier": "MNC",      "open_roles_30d": 180, "avg_offer_inr": 1350000},
        {"name": "Reliance Retail", "sector": "Retail", "tier": "MNC",      "open_roles_30d": 95,  "avg_offer_inr": 1150000},
        {"name": "ICICI Bank",      "sector": "BFSI",   "tier": "MNC",      "open_roles_30d": 240, "avg_offer_inr": 1380000},
        {"name": "McKinsey & Co",   "sector": "Consulting","tier": "MNC",   "open_roles_30d": 35,  "avg_offer_inr": 2750000},
    ],
    ("MBA", "Bengaluru"): [
        {"name": "Flipkart Bus.Ops","sector": "E-commerce", "tier": "Unicorn","open_roles_30d": 70,  "avg_offer_inr": 1850000},
        {"name": "Goldman Sachs BLR","sector": "BFSI",      "tier": "MNC",   "open_roles_30d": 45,  "avg_offer_inr": 2450000},
        {"name": "Accenture Strategy","sector": "Consulting","tier": "MNC", "open_roles_30d": 110, "avg_offer_inr": 1550000},
        {"name": "Walmart Global Tech","sector": "Retail",  "tier": "MNC",  "open_roles_30d": 85,  "avg_offer_inr": 1750000},
    ],
    ("MBA", "Delhi NCR"): [
        {"name": "Deloitte Consulting","sector": "Consulting","tier": "MNC","open_roles_30d": 130, "avg_offer_inr": 1650000},
        {"name": "EY India",        "sector": "Consulting", "tier": "MNC",  "open_roles_30d": 110, "avg_offer_inr": 1480000},
        {"name": "Bain & Company",  "sector": "Consulting", "tier": "MNC",  "open_roles_30d": 28,  "avg_offer_inr": 2800000},
        {"name": "Bharti Airtel",   "sector": "Telecom",    "tier": "MNC",  "open_roles_30d": 70,  "avg_offer_inr": 1320000},
    ],
    ("MBA", "Hyderabad"): [
        {"name": "Amazon Strategy", "sector": "E-commerce", "tier": "MNC",  "open_roles_30d": 85,  "avg_offer_inr": 1950000},
        {"name": "ICICI Lombard",   "sector": "Insurance",  "tier": "MNC",  "open_roles_30d": 60,  "avg_offer_inr": 1180000},
    ],
    ("MBA", "Pune"): [
        {"name": "Bajaj Finserv",   "sector": "BFSI",       "tier": "MNC",  "open_roles_30d": 95,  "avg_offer_inr": 1280000},
        {"name": "Cummins India",   "sector": "Manufacturing","tier": "MNC","open_roles_30d": 50,  "avg_offer_inr": 1150000},
    ],
    ("MBA", "Chennai"): [
        {"name": "TVS Capital",     "sector": "BFSI",       "tier": "MNC",  "open_roles_30d": 45,  "avg_offer_inr": 1180000},
        {"name": "Hyundai India",   "sector": "Automotive", "tier": "MNC",  "open_roles_30d": 55,  "avg_offer_inr": 1220000},
    ],

    ("Nursing", "Mumbai"): [
        {"name": "Kokilaben Dhirubhai Ambani Hospital", "sector": "Healthcare", "tier": "Premium", "open_roles_30d": 120, "avg_offer_inr": 420000},
        {"name": "Lilavati Hospital",                   "sector": "Healthcare", "tier": "Premium", "open_roles_30d": 85,  "avg_offer_inr": 380000},
        {"name": "Tata Memorial Centre",                "sector": "Healthcare", "tier": "Govt",    "open_roles_30d": 95,  "avg_offer_inr": 360000},
    ],
    ("Nursing", "Delhi NCR"): [
        {"name": "AIIMS Delhi",       "sector": "Healthcare", "tier": "Govt",    "open_roles_30d": 180, "avg_offer_inr": 380000},
        {"name": "Apollo Hospital",   "sector": "Healthcare", "tier": "Premium", "open_roles_30d": 110, "avg_offer_inr": 410000},
        {"name": "Max Healthcare",    "sector": "Healthcare", "tier": "Premium", "open_roles_30d": 95,  "avg_offer_inr": 400000},
    ],
    ("Nursing", "Bengaluru"): [
        {"name": "Manipal Hospital",  "sector": "Healthcare", "tier": "Premium", "open_roles_30d": 130, "avg_offer_inr": 430000},
        {"name": "Narayana Health",   "sector": "Healthcare", "tier": "Premium", "open_roles_30d": 110, "avg_offer_inr": 390000},
        {"name": "Fortis Hospital",   "sector": "Healthcare", "tier": "Premium", "open_roles_30d": 95,  "avg_offer_inr": 400000},
    ],
    ("Nursing", "Hyderabad"): [
        {"name": "Yashoda Hospitals", "sector": "Healthcare", "tier": "Premium", "open_roles_30d": 105, "avg_offer_inr": 380000},
        {"name": "Continental Hospitals", "sector": "Healthcare", "tier": "Premium", "open_roles_30d": 65, "avg_offer_inr": 410000},
    ],
    ("Nursing", "Chennai"): [
        {"name": "Apollo Hospital Chennai", "sector": "Healthcare", "tier": "Premium", "open_roles_30d": 140, "avg_offer_inr": 420000},
        {"name": "MIOT International",      "sector": "Healthcare", "tier": "Premium", "open_roles_30d": 70,  "avg_offer_inr": 395000},
    ],
    ("Nursing", "Pune"): [
        {"name": "Ruby Hall Clinic",  "sector": "Healthcare", "tier": "Premium", "open_roles_30d": 75,  "avg_offer_inr": 370000},
        {"name": "Sahyadri Hospital", "sector": "Healthcare", "tier": "Premium", "open_roles_30d": 55,  "avg_offer_inr": 360000},
    ],
}


def match_recruiters(student: dict, top_n: int = 6) -> list:
    """
    Joins student profile (course × region × iqi × employer_tier preference)
    against RECRUITER_UNIVERSE. Ranks by a blended match score and returns
    top_n recommendations with explainable component breakdown.
    """
    course = student.get("course_type", "Engineering")
    region = student.get("region", "Bengaluru")
    pref_tier = student.get("employer_tier", "MNC")
    iqi = float(student.get("iqi", 0.5) or 0.5)

    derived = derive_student_signals(student)
    pipeline_pct = derived["interview_progress_score"] / 100.0

    pool = RECRUITER_UNIVERSE.get((course, region), [])
    if not pool:
        # Fall back to course-only pool, mixing other regions
        pool = []
        for (c, _r), recs in RECRUITER_UNIVERSE.items():
            if c == course:
                pool.extend(recs)

    matches = []
    max_roles = max((r["open_roles_30d"] for r in pool), default=1)
    for r in pool:
        # Component scores (0..1)
        demand_score = r["open_roles_30d"] / max_roles
        tier_score = 1.0 if r["tier"] == pref_tier else 0.55
        iqi_score = min(1.0, iqi + 0.30)  # higher iqi → broader eligibility
        pipeline_score = 0.55 + pipeline_pct * 0.45

        match_pct = round(
            (demand_score * 0.30 + tier_score * 0.25 + iqi_score * 0.20 + pipeline_score * 0.25) * 100, 1
        )
        matches.append({
            **r,
            "match_pct": match_pct,
            "rationale": _recruiter_rationale(r, demand_score, tier_score, iqi_score, pipeline_score, pref_tier),
        })

    matches.sort(key=lambda m: m["match_pct"], reverse=True)
    return matches[:top_n]


def _recruiter_rationale(r, demand, tier, iqi_s, pipeline, pref_tier):
    pieces = []
    if demand >= 0.70:
        pieces.append(f"{r['open_roles_30d']} open roles in last 30d")
    if r["tier"] == pref_tier:
        pieces.append(f"matches preferred {pref_tier} tier")
    if iqi_s >= 0.75:
        pieces.append("institute IQI in eligibility band")
    if pipeline >= 0.80:
        pieces.append("strong interview pipeline momentum")
    if not pieces:
        pieces.append(f"{r['sector']} demand in this region")
    return " · ".join(pieces)

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


# Note: /api/v1/shocks/active is defined later (around line ~550) and uses
# real market data from real_data_fetcher (no LLM key required).


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
    """Returns a full scored profile for a specific student.

    Profile now includes derived problem-statement signals (PRD gap fix):
      - skill_certifications (PRD A.5)
      - interview_progress_score + breakdown (PRD D.2)
      - resume_freshness_days (PRD D.3)
    """
    student = next((s for s in mock_db if s.get("student_id") == student_id), None)
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{student_id}' not found")

    try:
        score = engine.score_student(dict(student))
        # Merge derived signals into the profile so the frontend can render them
        enriched_profile = {**dict(student), **derive_student_signals(dict(student))}
        return sanitize({
            "profile": enriched_profile,
            "analysis": score,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoring error: {str(e)}")


@app.get("/api/v1/student/{student_id}/recruiter-matches")
async def get_recruiter_matches(student_id: str, top_n: int = 6):
    """Recruiter-Matches engine ⭐ — PRD next-best-action: 'high-potential recruiter matches'.

    Joins student profile (course × region × employer_tier × iqi × interview_progress)
    against RECRUITER_UNIVERSE and returns ranked, explainable matches.
    """
    student = next((s for s in mock_db if s.get("student_id") == student_id), None)
    if not student:
        raise HTTPException(status_code=404, detail=f"Student '{student_id}' not found")

    matches = match_recruiters(dict(student), top_n=top_n)
    derived = derive_student_signals(dict(student))
    return sanitize({
        "student_id": student_id,
        "course": student.get("course_type"),
        "region": student.get("region"),
        "preferred_employer_tier": student.get("employer_tier"),
        "interview_progress_score": derived["interview_progress_score"],
        "matches": matches,
        "total_in_pool": len(RECRUITER_UNIVERSE.get((student.get("course_type"), student.get("region")), [])),
        "data_note": "Recruiter universe synthesized from Foundit/Naukri 2025 posting volumes + "
                     "campus-placement reports. Match score blends demand (30%), tier fit (25%), "
                     "IQI eligibility (20%), and interview-pipeline momentum (25%).",
    })


class LoanApplication(BaseModel):
    """Loan application payload from the borrower-side /me/apply form."""
    student_id: str = "STU-DEMO-PENDING"
    name: str = "Applicant"
    # Academic
    course_type: str = "Engineering"
    year: str = "Final year"
    cgpa: float = Field(default=7.5, ge=0.0, le=10.0)
    institute_name: str = ""
    institute_tier: str = "B"
    region: str = "Pune"
    internship_months: int = Field(default=3, ge=0)
    employer_tier: str = "MNC"
    # Financial
    loan_amount: int = Field(default=600000, ge=0)
    monthly_emi: int = Field(default=12000, ge=0)
    co_applicant_income: int = Field(default=0, ge=0)
    employment_type: str = "Salaried co-applicant"


@app.post("/api/v1/loan/prescreen")
async def loan_prescreen(app_data: LoanApplication):
    """Loan pre-screen ⭐ — instant placement-risk scoring for a new borrower.

    Takes the application form payload, builds a synthetic student dict in the
    shape the ScoringEngine expects, runs the full ML + SHAP + NBA pipeline,
    appends derived borrower signals (skill certs, interview progress, resume
    freshness) and the top recruiter matches. This is the borrower-facing
    counterpart to /api/v1/student/{id}.
    """
    # Map form fields → scoring-engine input shape.
    # Derive iqi / behavioral / field_demand / macro_climate from the form
    # using the same deterministic hash logic as the rest of the codebase so
    # re-submissions are stable.
    h = _stable_hash(app_data.student_id, app_data.course_type, app_data.cgpa)

    iqi_base = min(0.45, 0.10 + (app_data.cgpa - 4) / 6 * 0.30 + min(app_data.internship_months, 6) / 6 * 0.10)
    behavior = min(100, int(40 + (app_data.cgpa - 4) / 6 * 35 + min(app_data.internship_months, 6) / 6 * 25 + (h % 11)))

    # field_demand_score by course × region (table reflects current heatmap)
    DEMAND_TABLE = {
        ("Engineering", "Bengaluru"): 88, ("Engineering", "Hyderabad"): 82,
        ("Engineering", "Mumbai"): 71,    ("Engineering", "Pune"): 76,
        ("Engineering", "Delhi NCR"): 75, ("Engineering", "Chennai"): 70,
        ("MBA", "Mumbai"): 82,            ("MBA", "Bengaluru"): 78,
        ("MBA", "Delhi NCR"): 80,         ("MBA", "Hyderabad"): 70,
        ("MBA", "Pune"): 72,              ("MBA", "Chennai"): 67,
        ("Nursing", "Bengaluru"): 79,     ("Nursing", "Delhi NCR"): 84,
        ("Nursing", "Mumbai"): 76,        ("Nursing", "Hyderabad"): 74,
        ("Nursing", "Chennai"): 81,       ("Nursing", "Pune"): 71,
    }
    field_demand = DEMAND_TABLE.get((app_data.course_type, app_data.region), 65)
    macro_climate = round(0.65 + (field_demand / 100) * 0.25, 2)

    student_dict = {
        "student_id": app_data.student_id,
        "course_type": app_data.course_type,
        "institute_tier": app_data.institute_tier,
        "region": app_data.region,
        "cgpa": app_data.cgpa,
        "internship_months": app_data.internship_months,
        "employer_tier": app_data.employer_tier,
        "iqi": round(iqi_base, 3),
        "behavioral_activity_score": behavior,
        "field_demand_score": field_demand,
        "macro_climate_index": macro_climate,
        "monthly_emi": app_data.monthly_emi,
    }

    try:
        score = engine.score_student(student_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoring error: {str(e)}")

    derived = derive_student_signals(student_dict)
    matches = match_recruiters(student_dict, top_n=3)

    # Indicative offer — simple deterministic mapping from risk band
    risk_band = score.get("prediction", {}).get("risk_band", "MEDIUM")
    sanctioned = app_data.loan_amount
    interest_band = {
        "LOW":    {"min": 9.5,  "max": 11.0},
        "MEDIUM": {"min": 10.5, "max": 12.5},
        "HIGH":   {"min": 12.5, "max": 14.5},
    }.get(risk_band, {"min": 11.0, "max": 13.0})

    if risk_band == "HIGH":
        sanctioned = int(app_data.loan_amount * 0.75)

    return sanitize({
        "applicant": {
            "student_id": app_data.student_id,
            "name": app_data.name,
            "course_type": app_data.course_type,
            "region": app_data.region,
            "institute_tier": app_data.institute_tier,
            "cgpa": app_data.cgpa,
            "loan_requested": app_data.loan_amount,
            "monthly_emi": app_data.monthly_emi,
            **derived,  # skill certs + interview pipeline + resume freshness
        },
        "scored_input": student_dict,
        "prediction": score.get("prediction", {}),
        "insights": score.get("insights", {}),
        "explainability": score.get("explainability", {}),
        "recruiter_matches": matches,
        "indicative_offer": {
            "status": "PRE-APPROVED" if risk_band in ("LOW", "MEDIUM") else "CONDITIONAL",
            "requested_amount": app_data.loan_amount,
            "sanctioned_amount": sanctioned,
            "interest_rate_band_pct": interest_band,
            "tenure_years": 7,
            "conditions": [
                "EMI auto-debit consent required",
                "Quarterly placement-progress check-in",
            ] + (["Co-applicant guarantor required (HIGH risk band)"] if risk_band == "HIGH" else []),
        },
        "data_note": "Pre-screen scored by the same XGBoost + LightGBM + SHAP pipeline that powers the lender dashboard. "
                     "Score is indicative; final sanction requires lender review.",
    })


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


@app.get("/api/v1/model/data-provenance")
async def get_data_provenance():
    """
    Returns where the active model was trained from — synthetic or AMCAT-mapped —
    with row count, F1 / MAPE, and trained-at timestamp. Reads
    models/model_provenance.json (written by model_pipeline.py).
    Falls back to a static snapshot when the file is missing.
    """
    import json
    import os as _os

    base = _os.path.dirname(_os.path.abspath(__file__))
    candidates = [
        ('synthetic', _os.path.join(base, 'models', 'model_provenance.json')),
        ('amcat',     _os.path.join(base, 'models', 'model_provenance-amcat.json')),
        ('combined',  _os.path.join(base, 'models', 'model_provenance-combined.json')),
    ]

    # Preference order for "active" — combined > amcat > synthetic
    PREFERENCE = {'synthetic': 0, 'amcat': 1, 'combined': 2}

    payload = {
        "active":  None,
        "variants": [],
    }

    for key, path in candidates:
        if _os.path.exists(path):
            try:
                with open(path) as fh:
                    prov = json.load(fh)
                prov['_kind'] = key
                payload['variants'].append(prov)
                if payload['active'] is None or PREFERENCE[key] > PREFERENCE[payload['active']['_kind']]:
                    payload['active'] = prov
            except Exception:
                pass

    if not payload['variants']:
        # No provenance files yet — return the historical static metadata so
        # the admin pill never breaks on a fresh checkout.
        payload['active'] = {
            "_kind":             "synthetic",
            "source":            "synthetic",
            "source_path":       "data/synthetic_students.csv",
            "row_count":         10000,
            "classifier_f1_6m":  0.83,
            "salary_mape":       0.126,
            "trained_at_utc":    None,
            "model_files": {"classifier": "placement_classifier.pkl"},
            "note":              "Provenance file missing — run `python model_pipeline.py` to regenerate.",
        }
        payload['variants'].append(payload['active'])

    return sanitize(payload)


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
    """Mark an alert as acknowledged by the RM (PRD 11.2)."""
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


# ─── Placement Shock Detector — real data ──────────────────────────────────

@app.get("/api/v1/shocks/active")
async def get_active_shocks():
    """
    Placement Shock Detector ⭐ — returns active macro-level shock events.
    Powered by real market data: World Bank macro signals + India tech hiring news.
    Sources: Business Standard, ZeeBiz, Inc42 — refreshed 2026-05-02.
    """
    real_shocks = _get_real_shocks()
    df = pd.DataFrame(mock_db) if mock_db else pd.DataFrame()

    enriched = []
    for s in real_shocks:
        cities = s.get("geography", [])
        course_map = {
            "IT Services": "Engineering",
            "Edtech": "Engineering",
            "BFSI": "MBA",
        }
        course = course_map.get(s.get("sector", ""), None)

        if not df.empty and cities and course:
            affected = int(len(
                df[df["region"].isin(cities) & (df["course_type"] == course)]
            ))
        else:
            affected = s.get("affected_students", 0)

        enriched.append({
            "shock_id": s.get("id", "SHOCK-UNKNOWN"),
            "detected_at": f"{s.get('start_date', '2025-01-01')}T00:00:00Z",
            "sector": s.get("sector"),
            "geography": cities,
            "trigger": s.get("trigger"),
            "severity": s.get("severity"),
            "affected_students": affected,
            "wow_change_pct": s.get("wow_change_pct"),
            "recommended_action": s.get("recommended_action"),
            "macro_climate_override": round(
                max(0.2, get_macro_climate_index() - abs(s.get("wow_change_pct", 0)) / 200), 2
            ),
            "data_source": s.get("data_source", "real_data_fetcher"),
        })

    total_affected = sum(s["affected_students"] for s in enriched)
    mdata = get_market_data()
    return sanitize({
        "shocks": enriched,
        "total": len(enriched),
        "total_affected_students": total_affected,
        "overall_sentiment": mdata.get("overall_market_sentiment", "CAUTIOUS"),
        "positive_signals_count": len(mdata.get("positive_signals", [])),
        "last_scan": mdata.get("_meta", {}).get("fetched_at", "2026-05-02"),
        "data_source": "real_data_fetcher — World Bank + India market news 2025",
    })


# ─── Dynamic Employability Heatmap ──────────────────────────────────────────

@app.get("/api/v1/heatmap/demand")
async def get_heatmap_demand(field: str = None, region: str = None):
    """
    Dynamic Employability Heatmap ⭐ — field × region demand grid.
    Scores sourced from real market data: World Bank macro + India job portal
    statistics (Foundit/Naukri) + nursing/MBA placement reports 2025.
    """
    all_fields = ["Engineering", "MBA", "Nursing"]
    all_regions = ["Mumbai", "Bengaluru", "Delhi NCR", "Pune", "Hyderabad", "Chennai"]
    mdata = get_market_data()
    fetched_at = mdata.get("_meta", {}).get("fetched_at", "2026-05-02")

    grid = []
    for f in all_fields:
        if field and f != field:
            continue
        for r in all_regions:
            if region and r != region:
                continue
            cell = get_field_demand(f, r)
            score = cell.get("demand_score", 60)
            grid.append({
                "field": f,
                "region": r,
                "demand_score": score,
                "trend": cell.get("trend", "0.0%"),
                "top_roles": cell.get("top_roles", []),
                "avg_fresher_salary_inr": cell.get("avg_fresher_salary_inr", 0),
                "notes": cell.get("notes", ""),
                "risk_level": "HIGH" if score >= 75 else "MEDIUM" if score >= 55 else "LOW",
                "data_source": "real — World Bank + Foundit/Naukri + placement reports 2025",
            })

    return sanitize({
        "grid": grid,
        "total_cells": len(grid),
        "last_updated": fetched_at,
        "macro_climate_index": get_macro_climate_index(),
        "filters_applied": {"field": field, "region": region},
        "data_note": "Demand scores derived from real job posting volumes (Foundit/Naukri), "
                     "World Bank employment indicators, and India placement reports 2025.",
    })


# ─── Action Completion Tracker (F-11 / NBA) ─────────────────────────────────

@app.post("/api/v1/nba/{student_id}/action/complete")
async def mark_nba_complete(student_id: str, data: dict = {}):
    """
    Action Completion Tracker ⭐ — marks an NBA action as completed.
    Triggers score refresh in production. PRD 10.11.
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
    # Expose active LLM provider/model so the UI can stop hardcoding "Groq · llama-3.1-8b"
    try:
        import config as _cfg
        llm = {
            "provider": _cfg.ACTIVE_PROVIDER,
            "model": _cfg.MODEL,
            "configured": bool(_cfg.API_KEY),
        }
    except Exception as e:
        llm = {"provider": None, "model": None, "configured": False, "error": str(e)}
    try:
        variant = engine.variant
    except Exception:
        variant = None
    return {
        "status": "ok",
        "students_loaded": len(mock_db),
        "llm": llm,
        "model_variant": variant,
    }



# ═══════════════════════════════════════════════════════════════
# PHASE 2 FEATURES
# ═══════════════════════════════════════════════════════════════

# ─── Alternate Career Path Engine (10.4) ────────────────────

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
    """Alternate Career Path Engine ⭐ — PRD 10.4"""
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
        "note": "PRD 10.4 OQ-07: recommendations filtered to student geography. Relocation options available in Phase 2+.",
    })


# ─── Cold-Start Institute Scoring (10.7) ────────────────────

@app.post("/api/v1/institute/cold-start")
async def cold_start_institute(data: dict = {}):
    """Cold-Start Institute Scoring ⭐ — PRD 10.7. KNN-based synthetic baseline."""
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


# ─── Batch Peer Velocity Tracker (10.9) ─────────────────────

@app.get("/api/v1/cohort/velocity")
async def get_peer_velocity(course_type: str = None, institute_tier: str = None):
    """Batch Peer Velocity Tracker ⭐ — PRD 10.9. Tracks cohort placement speed."""
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


# ─── Institute Momentum Index (10.12) ───────────────────────

@app.get("/api/v1/institutes/momentum")
async def get_institute_momentum():
    """Institute Momentum Index ⭐ — PRD 10.12. Rolling recruiter + offer trends."""
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


# ─── Model Fairness / Bias Audit (16.2) ─────────────────────

@app.get("/api/v1/model/fairness")
async def get_fairness_report():
    """Bias & Fairness Audit ⭐ — PRD 16.2. Demographic parity checks."""
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


# ─── Champion/Challenger (14 observability) ─────────────────

@app.get("/api/v1/model/champion-challenger")
async def get_champion_challenger():
    """Champion/Challenger model comparison — PRD 14 / Glossary."""
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

# ─── Offer Survival Score (10.10) ───────────────────────────

COMPANY_SIGNALS = {
    "TCS": {"funding": "Public", "headcount_trend": "+2%", "glassdoor": 3.9, "layoff_risk": "LOW"},
    "Infosys": {"funding": "Public", "headcount_trend": "+1%", "glassdoor": 3.7, "layoff_risk": "LOW"},
    "Wipro": {"funding": "Public", "headcount_trend": "-3%", "glassdoor": 3.5, "layoff_risk": "MEDIUM"},
    "TechCorp Solutions": {"funding": "Series B overdue", "headcount_trend": "-22%", "glassdoor": 3.2, "layoff_risk": "HIGH"},
    "StartupXYZ": {"funding": "Seed", "headcount_trend": "+15%", "glassdoor": 4.2, "layoff_risk": "MEDIUM"},
}

@app.get("/api/v1/student/{student_id}/offer-survival")
async def get_offer_survival(student_id: str, company: str = "TCS"):
    """Offer Survival Score ⭐ — PRD 10.10. P(offer not revoked within 60 days)."""
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


# ═══════════════════════════════════════════════════════════════
# PHASE 4 — PROFILE LINKING, AI DECISIONING, PORTFOLIO KPIs
# ═══════════════════════════════════════════════════════════════

# In-memory profile store (resets on backend restart — fine for demo).
# Keyed by student_id → { provider → { username, profile_data, profile_score, linked_at } }
linked_profiles_store: dict[str, dict[str, dict]] = {}
loan_decisions_store: dict[str, dict] = {}

class ProfileLinkRequest(BaseModel):
    student_id: str
    provider: str  # "github" | "linkedin" | "naukri"
    username: str

class LoanDecisionRequest(BaseModel):
    student_id: str


def _synthesize_github_profile(username: str, h: int) -> tuple[dict, int]:
    """Deterministic mock of a GitHub profile based on username hash."""
    repos = 12 + (h % 60)
    followers = 8 + (h % 240)
    stars = 25 + (h % 380)
    contributions_yr = 180 + (h % 700)
    streak = 4 + (h % 90)
    top_langs = ["Python", "JavaScript", "TypeScript", "Go", "Rust"][:(1 + (h % 4))]
    score = min(100, int(20 + repos * 0.5 + min(stars, 200) * 0.15 + min(contributions_yr, 800) * 0.05))
    return {
        "username": username,
        "avatar_url": f"https://github.com/{username}.png",
        "public_repos": repos,
        "followers": followers,
        "stars_earned": stars,
        "contributions_last_year": contributions_yr,
        "current_streak_days": streak,
        "top_languages": top_langs,
        "profile_url": f"https://github.com/{username}",
    }, score


def _synthesize_linkedin_profile(username: str, h: int, student: dict) -> tuple[dict, int]:
    """Mock LinkedIn — based on student's existing record so it looks coherent."""
    course = student.get("course_type", "Engineering")
    region = student.get("region", "Bengaluru")
    headlines = {
        "Engineering": f"CS student @ {student.get('institute_tier', 'B')}-tier institute · Open to SDE/Analyst roles",
        "MBA": f"MBA Finance candidate · Interested in IB / Equity Research / Corporate Finance",
        "Nursing": f"BSc Nursing · ACLS-certified · Seeking critical-care positions",
    }
    connections = 80 + (h % 480)
    endorsements = 5 + (h % 35)
    skills = {
        "Engineering": ["Python", "Data Structures", "SQL", "REST APIs", "Git"],
        "MBA": ["Financial Modeling", "Excel", "Equity Research", "DCF Valuation", "PowerPoint"],
        "Nursing": ["Patient Care", "ACLS", "Triage", "EMR Systems", "Critical Care"],
    }.get(course, ["Communication", "Teamwork", "Problem Solving"])
    completeness = min(100, 55 + (h % 40))
    score = min(100, int(completeness * 0.5 + min(connections, 500) * 0.06 + endorsements * 0.4))
    return {
        "username": username,
        "headline": headlines.get(course, f"{course} student in {region}"),
        "connections": connections,
        "endorsements": endorsements,
        "profile_completeness_pct": completeness,
        "top_skills": skills,
        "open_to_work": True,
        "profile_url": f"https://linkedin.com/in/{username}",
        "_note": "Simulated profile data — real LinkedIn API limited to name+headline since 2018",
    }, score


def _synthesize_naukri_profile(username: str, h: int, student: dict) -> tuple[dict, int]:
    """Mock Naukri job-board activity."""
    applications = 8 + (h % 45)
    recruiter_views = 12 + (h % 90)
    callbacks = max(1, int(applications * 0.18))
    profile_views_30d = 20 + (h % 120)
    score = min(100, int(applications * 1.2 + recruiter_views * 0.25 + callbacks * 4))
    return {
        "username": username,
        "applications_30d": applications,
        "recruiter_views_30d": recruiter_views,
        "callbacks_30d": callbacks,
        "profile_views_30d": profile_views_30d,
        "resume_visibility": "Public to recruiters",
        "preferred_roles": ["Software Engineer", "Data Analyst"] if student.get("course_type") == "Engineering" else ["Associate", "Analyst"],
        "_note": "Simulated profile data — Naukri has no public API for individual borrower activity",
    }, score


@app.post("/api/v1/profile/link")
async def link_profile(req: ProfileLinkRequest):
    """Mock OAuth completion for GitHub/LinkedIn/Naukri. Stores synthesized profile
    data + score in memory. Real OAuth is out of scope for demo (LinkedIn deprecated
    profile-data API in 2018; Naukri has no public API)."""
    provider = req.provider.lower()
    if provider not in ("github", "linkedin", "naukri"):
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")

    student = next((s for s in mock_db if s.get("student_id") == req.student_id), None) or {
        "student_id": req.student_id, "course_type": "Engineering", "region": "Bengaluru", "institute_tier": "B",
    }
    h = _stable_hash(req.student_id, provider, req.username)
    live_data = False  # True only when real-API fetch succeeded with meaningful data

    if provider == "github":
        real = fetch_github(req.username)
        if real:
            profile_data, score = real, github_score(real)
            live_data = True
        else:
            profile_data, score = _synthesize_github_profile(req.username, h)
            profile_data["_source"] = "Simulated · GitHub user not found or API rate-limited"

    elif provider == "linkedin":
        # Priority chain: PDL (rich, free 100 credits) → Proxycurl (rich, free 10 credits)
        # → public-page OG probe (free, usually bot-blocked) → synthesizer fallback
        real = fetch_linkedin_pdl(req.username) or fetch_linkedin_proxycurl(req.username) or fetch_linkedin(req.username)
        # If the fetcher gave us meaningful data (name OR headline OR avatar OR experience), call it live
        has_real_data = bool(real and (real.get("name") or real.get("headline") or real.get("avatar_url") or real.get("experience_count")))
        if has_real_data:
            # Merge real signals on top of a synthesized base so all card fields render
            base, base_score = _synthesize_linkedin_profile(req.username, h, student)
            profile_data = {**base, **{k: v for k, v in real.items() if v is not None}}
            score = max(linkedin_score(real), base_score)
            live_data = True
        else:
            profile_data, score = _synthesize_linkedin_profile(req.username, h, student)
            # Carry probe result so UI can show "URL verified" if reachable
            if real:
                profile_data["url_reachable"] = real.get("url_reachable", False)
                profile_data["http_status"] = real.get("http_status")
            profile_data["_source"] = (
                real.get("_source") if real else
                "Simulated · set PDL_API_KEY or PROXYCURL_API_KEY in backend/.env for real LinkedIn data"
            )

    else:  # naukri
        # Per-borrower activity (apps, recruiter views) is NOT fetchable — stays simulated.
        # But we enrich with a REAL cohort-level job-market signal from Adzuna India.
        profile_data, score = _synthesize_naukri_profile(req.username, h, student)
        cohort = fetch_naukri_cohort(student.get("course_type", "Engineering"), student.get("region", "Bengaluru"))
        if cohort:
            profile_data["cohort_signal"] = cohort
            profile_data["_source"] = "Hybrid · Adzuna India for cohort job-market · borrower activity simulated (Naukri has no public per-user API)"
            live_data = True  # cohort signal is real even if per-user is synthetic
        else:
            profile_data["_source"] = "Simulated · Naukri has no public per-user API · configure ADZUNA_APP_ID/KEY in .env to add live cohort signal"

    from datetime import datetime, timezone
    entry = {
        "provider": provider,
        "username": req.username,
        "profile_data": profile_data,
        "profile_score": score,
        "live_data": live_data,
        "source_label": profile_data.get("_source", ""),
        "linked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    linked_profiles_store.setdefault(req.student_id, {})[provider] = entry
    return sanitize(entry)


@app.delete("/api/v1/profile/{student_id}/{provider}")
async def unlink_profile(student_id: str, provider: str):
    """Disconnect a linked profile."""
    if student_id in linked_profiles_store and provider in linked_profiles_store[student_id]:
        del linked_profiles_store[student_id][provider]
        return {"status": "unlinked", "provider": provider}
    raise HTTPException(status_code=404, detail="Profile not linked")


@app.get("/api/v1/profile/{student_id}")
async def get_linked_profiles(student_id: str):
    """Returns all linked profiles for a student + aggregate boost score."""
    profiles = linked_profiles_store.get(student_id, {})
    boost_pp, reasons = compute_profile_boost(profiles)
    return sanitize({
        "student_id": student_id,
        "linked_profiles": profiles,
        "providers_linked": list(profiles.keys()),
        "aggregate_boost_pp": boost_pp,
        "boost_reasons": reasons,
        "max_possible_boost_pp": 15.0,
    })


@app.post("/api/v1/loan/decide")
async def decide_loan(req: LoanDecisionRequest):
    """Final AI loan decisioning — advisory APPROVE/CONDITIONAL/DENY combining
    prescreen risk + grades + college + linked profile boost. NEVER auto-denies
    purely on placement risk — always provides a manual-review escalation path.
    """
    # Need a recent prescreen to decide on. For a demo, also accept students from mock_db.
    student = next((s for s in mock_db if s.get("student_id") == req.student_id), None)

    if not student:
        # No record in mock_db — return a neutral CONDITIONAL with explanation.
        profiles = linked_profiles_store.get(req.student_id, {})
        return sanitize({
            "decision": "CONDITIONAL",
            "decision_reasons": [
                "No prior application found on file for this borrower",
                "Complete the loan prescreen first so the model has features to score against",
            ],
            "adjusted_risk_band": "MEDIUM",
            "adjusted_placement_6m": None,
            "profile_boost_applied_pp": 0,
            "profile_boost_reasons": [],
            "providers_linked": list(profiles.keys()),
            "final_offer": None,
            "fairness_note": "Decision is advisory; final underwriting includes co-borrower review and is never based solely on placement-risk prediction.",
        })

    # Build a scoring dict from the mock student record
    scoring_input = {
        "student_id":                  student.get("student_id"),
        "course_type":                 student.get("course_type", "Engineering"),
        "institute_tier":              student.get("institute_tier", "B"),
        "region":                      student.get("region", "Bengaluru"),
        "cgpa":                        float(student.get("cgpa", 7.0)),
        "internship_months":           int(student.get("internship_months", 0)),
        "employer_tier":               student.get("employer_tier", "Startup"),
        "iqi":                         float(student.get("iqi", 0.3)),
        "behavioral_activity_score":   int(student.get("behavioral_activity_score", 50)),
        "field_demand_score":          float(student.get("field_demand_score", 65)),
        "macro_climate_index":         float(student.get("macro_climate_index", 0.7)),
        "monthly_emi":                 int(student.get("monthly_emi", 15000)),
    }

    try:
        score = engine.score_student(scoring_input)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoring error: {e}")

    pred = score.get("prediction", {})
    insights = score.get("insights", {})
    base_p6m = pred.get("placement_probability", {}).get("6m", 0.5)
    risk_band = pred.get("risk_band", "MEDIUM")
    emi_comfort = insights.get("emi_comfort_index", 0.0)
    cgpa = scoring_input["cgpa"]

    # Profile boost
    profiles = linked_profiles_store.get(req.student_id, {})
    boost_pp, boost_reasons = compute_profile_boost(profiles)
    adjusted_p6m = round(min(1.0, base_p6m + boost_pp / 100.0), 3)

    # Recompute adjusted risk band with boosted probability
    if adjusted_p6m >= 0.70:
        adjusted_band = "LOW"
    elif adjusted_p6m >= 0.45:
        adjusted_band = "MEDIUM"
    else:
        adjusted_band = "HIGH"
    # Hard overrides still apply
    if emi_comfort < 1.0 and emi_comfort != 99.0:
        adjusted_band = "HIGH"

    # Decision logic
    reasons = []
    if adjusted_band == "LOW" and emi_comfort >= 2.0 and len(profiles) >= 1:
        decision = "APPROVE"
        reasons.append(f"Low placement risk: {int(adjusted_p6m*100)}% probability at 6 months")
        reasons.append(f"Healthy EMI comfort: {emi_comfort:.1f}× monthly salary covers EMI")
        reasons.append(f"{len(profiles)} external profile(s) linked, lifting score by {boost_pp}pp")
    elif adjusted_band == "HIGH" and emi_comfort < 1.0 and cgpa < 6.0:
        decision = "DENY"
        reasons.append(f"High placement risk: only {int(adjusted_p6m*100)}% probability at 6 months")
        reasons.append(f"EMI comfort {emi_comfort:.1f}× is below 1.0× — projected salary won't cover EMI")
        reasons.append(f"CGPA {cgpa:.2f} below safe-threshold of 6.0")
        reasons.append("Manual underwriting review available — co-borrower income may change outcome")
    else:
        decision = "CONDITIONAL"
        if adjusted_band == "MEDIUM":
            reasons.append(f"Medium placement risk: {int(adjusted_p6m*100)}% probability — meets approval floor")
        elif adjusted_band == "HIGH":
            reasons.append(f"Elevated placement risk: {int(adjusted_p6m*100)}% probability")
        if emi_comfort < 2.0 and emi_comfort >= 1.0:
            reasons.append(f"Tight EMI comfort {emi_comfort:.1f}× — co-borrower endorsement recommended")
        if len(profiles) == 0:
            reasons.append("No external profiles linked — connect GitHub/LinkedIn/Naukri to strengthen application")
        if cgpa < 7.0 and cgpa >= 6.0:
            reasons.append(f"CGPA {cgpa:.2f} is in the borderline band — recent semester grades will be reviewed")

    # Final offer terms
    base_loan = scoring_input["monthly_emi"] * 60  # approximate principal from EMI
    rate_band = {
        "APPROVE":     {"min": 9.5,  "max": 11.0, "sanctioned_pct": 1.00, "tenure_years": 7},
        "CONDITIONAL": {"min": 11.0, "max": 13.0, "sanctioned_pct": 0.85, "tenure_years": 7},
        "DENY":        {"min": 13.5, "max": 15.5, "sanctioned_pct": 0.60, "tenure_years": 5},
    }[decision]

    conditions = ["EMI auto-debit consent required", "Quarterly placement-progress check-in"]
    if decision == "CONDITIONAL":
        conditions.append("Co-borrower guarantor required")
        conditions.append("Placement update every 60 days for first 12 months")
    if decision == "DENY":
        conditions = ["Application requires manual underwriter review", "Schedule a branch visit to discuss alternative structures"]

    final_offer = {
        "status": decision,
        "sanctioned_amount_inr": int(base_loan * rate_band["sanctioned_pct"]),
        "interest_rate_band_pct": {"min": rate_band["min"], "max": rate_band["max"]},
        "tenure_years": rate_band["tenure_years"],
        "conditions": conditions,
    }

    decision_pkg = {
        "decision": decision,
        "decision_reasons": reasons,
        "base_placement_6m": round(base_p6m, 3),
        "adjusted_placement_6m": adjusted_p6m,
        "adjusted_risk_band": adjusted_band,
        "base_risk_band": risk_band,
        "emi_comfort_index": emi_comfort,
        "cgpa": cgpa,
        "profile_boost_applied_pp": boost_pp,
        "profile_boost_reasons": boost_reasons,
        "providers_linked": list(profiles.keys()),
        "final_offer": final_offer,
        "fairness_note": (
            "This decision is advisory. Final underwriting always includes co-borrower review, "
            "manual override path, and is never based solely on placement-risk prediction. "
            "Borrowers can request manual review at any time."
        ),
    }

    # ─── Cold-start handling (Architect Review item) ─────────────
    # Mark borrowers with very thin data signals as cold-start; cap risk band
    # at MEDIUM (never HIGH from cohort priors alone — fairness/self-fulfilling
    # prophecy risk) and surface LOW confidence to the UI for explicit handling.
    cold_start = (
        int(scoring_input.get("internship_months", 0)) == 0
        and int(scoring_input.get("behavioral_activity_score", 50)) < 25
        and float(scoring_input.get("iqi", 0)) < 0.10
        and len(profiles) == 0
    )
    if cold_start:
        # Cap risk band at MEDIUM regardless of model output
        if decision_pkg["adjusted_risk_band"] == "HIGH":
            decision_pkg["adjusted_risk_band"] = "MEDIUM"
            decision_pkg["decision_reasons"].insert(
                0,
                "Cold-start borrower: risk band capped at MEDIUM (cohort-prior predictions "
                "are not used for HIGH-risk decisions — fairness guardrail)"
            )
        decision_pkg["cold_start"] = True
        decision_pkg["confidence_band"] = "LOW"
        decision_pkg["confidence_note"] = (
            "Limited data available — prediction relies heavily on cohort priors. "
            "Connect external profiles or complete a placement-progress update to sharpen the score."
        )
    else:
        decision_pkg["cold_start"] = False
        decision_pkg["confidence_band"] = (
            "HIGH" if len(profiles) >= 2 else "MEDIUM" if len(profiles) >= 1 else "MEDIUM"
        )

    # ─── Audit log entry (Architect Review item) ─────────────────
    # Capture immutable decision record per RBI IT Framework + DPDP record-keeping.
    # In production: write to S3 Glacier / OpenSearch with 7-year retention.
    from datetime import datetime, timezone, timedelta
    decision_pkg["audit"] = {
        "decision_id": f"DEC-{_stable_hash(req.student_id, str(int(datetime.now().timestamp()))) % 1000000:06d}",
        "model_version": "2.0.0-prototype-combined",
        "decided_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "retained_until_utc": (datetime.now(timezone.utc) + timedelta(days=365 * 7)).isoformat(timespec="seconds"),
        "feature_snapshot": {k: v for k, v in scoring_input.items() if k != "student_id"},
        "top_shap_drivers": [
            {"feature": d["feature"], "shap_value": d["shap_value"], "impact": d["impact_direction"]}
            for d in score.get("explainability", {}).get("top_drivers", [])
        ],
        "compliance_basis": "RBI IT Framework Master Direction · DPDP Section 11 (right to explanation)",
    }

    loan_decisions_store[req.student_id] = decision_pkg
    return sanitize(decision_pkg)


@app.get("/api/v1/audit/decisions")
async def list_audit_decisions(limit: int = 20):
    """Decision audit log — returns recent stored decisions with full feature
    snapshot, model version, SHAP drivers, and retention timestamp.
    In production: replace in-memory store with immutable log (OpenSearch + Glacier)."""
    decisions = list(loan_decisions_store.values())
    # Sort by decided_at_utc desc (newest first)
    decisions.sort(key=lambda d: d.get("audit", {}).get("decided_at_utc", ""), reverse=True)
    return sanitize({
        "total_decisions_logged": len(decisions),
        "decisions": decisions[:limit],
        "retention_policy": "7 years (RBI IT Framework + DPDP record-keeping)",
        "storage_note": "In-memory for demo. Production target: immutable OpenSearch index + S3 Glacier archive.",
    })


# ─── Portfolio KPIs ──────────────────────────────────────────

_portfolio_cache = {"ts": 0.0, "data": None}

@app.get("/api/v1/portfolio/summary")
async def portfolio_summary():
    """Aggregate portfolio KPIs across the loan book — disbursed total, AUM,
    at-risk principal, projected loss, and composition by tier/region/course.
    Cached for 60s since the underlying mock_db is static."""
    import time
    now = time.time()
    if _portfolio_cache["data"] and (now - _portfolio_cache["ts"] < 60):
        return _portfolio_cache["data"]

    if not mock_db:
        return {"status": "no data", "total_students": 0}

    df = pd.DataFrame(mock_db)
    # Synthesize loan_amount from monthly_emi (approx 60× for 7-yr loan @ ~11%)
    if "loan_amount" not in df.columns:
        emi = pd.to_numeric(df.get("monthly_emi", pd.Series(15000, index=df.index)), errors="coerce").fillna(15000)
        df["loan_amount"] = (emi * 60).astype(int)

    # Risk-band proxy from placed_6m + cgpa (mock_db doesn't store risk_band directly)
    def _risk_proxy(row):
        cgpa = float(row.get("cgpa", 7) or 7)
        placed = row.get("placed_6m", 1)
        if placed == 0 and cgpa < 6.0:
            return "HIGH"
        if placed == 0:
            return "MEDIUM"
        return "LOW"
    df["_risk_band"] = df.apply(_risk_proxy, axis=1)

    total_disbursed = int(df["loan_amount"].sum())
    aum_inr = int(total_disbursed * 0.85)  # ~85% outstanding (mock assumption)
    at_risk = int(df[df["_risk_band"] == "HIGH"]["loan_amount"].sum())
    medium_risk = int(df[df["_risk_band"] == "MEDIUM"]["loan_amount"].sum())
    at_risk_pct = round(at_risk / total_disbursed * 100, 1) if total_disbursed > 0 else 0.0

    # Weighted projected default rate: HIGH→18%, MEDIUM→6%, LOW→1.5%
    counts = df["_risk_band"].value_counts().to_dict()
    n = len(df)
    proj_default = round((counts.get("HIGH", 0) * 0.18 + counts.get("MEDIUM", 0) * 0.06 + counts.get("LOW", 0) * 0.015) / n * 100, 2) if n else 0.0
    projected_loss = int(at_risk * 0.18 + medium_risk * 0.06)

    def _by_dim(col: str) -> dict:
        result = {}
        for val, grp in df.groupby(col):
            result[str(val)] = {
                "count": int(len(grp)),
                "amount_inr": int(grp["loan_amount"].sum()),
            }
        return dict(sorted(result.items(), key=lambda kv: -kv[1]["amount_inr"]))

    # Top at-risk students (highest loan_amount in HIGH band)
    high_df = df[df["_risk_band"] == "HIGH"].nlargest(5, "loan_amount")
    top_at_risk = []
    for _, row in high_df.iterrows():
        # Try to identify primary risk factor
        if float(row.get("cgpa", 7)) < 6.0:
            factor = f"Low CGPA ({float(row['cgpa']):.2f})"
        elif int(row.get("internship_months", 0)) == 0:
            factor = "Zero internship experience"
        elif float(row.get("behavioral_activity_score", 50)) < 40:
            factor = "Low portal activity"
        else:
            factor = "Weak placement signals"
        top_at_risk.append({
            "student_id": row["student_id"],
            "course_type": row.get("course_type", "—"),
            "region": row.get("region", "—"),
            "loan_amount_inr": int(row["loan_amount"]),
            "risk_band": "HIGH",
            "primary_risk_factor": factor,
            "cgpa": round(float(row.get("cgpa", 0)), 2),
        })

    # Placement velocity (mirrors cohort/summary endpoint)
    velocity = {
        "3m":  round(float(df.get("placed_3m",  pd.Series(0)).mean()) * 100, 1),
        "6m":  round(float(df.get("placed_6m",  pd.Series(0)).mean()) * 100, 1),
        "12m": round(float(df.get("placed_12m", pd.Series(0)).mean()) * 100, 1),
    }

    payload = sanitize({
        "total_students": int(n),
        "total_disbursed_inr": total_disbursed,
        "aum_inr": aum_inr,
        "at_risk_amount_inr": at_risk,
        "at_risk_pct": at_risk_pct,
        "projected_default_rate_pct": proj_default,
        "projected_loss_inr": projected_loss,
        "risk_band_counts": {k: int(v) for k, v in counts.items()},
        "composition": {
            "by_tier":   _by_dim("institute_tier"),
            "by_region": _by_dim("region"),
            "by_course": _by_dim("course_type"),
        },
        "placement_velocity": velocity,
        "top_at_risk_students": top_at_risk,
        "as_of": "2026-05-29T00:00:00Z",
    })
    _portfolio_cache["data"] = payload
    _portfolio_cache["ts"] = now
    return payload


# ─── Enhanced Fairness (gender dim + 6-month trend) ──────────

def _synth_gender(student_id: str) -> str:
    """Deterministic gender assignment from student_id hash for demo only.
    NEVER do this in production — gender must come from explicit borrower disclosure."""
    return "Female" if _stable_hash(student_id, "gender") % 2 == 0 else "Male"

@app.get("/api/v1/model/fairness/v2")
async def get_fairness_v2():
    """Enhanced fairness audit — adds a Gender dimension (synthesized for demo)
    and a 6-month historical trend per dimension. RBI threshold annotations included.
    """
    if not mock_db:
        return {"status": "no data"}

    df = pd.DataFrame(mock_db)
    df["_gender"] = df["student_id"].apply(_synth_gender)

    DIMENSIONS = [
        ("Region", "region"),
        ("Course", "course_type"),
        ("Institute Tier", "institute_tier"),
        ("Gender", "_gender"),
    ]

    def _band(disparity: float) -> str:
        if disparity >= 0.10:
            return "HIGH"
        if disparity >= 0.05:
            return "MEDIUM"
        return "LOW"

    report = {}
    for dim, col in DIMENSIONS:
        groups = {}
        for val, grp in df.groupby(col):
            placed = float(grp["placed_6m"].mean()) if "placed_6m" in grp else 0.5
            groups[str(val)] = {"placement_rate": round(placed, 3), "n": int(len(grp))}
        rates = [g["placement_rate"] for g in groups.values()]
        disparity = round(max(rates) - min(rates), 3) if rates else 0.0

        # Mock 6-month trend (deterministic per dim)
        seed = _stable_hash(dim, "trend")
        trend = []
        for i in range(6):
            month = (seed + i * 7919) % 100
            # Generate values that drift around current disparity
            mock_val = round(max(0, disparity + (month - 50) / 500), 3)
            trend.append(mock_val)
        trend.append(disparity)  # current point at the end

        report[dim] = {
            "groups": groups,
            "max_disparity": disparity,
            "max_disparity_pct": round(disparity * 100, 1),
            "band": _band(disparity),
            "status": "PASS" if disparity < 0.10 else "FAIL",
            "trend_7_periods": trend,
            "remediation_sla_days": 30 if disparity >= 0.10 else None,
        }

    overall_status = "PASS" if all(v["status"] == "PASS" for v in report.values()) else "FAIL"
    return sanitize({
        "audit_date": "2026-05-29",
        "next_audit": "2026-06-29",
        "overall_status": overall_status,
        "dimensions": report,
        "thresholds": {
            "warning_pp": 5.0,
            "action_pp":  10.0,
            "framework":  "RBI Fair Practices Code · DPDP Section 11",
        },
        "protected_attributes_excluded_from_features": ["gender", "caste", "religion", "region_of_birth"],
        "data_note": "Gender dimension synthesized deterministically from student_id for demo only. "
                     "In production, gender comes from explicit borrower disclosure (DPDP-compliant).",
    })


# ─── Health ──────────────────────────────────────────────────

@app.get("/health")
async def health():
    # Expose active LLM provider/model so the UI can stop hardcoding "Groq · llama-3.1-8b"
    try:
        import config as _cfg
        llm = {
            "provider": _cfg.ACTIVE_PROVIDER,
            "model": _cfg.MODEL,
            "configured": bool(_cfg.API_KEY),
        }
    except Exception as e:
        llm = {"provider": None, "model": None, "configured": False, "error": str(e)}
    try:
        variant = engine.variant
    except Exception:
        variant = None
    return {
        "status": "ok",
        "students_loaded": len(mock_db),
        "llm": llm,
        "model_variant": variant,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=False)

