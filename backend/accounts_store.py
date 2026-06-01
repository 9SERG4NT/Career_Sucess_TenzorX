# backend/accounts_store.py
"""
JSON-backed account store for the three login roles (lender/admin, college,
student/borrower).

This is what makes the cycle real instead of mock:
  - the lender ONBOARDS a borrower → a real STU-2026 record is created AND an
    account is issued with generated credentials, returned once to the lender;
  - the borrower signs in with those credentials, which bind their login to that
    exact student_id, so the data they edit is the data the lender scores;
  - the college account binds to an institute_name, so its edits land on the
    borrowers tagged to that institute.

Prototype-grade: passwords are stored in plain text in data/accounts.json. A
production build would hash them (bcrypt/argon2) and move this behind real auth.
"""
import json
import os
import threading
from datetime import datetime, timezone

DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "accounts.json")
_lock = threading.RLock()
_cache = None

# Seeded demo logins. The borrower is bound to a real record that ships in the
# CSV so the end-to-end flow works on a fresh checkout with no onboarding step.
_SEED = {
    "admin": {
        "username": "admin", "password": "123", "role": "admin",
        "name": "Lender Admin", "email": "admin@poonawalla.demo",
        "student_id": None, "institute": None,
    },
    "college": {
        "username": "college", "password": "123", "role": "college",
        "name": "Demo Placement Cell", "email": "college@poonawalla.demo",
        "student_id": None, "institute": "PF Demo Institute",
    },
    "student": {
        "username": "student", "password": "123", "role": "student",
        "name": "Demo Borrower", "email": "student@poonawalla.demo",
        "student_id": "STU-2026-00001", "institute": "PF Demo Institute",
    },
}


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
        # Seed any missing demo accounts (idempotent) and persist.
        changed = False
        for uname, acct in _SEED.items():
            if uname not in _cache:
                _cache[uname] = {**acct, "must_change_password": False,
                                 "created_at": _now(), "created_by": "seed"}
                changed = True
        if changed:
            _save()
    return _cache


def _save():
    try:
        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
        with open(DATA_FILE, "w", encoding="utf-8") as fh:
            json.dump(_cache, fh, indent=2, ensure_ascii=False)
    except Exception:
        pass


def _public(acct: dict) -> dict:
    """Account dict without the password, for returning over the wire."""
    return {k: v for k, v in acct.items() if k != "password"}


def get(username: str):
    return _load().get((username or "").strip().lower())


def authenticate(username: str, password: str):
    """Return the public account dict on success, else None."""
    acct = get(username)
    if acct and str(acct.get("password")) == str(password):
        return _public(acct)
    return None


def list_accounts(role: str = None) -> list:
    accts = [_public(a) for a in _load().values()]
    if role:
        accts = [a for a in accts if a.get("role") == role]
    accts.sort(key=lambda a: a.get("created_at", ""))
    return accts


def _unique_username(base: str) -> str:
    d = _load()
    base = "".join(ch for ch in (base or "user").lower() if ch.isalnum()) or "user"
    base = base[:14]
    uname = base
    n = 1
    while uname in d:
        n += 1
        uname = f"{base}{n}"
    return uname


def _temp_password() -> str:
    """Readable, easy-to-relay temporary password (no ambiguous chars)."""
    import random
    alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    return "".join(random.choice(alphabet) for _ in range(8))


def create_account(role: str, name: str, *, student_id=None, institute=None,
                   email=None, username=None, password=None,
                   must_change_password=True, created_by="admin") -> dict:
    """Create a new login. Returns the account INCLUDING the (plain) password so
    the lender can hand it to the borrower once. Subsequent reads omit it."""
    with _lock:
        d = _load()
        uname = (username or "").strip().lower() or _unique_username(name or role)
        if uname in d:
            uname = _unique_username(uname)
        pwd = password or _temp_password()
        acct = {
            "username": uname, "password": pwd, "role": role,
            "name": name or uname, "email": email or "",
            "student_id": student_id, "institute": institute,
            "must_change_password": must_change_password,
            "created_at": _now(), "created_by": created_by,
        }
        d[uname] = acct
        _save()
        # Return WITH password (one-time reveal) plus the username.
        return dict(acct)


def set_password(username: str, new_password: str) -> bool:
    with _lock:
        acct = get(username)
        if not acct:
            return False
        acct["password"] = str(new_password)
        acct["must_change_password"] = False
        _save()
        return True
