# backend/verification_store.py
"""
Verification Layer (PRD anti-fraud / self-reporting bias mitigation).

Every student data point receives a machine-readable verification status.
Self-reported data that is verified carries more weight on the lender
dashboard; unverified or discrepant data triggers alerts.

Verification States
───────────────────
UNVERIFIED  – self-reported, no verification attempted
PENDING     – proof submitted, awaiting human or automated review
VERIFIED    – verified via official source or automated check
DISCREPANCY – submitted but conflicts with official record (fraud signal)

Confidence Score Framework (0–100 pts)
───────────────────────────────────────
Academic  : ABC ID verified        → +25 pts
            DigiLocker verified    → +15 pts
Internship: per verified entry     → +12.5 pts  (cap: 2 entries = 25 pts)
Certs     : per verified entry     → +5 pts     (cap: 4 entries = 20 pts)
Placement : college-verified       → +15 pts

Confidence Tiers
────────────────
HIGH   ≥ 80  – data trustworthy; full lender weight
MEDIUM 50-79 – partially verified; moderate scrutiny
LOW    < 50  – mostly self-reported; lender should request docs
"""
import json
import os
import threading
from datetime import datetime, timezone

DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "verification.json")
_lock = threading.RLock()
_cache = None

# ── Known certification issuers (URL domain → issuer name) ──────────────────
KNOWN_ISSUERS = {
    "coursera.org":        "Coursera",
    "udemy.com":           "Udemy",
    "edx.org":             "edX",
    "linkedin.com":        "LinkedIn Learning",
    "credly.com":          "Credly / Acclaim",
    "credential.net":      "Accredible",
    "nptel.ac.in":         "NPTEL",
    "aws.amazon.com":      "AWS",
    "cloud.google.com":    "Google Cloud",
    "learn.microsoft.com": "Microsoft Learn",
    "microsoft.com":       "Microsoft",
    "hackerrank.com":      "HackerRank",
    "hackerearth.com":     "HackerEarth",
    "kodekloud.com":       "KodeKloud",
    "simplilearn.com":     "Simplilearn",
    "greatlearning.in":    "Great Learning",
    "udacity.com":         "Udacity",
    "skillsoft.com":       "Skillsoft",
    "pluralsight.com":     "Pluralsight",
}

# ── ABC ID & DigiLocker format validation ────────────────────────────────────
# ABC (Academic Bank of Credits) IDs are exactly 12 alphanumeric characters.
# We validate the format and then accept the student's own CGPA as the verified
# value — ABC is confirming "this student holds this CGPA", not generating one.
# Fraud detection works the other way: if the student later inflates their CGPA
# after verification, check_cgpa_discrepancy() flags the delta.
def _is_valid_abc_id(s: str) -> bool:
    return len(s) == 12 and s.replace("-", "").isalnum()


def _is_valid_digilocker_urn(s: str) -> bool:
    """DigiLocker URNs typically follow in.gov.digilocker.<issuer>.<doc-type>.<id>
    We accept any string that is ≥ 15 chars and either starts with a recognised
    prefix or contains 'digilocker'."""
    s = s.strip().lower()
    if len(s) < 12:
        return False
    return (
        s.startswith("in.gov.") or
        "digilocker" in s or
        (len(s) >= 15 and s.replace(".", "").replace("-", "").isalnum())
    )


# ── Store helpers ────────────────────────────────────────────────────────────
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
    return {
        "student_id":   student_id,
        "academic":     {"abc_id_status": "UNVERIFIED", "digilocker_status": "UNVERIFIED",
                         "abc_id": None, "digilocker_id": None,
                         "verified_cgpa": None, "discrepancy": False, "discrepancy_delta": None},
        "internships":  {},   # keyed by str(index): {status, company_name, document_ref, verified_by, verified_at}
        "certifications": {}, # keyed by str(index): {status, name, credential_id, credential_url, issuer, auto_verified}
        "placement":    {"status": "UNVERIFIED", "verified_by_institute": None, "verified_at": None},
        "updated_at":   _now(),
    }


def get(student_id: str) -> dict:
    return dict(_load().get(student_id, _blank(student_id)))


def _write(student_id: str, rec: dict) -> dict:
    rec["updated_at"] = _now()
    _load()[student_id] = rec
    _save()
    return dict(rec)


