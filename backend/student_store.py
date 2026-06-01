# backend/student_store.py
"""
Single source of truth for the student portfolio, backed by
data/synthetic_students.csv.

Both the API layer (main.mock_db) and the agent tools (tools._get_df /
lookup_student / ingest_students) read through this module, so students uploaded
at runtime are immediately visible to scoring, the chatbot, and the portfolio.
"""
import os
import threading
import pandas as pd

CSV_PATH = os.path.join(os.path.dirname(__file__), "data", "synthetic_students.csv")

FEATURE_COLS = [
    "course_type", "institute_tier", "region", "cgpa", "internship_months",
    "employer_tier", "iqi", "behavioral_activity_score", "field_demand_score",
    "macro_climate_index", "monthly_emi",
]
LABEL_COLS = ["placed_3m", "placed_6m", "placed_12m", "actual_salary"]
# Extra tracked columns that are NOT model features but still flow through the
# system: active_backlogs is a post-prediction scoring signal (risk penalty /
# override); institute_name relates a borrower to the College/Placement-Cell that
# owns them, so college edits can sync back onto the right records.
EXTRA_COLS = ["active_backlogs", "institute_name"]
ALL_COLS = ["student_id"] + FEATURE_COLS + LABEL_COLS + EXTRA_COLS

_DEFAULTS = {
    "course_type": "Engineering", "institute_tier": "B", "region": "Bengaluru",
    "cgpa": 7.0, "internship_months": 0, "employer_tier": "Startup", "iqi": 0.3,
    "behavioral_activity_score": 50, "field_demand_score": 65, "macro_climate_index": 0.7,
    "monthly_emi": 15000, "placed_3m": 0, "placed_6m": 0, "placed_12m": 0, "actual_salary": 0,
    "active_backlogs": 0, "institute_name": "",
}
_INT_COLS = {"internship_months", "behavioral_activity_score", "monthly_emi",
             "placed_3m", "placed_6m", "placed_12m", "actual_salary", "active_backlogs"}
_FLOAT_COLS = {"cgpa", "iqi", "field_demand_score", "macro_climate_index"}

# Forgiving aliases for keys users might paste in free-form data.
_ALIASES = {
    "id": "student_id", "studentid": "student_id", "roll": "student_id", "rollno": "student_id",
    "course": "course_type", "branch": "course_type", "stream": "course_type", "degree": "course_type",
    "tier": "institute_tier", "collegetier": "institute_tier",
    "city": "region", "location": "region", "place": "region",
    "gpa": "cgpa", "cgpa10": "cgpa", "percentage": "cgpa",
    "internship": "internship_months", "internships": "internship_months", "internshipmonths": "internship_months",
    "emi": "monthly_emi", "monthlyemi": "monthly_emi",
    "activity": "behavioral_activity_score", "engagement": "behavioral_activity_score",
    "demand": "field_demand_score", "salary": "actual_salary",
    "institute": "institute_name", "institutename": "institute_name",
    "college": "institute_name", "collegename": "institute_name", "school": "institute_name",
    "backlogs": "active_backlogs", "backlog": "active_backlogs", "activebacklogs": "active_backlogs",
}

_lock = threading.RLock()
_df = None


def get_df() -> pd.DataFrame:
    """Lazily load the portfolio DataFrame (cached)."""
    global _df
    if _df is None:
        if os.path.exists(CSV_PATH):
            _df = pd.read_csv(CSV_PATH)
        else:
            _df = pd.DataFrame(columns=ALL_COLS)
    return _df


def all_records() -> list:
    df = get_df()
    return df.where(pd.notna(df), other=None).to_dict("records")


def find(student_id: str):
    df = get_df()
    rows = df[df["student_id"] == student_id]
    return None if len(rows) == 0 else rows.iloc[0].to_dict()


def count() -> int:
    return len(get_df())


