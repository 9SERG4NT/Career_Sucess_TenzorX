"""
Resume text extraction (PDF / DOCX) + LLM-based profile parsing + ATS scoring.

Two public functions:
  parse_resume(resume_text)          -> dict of profile fields (maps to MyProfile tabs)
  ats_score(resume_text, job_profile) -> dict with overall_score, breakdown, gaps, recs
"""
from __future__ import annotations
import io
import json
import os
import sys

# Add agents/ to path so `from provider import call_llm` resolves correctly.
_AGENTS_DIR = os.path.join(os.path.dirname(__file__), "agents")
if _AGENTS_DIR not in sys.path:
    sys.path.insert(0, _AGENTS_DIR)

from provider import call_llm  # noqa: E402  (path manipulation above)


# ─── Text extraction ──────────────────────────────────────────────────────────

def extract_text(file_bytes: bytes, content_type: str) -> str:
    ct = (content_type or "").lower()
    if "pdf" in ct:
        return _from_pdf(file_bytes)
    if "word" in ct or "docx" in ct or "openxmlformats" in ct:
        return _from_docx(file_bytes)
    # Fall back to plain-text decode (txt / unknown)
    return file_bytes.decode("utf-8", errors="replace")


def _from_pdf(data: bytes) -> str:
    try:
        import pdfplumber
        parts: list[str] = []
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    parts.append(t)
        text = "\n".join(parts)
        if not text.strip():
            raise ValueError("No text found — the PDF may be image-only (scanned).")
        return text
    except Exception as exc:
        raise ValueError(f"PDF extraction failed: {exc}") from exc


def _from_docx(data: bytes) -> str:
    try:
        from docx import Document  # python-docx
        doc = Document(io.BytesIO(data))
        lines = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n".join(lines)
    except Exception as exc:
        raise ValueError(f"DOCX extraction failed: {exc}") from exc


# ─── LLM helpers ─────────────────────────────────────────────────────────────

_PARSE_SYSTEM = """
You are a resume parser for PlacementIQ — an education-loan risk platform for Indian students.
Extract structured information from the resume text and return ONLY valid JSON (no markdown, no preamble).

Use this exact JSON shape. Use null for missing scalar fields and [] for missing arrays:
{
  "full_name": "string or null",
  "email": "string or null",
  "mobile": "string or null",
  "city": "string or null",
  "state": "Indian state name or null",
  "graduation_year": integer or null,
  "cgpa": float (0.0–10.0) or null,
  "achievements": ["string", ...],
  "coding_problems_solved": integer or null,
  "hackathons_attended": integer or null,
  "skills": {
    "languages": ["Python", "Java", ...],
    "technical": ["Machine Learning", "SQL", ...],
    "tools": ["Docker", "React", ...],
    "soft": ["Leadership", "Communication", ...]
  },
  "internships": [
    {
      "company_name": "string",
      "role": "string",
      "duration_months": integer,
      "tier": "MNC | Unicorn | MidSize | Startup | Other",
      "description": "string"
    }
  ],
  "certifications": [
    {
      "name": "string",
      "org": "string",
      "date": "YYYY-MM-DD or empty string",
      "url": "string or empty string"
    }
  ],
  "projects": [
    {
      "name": "string",
      "tech_stack": "comma-separated technologies",
      "description": "string",
      "url": "string or empty string"
    }
  ]
}

Tier classification for internship companies:
- MNC: TCS, Infosys, Wipro, Google, Microsoft, Amazon, Meta, Apple, IBM, Accenture, Deloitte, etc.
- Unicorn: Indian unicorn startups (Zomato, Swiggy, CRED, Zepto, PhonePe, Meesho, Razorpay, BYJU'S, etc.)
- MidSize: companies with 50–5000 employees that are not MNC/Unicorn
- Startup: early-stage startups, seed/Series-A companies
- Other: government bodies, NGOs, research labs, unknown
"""