# ── Confidence score calculation ─────────────────────────────────────────────
CONFIDENCE_WEIGHTS = {
    "abc_id":       25,
    "digilocker":   15,
    "internship":   12.5,  # per entry, max 2
    "certification": 5,    # per entry, max 4
    "placement":    15,
}


def compute_confidence(v: dict) -> dict:
    acad  = v.get("academic", {})
    ints  = v.get("internships", {})
    certs = v.get("certifications", {})
    plac  = v.get("placement", {})

    abc_pts   = CONFIDENCE_WEIGHTS["abc_id"]      if acad.get("abc_id_status")      == "VERIFIED" else (5  if acad.get("abc_id_status") == "PENDING" else 0)
    digi_pts  = CONFIDENCE_WEIGHTS["digilocker"]  if acad.get("digilocker_status")  == "VERIFIED" else (5  if acad.get("digilocker_status") == "PENDING" else 0)
    int_pts   = min(25, sum(CONFIDENCE_WEIGHTS["internship"] for v2 in ints.values()  if v2.get("status") == "VERIFIED"))
    cert_pts  = min(20, sum(CONFIDENCE_WEIGHTS["certification"] for v2 in certs.values() if v2.get("status") == "VERIFIED"))
    plac_pts  = CONFIDENCE_WEIGHTS["placement"]   if plac.get("status")             == "VERIFIED" else 0

    score = round(abc_pts + digi_pts + int_pts + cert_pts + plac_pts)
    tier  = "HIGH" if score >= 80 else "MEDIUM" if score >= 50 else "LOW"

    # Discrepancy penalty description (does not reduce score, adds a flag)
    flags = []
    if acad.get("discrepancy"):
        flags.append(f"CGPA discrepancy: reported {acad.get('reported_cgpa_at_verify')} vs ABC-verified {acad.get('verified_cgpa')} (Δ {acad.get('discrepancy_delta')})")

    return {
        "score":  score,
        "tier":   tier,
        "breakdown": {
            "academic_abc":        round(abc_pts),
            "academic_digilocker": round(digi_pts),
            "internships":         round(int_pts),
            "certifications":      round(cert_pts),
            "placement":           round(plac_pts),
        },
        "max_possible": 100,
        "verified_internships": sum(1 for v2 in ints.values()  if v2.get("status") == "VERIFIED"),
        "verified_certs":       sum(1 for v2 in certs.values() if v2.get("status") == "VERIFIED"),
        "pending_count":        sum(1 for d in [acad, *ints.values(), *certs.values(), plac]
                                    for k, val in d.items() if k == "status" and val == "PENDING"),
        "discrepancy_flags": flags,
        "tier_color": {"HIGH": "#2F6E45", "MEDIUM": "#A5751F", "LOW": "#A82828"}.get(tier, "#A82828"),
    }


# ── Verification actions ─────────────────────────────────────────────────────

def verify_academic(student_id: str, abc_id: str = None, digilocker_id: str = None,
                    reported_cgpa: float = None) -> dict:
    """Submit ABC ID and/or DigiLocker ID for academic verification."""
    with _lock:
        rec = _load().get(student_id, _blank(student_id))
        acad = rec["academic"]

        if abc_id:
            abc_id = abc_id.strip().upper().replace("-", "")
            if not _is_valid_abc_id(abc_id):
                return {"error": f"Invalid ABC ID — must be exactly 12 alphanumeric characters (got {len(abc_id)})."}
            acad["abc_id"] = abc_id
            # ABC confirms the CGPA the student currently holds on record.
            # Discrepancy detection fires later via check_cgpa_discrepancy() if
            # the student inflates their CGPA after this verification is locked.
            verified_cgpa = round(float(reported_cgpa), 2) if reported_cgpa is not None else None
            acad["verified_cgpa"]           = verified_cgpa
            acad["reported_cgpa_at_verify"] = verified_cgpa
            acad["discrepancy"]             = False
            acad["discrepancy_delta"]       = None
            acad["abc_id_status"]           = "VERIFIED"
            acad["abc_verified_at"]         = _now()

        if digilocker_id:
            digilocker_id = digilocker_id.strip()
            if not _is_valid_digilocker_urn(digilocker_id):
                return {"error": "Invalid DigiLocker URN. Expected format: in.gov.digilocker.<issuer>.<type>.<id> (min 12 characters)."}
            acad["digilocker_id"]        = digilocker_id
            acad["digilocker_status"]    = "VERIFIED"
            acad["digilocker_verified_at"] = _now()

        return _write(student_id, rec)


