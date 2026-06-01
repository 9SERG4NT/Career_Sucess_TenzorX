# backend/student_profile_store.py
"""
JSON-backed store for the RICH student profile data defined in the PRD
student portal (Datasets 3-5, Section 7.A).

The CSV-backed student_store.py holds the 10 model features + labels used for
ML scoring. This store holds everything else: personal info, semester GPAs,
full internship/certification/project details, skills, and placement activity.
The two stores are kept in sync through the /full-profile API endpoint:
when scoring-relevant fields change here (cgpa, backlogs, internship months),
the endpoint writes them back to student_store as well, triggering a live
re-score exactly like the existing /api/v1/student/{id} PUT does.
"""
import json
import os
import threading
from datetime import datetime, timezone

DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "student_profiles.json")
_lock = threading.RLock()
_cache = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load() -> dict:
    global _cache
    if _cache is None:
        if os.path.exists(DATA_FILE):
            try:
                with open(DATA_FILE, encoding="utf-8") as fh:
                    _cache = json.load(fh)
            except Exception:
                _cache = {}
        else:
            _cache = {}
    return _cache


def _save():
    try:
        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
        with open(DATA_FILE, "w", encoding="utf-8") as fh:
            json.dump(_cache, fh, indent=2, ensure_ascii=False)
    except Exception:
        pass


def _blank(student_id: str) -> dict:
    """Return a fully-initialised empty profile for a new student."""
    return {
        "student_id": student_id,
        # ── PRD Dataset 3: Student Profile ──────────────────────────────
        "personal": {
            "full_name": "",
            "email": "",
            "mobile": "",
            "city": "",
            "state": "",
            "country_of_study": "India",
            "graduation_year": None,
        },
        # ── PRD Dataset 4: Academic Performance ──────────────────────────
        "academic": {
            "cgpa": None,
            "cgpa_trend": None,           # positive = improving
            "academic_consistency": None,
            "attendance_percentage": None,
            "backlogs_count": 0,
            "entrance_exam_score": None,
            "research_papers": 0,
            "projects_count": 0,
            "awards_count": 0,
            "semester_gpas": [],           # [{semester: 1, gpa: 8.2}, ...]
            "achievements": [],            # list of strings
        },
        # ── PRD Dataset 5: Employability ─────────────────────────────────
        "employability": {
            "internships": [],
            # [{company_name, role, duration_months, tier, performance_score, description}]
            "certifications": [],
            # [{name, org, date, url}]
            "projects": [],
            # [{name, tech_stack, description, url}]
            "skills": {
                "languages": [],
                "technical": [],
                "soft": [],
                "tools": [],
            },
            "coding_problems_solved": 0,
            "hackathons_attended": 0,
        },
        # ── PRD Section 7.A: Placement Activity ──────────────────────────
        "placement_activity": {
            "resume_uploaded": False,
            "applications_submitted": 0,
            "interview_status": "",   # Applied|Shortlisted|Interview Scheduled|Selected|Offer Received|Rejected
            "offer_received": False,
            "company_name": "",
            "offered_ctc": 0,
            "joining_date": "",
            "placement_confirmed": False,
        },
        "updated_at": _now(),
    }


def get_profile(student_id: str) -> dict:
    """Return the rich profile (a blank scaffold if never saved before)."""
    return dict(_load().get(student_id, _blank(student_id)))


def update_profile(student_id: str, patch: dict) -> dict:
    """Deep-merge `patch` (any subset of sections) into the profile, persist,
    and return the full updated profile."""
    with _lock:
        d = _load()
        existing = d.get(student_id, _blank(student_id))
        for section, value in (patch or {}).items():
            if section in existing and isinstance(value, dict) and isinstance(existing[section], dict):
                existing[section].update(value)
            elif section in existing:
                existing[section] = value
        existing["updated_at"] = _now()
        d[student_id] = existing
        _save()
        return dict(existing)


# ── Derived / computed helpers ────────────────────────────────────────────────

def derive_scoring_sync(rich: dict) -> dict:
    """Return the subset of scoring-model fields that should be written back to
    student_store whenever the rich profile changes.  The caller is responsible
    for passing these to student_store.update_record()."""
    sync = {}
    acad = rich.get("academic", {})
    emp  = rich.get("employability", {})
    plac = rich.get("placement_activity", {})

    if acad.get("cgpa") is not None:
        sync["cgpa"] = round(float(acad["cgpa"]), 2)
    if acad.get("backlogs_count") is not None:
        sync["active_backlogs"] = int(acad["backlogs_count"])

    # Internships → internship_months + iqi
    internships = emp.get("internships") or []
    if internships:
        total_months = sum(int(i.get("duration_months", 0) or 0) for i in internships)
        sync["internship_months"] = total_months
        tier_scores = {"MNC": 0.80, "Unicorn": 0.75, "MidSize": 0.50, "Startup": 0.30, "Other": 0.20}
        best_iqi = max((tier_scores.get(i.get("tier", "Other"), 0.20) for i in internships), default=0.20)
        perf_scores = [float(i.get("performance_score", 0) or 0) for i in internships if i.get("performance_score")]
        if perf_scores:
            avg_perf = sum(perf_scores) / len(perf_scores)
            best_iqi = min(1.0, round(best_iqi * 0.7 + (avg_perf / 100) * 0.3, 3))
        sync["iqi"] = round(best_iqi, 3)
        # Employer tier → prefer the best internship employer tier
        tiers = [i.get("tier", "Startup") for i in internships]
        tier_rank = {"MNC": 4, "Unicorn": 3, "MidSize": 2, "Startup": 1, "Other": 0}
        sync["employer_tier"] = max(tiers, key=lambda t: tier_rank.get(t, 0), default="Startup")

    # Certifications → behavioral activity boost
    cert_count = len(emp.get("certifications") or [])
    if cert_count > 0:
        sync["_cert_count_hint"] = cert_count  # handled by the API layer

    # Placement confirmation → update placement flags + salary
    if plac.get("placement_confirmed") and plac.get("offered_ctc", 0) > 0:
        sync["placed_6m"] = 1
        sync["placed_12m"] = 1
        sync["actual_salary"] = int(plac.get("offered_ctc", 0))

    return sync