_ATS_SYSTEM = """
You are an ATS (Applicant Tracking System) scorer for PlacementIQ.
Score the given resume strictly against the specified job profile and return ONLY valid JSON (no markdown).

Scoring methodology — each section scored 0–100 independently:
  keyword_match (30% weight): Does the resume use relevant technical/domain keywords for this JD?
  skills_alignment (25% weight): Do the candidate's listed skills match what the role needs?
  experience_relevance (20% weight): Are internships, projects, roles relevant to the job?
  education_match (15% weight): Does the degree/specialisation/CGPA fit the profile?
  quantified_impact (10% weight): Are achievements stated with measurable metrics?

overall_score = round(0.30×km + 0.25×sa + 0.20×er + 0.15×em + 0.10×qi)

Grade bands:
  90–100 → A+,  80–89 → A,  70–79 → B+,  60–69 → B,  50–59 → C+,  40–49 → C,  <40 → D

Return ONLY this JSON structure:
{
  "overall_score": integer,
  "grade": "A+ | A | B+ | B | C+ | C | D",
  "job_profile": "the job profile name as given",
  "breakdown": {
    "keyword_match":        { "score": integer, "found_keywords": ["kw1", ...], "missing_keywords": ["kw2", ...] },
    "skills_alignment":     { "score": integer, "matched": ["skill1", ...], "gaps": ["gap1", ...] },
    "experience_relevance": { "score": integer, "notes": "one sentence" },
    "education_match":      { "score": integer, "notes": "one sentence" },
    "quantified_impact":    { "score": integer, "notes": "one sentence" }
  },
  "strengths": ["specific strength observed in the resume", ...],
  "improvement_areas": ["specific actionable gap relevant to this job profile", ...],
  "recommendations": ["concrete action the candidate can take before applying", ...]
}
"""


def _extract_json(raw: str) -> dict | None:
    """Robust extraction: find the outermost balanced {...} block."""
    if not raw:
        return None
    depth, start, in_str, esc = 0, -1, False, False
    for i, ch in enumerate(raw):
        if esc:
            esc = False
            continue
        if ch == "\\" and in_str:
            esc = True
            continue
        if ch == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start != -1:
                try:
                    return json.loads(raw[start: i + 1])
                except json.JSONDecodeError:
                    start = -1
    try:
        s, e = raw.find("{"), raw.rfind("}") + 1
        return json.loads(raw[s:e]) if s != -1 and e > s else None
    except (json.JSONDecodeError, ValueError):
        return None


# ─── Public API ───────────────────────────────────────────────────────────────

def parse_resume(resume_text: str) -> dict:
    """Extract structured profile fields from raw resume text via LLM.

    Returns a dict matching the MyProfile data shape, plus optional '_error'.
    """
    # Clamp to 8K chars — enough for any single resume, avoids token overflow
    text_snippet = resume_text[:8000]
    user_msg = f"Parse this resume and return the JSON profile:\n\n{text_snippet}"
    try:
        resp = call_llm(
            system=_PARSE_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
            max_tokens=2000,
        )
        parsed = _extract_json(resp.text or "")
        if parsed is None:
            return {
                "_error": "LLM returned unparseable output",
                "_raw": (resp.text or "")[:400],
            }
        # Ensure required nested keys exist
        parsed.setdefault("skills", {})
        parsed["skills"].setdefault("languages", [])
        parsed["skills"].setdefault("technical", [])
        parsed["skills"].setdefault("tools", [])
        parsed["skills"].setdefault("soft", [])
        parsed.setdefault("internships", [])
        parsed.setdefault("certifications", [])
        parsed.setdefault("projects", [])
        parsed.setdefault("achievements", [])
        return parsed
    except Exception as exc:
        return {"_error": str(exc)}


def ats_score(resume_text: str, job_profile: str) -> dict:
    """Score resume against a named job profile and return ATS breakdown via LLM."""
    text_snippet = resume_text[:8000]
    user_msg = (
        f"Job profile to score against: {job_profile}\n\n"
        f"Resume text:\n{text_snippet}\n\n"
        "Score this resume and return the JSON."
    )
    try:
        resp = call_llm(
            system=_ATS_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
            max_tokens=2000,
        )
        result = _extract_json(resp.text or "")
        if result is None:
            return {
                "_error": "LLM returned unparseable output",
                "overall_score": 0,
                "job_profile": job_profile,
            }
        result.setdefault("job_profile", job_profile)
        result.setdefault("overall_score", 0)
        result.setdefault("grade", "D")
        result.setdefault("breakdown", {})
        result.setdefault("strengths", [])
        result.setdefault("improvement_areas", [])
        result.setdefault("recommendations", [])
        return result
    except Exception as exc:
        return {"_error": str(exc), "overall_score": 0, "job_profile": job_profile}