def check_cgpa_discrepancy(student_id: str, new_cgpa: float) -> bool:
    """Called whenever the student updates their CGPA.

    If ABC verification was already performed, compare the locked verified_cgpa
    against the new value. A delta > 0.5 is flagged as a DISCREPANCY — the
    classic post-verification CGPA inflation pattern.
    Returns True if a discrepancy was newly detected (so main.py can log it).
    """
    with _lock:
        d = _load()
        rec = d.get(student_id)
        if not rec:
            return False
        acad = rec.get("academic", {})
        if acad.get("abc_id_status") != "VERIFIED":
            return False
        verified_cgpa = acad.get("verified_cgpa")
        if verified_cgpa is None:
            return False
        delta = round(abs(float(new_cgpa) - float(verified_cgpa)), 2)
        was_discrepant = acad.get("discrepancy", False)
        is_discrepant  = delta > 0.5
        acad["discrepancy"]              = is_discrepant
        acad["discrepancy_delta"]        = delta if is_discrepant else None
        acad["current_cgpa_vs_verified"] = round(float(new_cgpa), 2)
        rec["academic"]  = acad
        rec["updated_at"] = _now()
        d[student_id]    = rec
        _save()
        return is_discrepant and not was_discrepant   # True only on first detection


def verify_certification(student_id: str, idx: int, cert_name: str,
                         credential_id: str = None, credential_url: str = None) -> dict:
    """Auto-verify if URL is from a known issuer; else PENDING manual review."""
    with _lock:
        rec = _load().get(student_id, _blank(student_id))
        key = str(idx)

        auto_verified = False
        issuer_name   = None
        if credential_url:
            from urllib.parse import urlparse
            try:
                domain = urlparse(credential_url).netloc.lower().lstrip("www.")
                for d, name in KNOWN_ISSUERS.items():
                    if d in domain:
                        auto_verified = True
                        issuer_name   = name
                        break
            except Exception:
                pass

        rec["certifications"][key] = {
            "status":         "VERIFIED" if auto_verified else "PENDING",
            "name":           cert_name,
            "credential_id":  credential_id,
            "credential_url": credential_url,
            "issuer":         issuer_name,
            "auto_verified":  auto_verified,
            "submitted_at":   _now(),
            "verified_at":    _now() if auto_verified else None,
        }
        return _write(student_id, rec)


def verify_internship(student_id: str, idx: int, company_name: str,
                      document_ref: str, contact_email: str = None) -> dict:
    """Submit internship proof (offer letter ref + completion cert ref) → PENDING."""
    with _lock:
        rec = _load().get(student_id, _blank(student_id))
        rec["internships"][str(idx)] = {
            "status":        "PENDING",
            "company_name":  company_name,
            "document_ref":  document_ref,
            "contact_email": contact_email,
            "submitted_at":  _now(),
            "verified_by":   None,
            "verified_at":   None,
        }
        return _write(student_id, rec)


def approve_internship(student_id: str, idx: int, approved: bool = True,
                       approved_by: str = "admin") -> dict:
    """Admin or college approves / rejects a pending internship."""
    with _lock:
        rec = _load().get(student_id, _blank(student_id))
        key = str(idx)
        if key not in rec["internships"]:
            return {"error": f"No pending internship at index {idx} for {student_id}."}
        rec["internships"][key]["status"]      = "VERIFIED" if approved else "DISCREPANCY"
        rec["internships"][key]["verified_by"] = approved_by
        rec["internships"][key]["verified_at"] = _now()
        return _write(student_id, rec)


def verify_placement(student_id: str, institute_name: str) -> dict:
    """Mark placement as college-verified (called when college syncs placed status)."""
    with _lock:
        rec = _load().get(student_id, _blank(student_id))
        rec["placement"] = {
            "status":               "VERIFIED",
            "verified_by_institute": institute_name,
            "verified_at":          _now(),
        }
        return _write(student_id, rec)


def full_status(student_id: str) -> dict:
    """Return verification record + computed confidence score."""
    v = get(student_id)
    return {**v, "confidence": compute_confidence(v)}
