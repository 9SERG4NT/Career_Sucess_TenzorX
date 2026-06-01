# backend/college_store.py
"""
JSON-backed store for College / Placement-Cell data.

Holds, per institute: profile (tier, accreditation), program-wise placement +
salary rows, recruiter participation, and student placement-status updates.
Also computes the analytics the college dashboard and the lender's institute
intelligence consume. Persisted to data/college_data.json so it survives restart.
"""
import json
import os
import threading
from datetime import datetime, timezone

DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "college_data.json")
_lock = threading.RLock()
_cache = None


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
        with open(DATA_FILE, "w", encoding="utf-8") as fh:
            json.dump(_cache, fh, indent=2, ensure_ascii=False)
    except Exception:
        pass


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _key(name) -> str:
    return (name or "").strip()


def _f(v, default=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _i(v, default=0):
    try:
        return int(round(float(v)))
    except (TypeError, ValueError):
        return default


def _rec(name) -> dict:
    """Get or create the institute record (caller holds the lock)."""
    d = _load()
    k = _key(name)
    if k not in d:
        d[k] = {"institute_name": k, "institute_tier": None, "accreditation": None,
                "programs": [], "recruiters": [], "student_status": [], "updated_at": _now()}
    return d[k]


def get_institute(name):
    return _load().get(_key(name))


def list_institutes() -> list:
    return list(_load().values())


def upsert_profile(name, tier=None, accreditation=None) -> dict:
    with _lock:
        rec = _rec(name)
        if tier is not None:
            rec["institute_tier"] = tier
        if accreditation is not None:
            rec["accreditation"] = accreditation
        rec["updated_at"] = _now()
        _save()
        return rec


def set_programs(name, programs) -> dict:
    with _lock:
        rec = _rec(name)
        rec["programs"] = [{
            "program": str(p.get("program", "")).strip(),
            "total_students": _i(p.get("total_students")),
            "eligible": _i(p.get("eligible")),
            "placed": _i(p.get("placed")),
            "rate_3m": _f(p.get("rate_3m")),
            "rate_6m": _f(p.get("rate_6m")),
            "rate_12m": _f(p.get("rate_12m")),
            "avg_salary": _i(p.get("avg_salary")),
            "median_salary": _i(p.get("median_salary")),
            "highest_salary": _i(p.get("highest_salary")),
            "lowest_salary": _i(p.get("lowest_salary")),
        } for p in (programs or []) if str(p.get("program", "")).strip()]
        rec["updated_at"] = _now()
        _save()
        return rec


def set_recruiters(name, recruiters) -> dict:
    with _lock:
        rec = _rec(name)
        rec["recruiters"] = [{
            "name": str(r.get("name", "")).strip(),
            "industry": str(r.get("industry", "")).strip(),
            "openings": _i(r.get("openings")),
            "selected": _i(r.get("selected")),
        } for r in (recruiters or []) if str(r.get("name", "")).strip()]
        rec["updated_at"] = _now()
        _save()
        return rec


def set_student_status(name, rows) -> dict:
    with _lock:
        rec = _rec(name)
        rec["student_status"] = [{
            "student_id": str(s.get("student_id", "")).strip(),
            "status": str(s.get("status", "")).strip(),
            "company": str(s.get("company", "")).strip(),
            "offered_salary": _i(s.get("offered_salary")),
            "joining_date": str(s.get("joining_date", "")).strip(),
        } for s in (rows or []) if str(s.get("student_id", "")).strip()]
        rec["updated_at"] = _now()
        _save()
        return rec


def analytics(name) -> dict:
    rec = get_institute(name)
    if not rec:
        return {"found": False, "institute_name": _key(name)}

    programs = rec.get("programs", [])
    recruiters = rec.get("recruiters", [])
    statuses = rec.get("student_status", [])

    total_students = sum(_i(p.get("total_students")) for p in programs)
    total_placed = sum(_i(p.get("placed")) for p in programs)
    overall_rate = round(total_placed / total_students, 3) if total_students else 0.0

    branch_wise = [{
        "program": p.get("program"),
        "total_students": _i(p.get("total_students")),
        "placed": _i(p.get("placed")),
        "rate_3m": _f(p.get("rate_3m")),
        "rate_6m": _f(p.get("rate_6m")),
        "rate_12m": _f(p.get("rate_12m")),
        "avg_salary": _i(p.get("avg_salary")),
        "median_salary": _i(p.get("median_salary")),
        "highest_salary": _i(p.get("highest_salary")),
    } for p in programs]

    medians = sorted(b["median_salary"] for b in branch_wise if b["median_salary"])
    salary_summary = {
        "median_of_medians": medians[len(medians) // 2] if medians else 0,
        "highest": max((b["highest_salary"] for b in branch_wise), default=0),
        "lowest": min(medians, default=0),
    }

    recruiter_trends = sorted([{
        "name": r.get("name"), "industry": r.get("industry"),
        "openings": _i(r.get("openings")), "selected": _i(r.get("selected")),
    } for r in recruiters], key=lambda x: x["selected"], reverse=True)
    total_offers = sum(r["selected"] for r in recruiter_trends)

    buckets = {"placed": 0, "in_progress": 0, "not_placed": 0}
    for s in statuses:
        st = str(s.get("status", "")).lower()
        if any(w in st for w in ("plac", "offer", "join", "select")):
            buckets["placed"] += 1
        elif any(w in st for w in ("progress", "interview", "shortlist", "applied")):
            buckets["in_progress"] += 1
        else:
            buckets["not_placed"] += 1

    return {
        "found": True,
        "institute_name": rec.get("institute_name"),
        "institute_tier": rec.get("institute_tier"),
        "accreditation": rec.get("accreditation"),
        "totals": {
            "total_students": total_students, "total_placed": total_placed,
            "overall_placement_rate": overall_rate, "programs": len(programs),
            "recruiters": len(recruiters), "total_offers": total_offers,
            "students_tracked": len(statuses),
        },
        "branch_wise": branch_wise,
        "salary_summary": salary_summary,
        "recruiter_trends": recruiter_trends[:10],
        "placement_status_buckets": buckets,
        "updated_at": rec.get("updated_at"),
    }