def _coerce(col, val):
    if val is None or (isinstance(val, str) and not val.strip()):
        return _DEFAULTS.get(col, 0)
    try:
        if col in _INT_COLS:
            return int(round(float(val)))
        if col in _FLOAT_COLS:
            return float(val)
    except (TypeError, ValueError):
        return _DEFAULTS.get(col, 0)
    return str(val).strip()


def _next_id(existing: set) -> str:
    nums = []
    for sid in existing:
        if isinstance(sid, str) and sid.startswith("STU-2026-"):
            tail = sid.rsplit("-", 1)[-1]
            if tail.isdigit():
                nums.append(int(tail))
    n = (max(nums) + 1) if nums else 0
    sid = f"STU-2026-{n:05d}"
    while sid in existing:
        n += 1
        sid = f"STU-2026-{n:05d}"
    return sid


def normalize(raw: dict, existing: set) -> dict:
    """Map a loose record (any key casing / aliases) into a full, typed row."""
    rec = {}
    for k, v in (raw or {}).items():
        key = str(k).strip().lower().replace(" ", "").replace("_", "")
        rec[_ALIASES.get(key, str(k).strip().lower())] = v

    sid = str(rec.get("student_id") or "").strip()
    if not sid or not sid.upper().startswith("STU"):
        sid = _next_id(existing)
    out = {"student_id": sid}
    for col in FEATURE_COLS + LABEL_COLS + EXTRA_COLS:
        out[col] = _coerce(col, rec.get(col, _DEFAULTS[col]))
    return out


def add_records(records: list, persist: bool = True) -> dict:
    """Normalize + append records. Skips ids that already exist. Persists to CSV."""
    global _df
    with _lock:
        df = get_df()
        existing = set(df["student_id"].astype(str)) if "student_id" in df.columns else set()
        added, skipped, rows = [], [], []
        for raw in (records or []):
            if not isinstance(raw, dict):
                continue
            norm = normalize(raw, existing)
            if norm["student_id"] in existing:
                skipped.append(norm["student_id"])
                continue
            rows.append(norm)
            existing.add(norm["student_id"])
            added.append(norm["student_id"])
        if rows:
            _df = pd.concat([df, pd.DataFrame(rows, columns=ALL_COLS)], ignore_index=True)
            if persist:
                try:
                    _df.to_csv(CSV_PATH, index=False)
                except Exception:
                    pass
        return {
            "added_count": len(added), "added_ids": added,
            "skipped_existing": skipped, "records": rows, "total": len(get_df()),
        }


def update_record(student_id: str, updates: dict, persist: bool = True) -> dict | None:
    """Update an existing student's editable fields in place and persist to CSV.

    Returns the full updated record (typed dict) or None if the id is unknown.
    Accepts loose key casing / aliases, same as `normalize`. This is the write
    path that lets a borrower (or RM) push a mid-semester change — e.g. a new
    backlog or a dropped CGPA — so the next score reflects it immediately.
    """
    global _df
    editable = set(FEATURE_COLS + LABEL_COLS + EXTRA_COLS)
    with _lock:
        df = get_df()
        if "student_id" not in df.columns:
            return None
        mask = df["student_id"].astype(str) == str(student_id)
        if not mask.any():
            return None
        idx = df.index[mask][0]

        # Make sure every tracked column exists before we assign (older CSVs
        # predate EXTRA_COLS like active_backlogs).
        for col in ALL_COLS:
            if col not in df.columns:
                df[col] = _DEFAULTS.get(col, None)

        for k, v in (updates or {}).items():
            key = str(k).strip().lower().replace(" ", "").replace("_", "")
            col = _ALIASES.get(key, str(k).strip().lower())
            if col in editable and v is not None:
                df.at[idx, col] = _coerce(col, v)

        _df = df
        if persist:
            try:
                _df.to_csv(CSV_PATH, index=False)
            except Exception:
                pass
        rec = _df.loc[idx].where(pd.notna(_df.loc[idx]), other=None).to_dict()
        return rec
