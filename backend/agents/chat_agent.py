# backend/agents/chat_agent.py
"""
Role-scoped conversational assistant for PlacementIQ.

Three scopes — enforced server-side, not just by prompt:
  • public  — product Q&A grounded in docs (RAG). No data tools, no portfolio access.
  • student — personal coach LOCKED to the caller's own student_id only.
  • admin   — lender/RM copilot with the full tool set and portfolio access.

Design: hybrid grounding. Retrieved doc chunks (knowledge.py) answer "what / how"
questions; the existing tool registry (tools.py) answers live "what is X" questions.
A hard rule in every prompt forbids inventing numbers — answers must come from a
tool result or the provided context.
"""
import re

import config
from provider import call_llm, LLMResponse
from base_agent import _append_assistant_turn, _append_tool_results
from tools import TOOL_DEFINITIONS, execute_tool
from knowledge import retrieve

# Tools the assistant may use in chat. The raw feature-vector tools
# (predict_placement_probability / estimate_salary_range) are deliberately
# EXCLUDED — requiring a feature dict makes the bot ask users to paste JSON.
# lookup_student covers the "score a student" case from just an id, zero effort.
_ADMIN_TOOLS = {
    "lookup_student", "ingest_students", "get_shap_drivers", "get_emi_data",
    "get_peer_cohort_stats", "get_intervention_cost_table", "get_labor_market_data",
    "get_adjacent_fields", "get_company_health_signals", "get_institute_momentum",
}
_STUDENT_TOOLS = {
    "lookup_student", "get_shap_drivers", "get_emi_data",
    "get_intervention_cost_table", "get_labor_market_data", "get_adjacent_fields",
}
# Tools whose student_id input is force-locked to the caller for the student scope.
_ID_SCOPED_TOOLS = {"lookup_student", "get_shap_drivers", "get_emi_data"}

_BASE_RULES = (
    "Write like a knowledgeable, friendly human advisor — not a form or a robot. "
    "Ground specific numbers about a student/portfolio in a tool result or the provided "
    "context and never fabricate those; but you MAY give general, well-known guidance "
    "freely. Never ask the user to paste JSON, feature vectors or raw numbers; if you "
    "need a student, ask for their ID (e.g. STU-2026-00001) or look them up. "
    "Format for readability: use short paragraphs, **bold** for key numbers/actions, "
    "and bullet lists where they help. Be thorough but skimmable — give a genuinely "
    "useful, complete answer (not a one-liner), and end with a clear next step or an "
    "offer to go deeper. If the user requests a specific format (table, JSON, CSV, "
    "bullets), reply in exactly that format."
)

_PUBLIC_PROMPT = f"""You are the PlacementIQ Assistant on the public website.
PlacementIQ is an AI education-loan placement-risk platform by Poonawalla Fincorp:
it predicts how soon a student will be placed (3/6/12 months), their expected salary,
and a placement-risk band, then recommends actions to improve outcomes.

Help visitors understand what the product is, how it works, the methodology, and how
to get started. You may also explain how education loans and approval factors
generally work, and how a student can improve their chances — give genuinely helpful,
well-known guidance even without their personal data. You don't have access to any
specific borrower or account; if asked about one, warmly invite them to sign in.
{_BASE_RULES}"""

_STUDENT_PROMPT = f"""You are the PlacementIQ Coach for a signed-in student/borrower.
Help THIS student understand their placement-risk profile and, above all, how to
improve it and strengthen their loan position. You can only see this student's own
data — if asked about another student, politely decline.

Use the STUDENT CONTEXT and your tools (already locked to this student) for their
specifics. If they ask how to get their loan approved or improve their approval odds,
coach them with concrete, encouraging steps — raising placement probability through
internships, skill certifications, a stronger resume/portfolio, better field/market
fit, or adding a co-borrower. You don't issue the final underwriting decision, but you
actively help them improve their chances. For "what if" questions, reason from the
intervention data and explain the likely lift. {_BASE_RULES}"""

_ADMIN_PROMPT = f"""You are the PlacementIQ Copilot for a lender / relationship manager.
Analyse portfolio placement-risk. To analyse any student, take their student ID and
call lookup_student — one call returns 3/6/12-month placement probabilities, risk
band, expected salary, top risk drivers and recommended interventions. You also have
tools for SHAP drivers, EMI data, peer cohorts, intervention costs, labour-market
signals, company health and institute momentum.

You can ONBOARD students: if the user pastes data in ANY format (JSON, CSV or plain
text), parse it into records and call ingest_students, then confirm and offer to score
them. Infer fields sensibly; never demand a rigid format.

You can freely discuss what drives loan approvals and how to structure or de-risk a
loan — but you provide decision SUPPORT, not the final verdict: placement risk is one
input among many and the platform never auto-approves or denies credit. {_BASE_RULES}"""


_GREETING_WORDS = {
    "hi", "hii", "hiii", "hey", "heyy", "hello", "helo", "yo", "hiya", "howdy",
    "namaste", "sup", "hi there", "hey there", "hello there", "good morning",
    "good afternoon", "good evening", "start", "help", "menu", "begin",
}
_GREETINGS = {
    "public": (
        "Hi! 👋 I'm the PlacementIQ assistant. I can explain how we predict placement "
        "risk, expected salary and 3/6/12-month timelines — and how to get started.\n\n"
        "Try asking:\n"
        "• \"What is PlacementIQ?\"\n"
        "• \"How is the risk score calculated?\"\n"
        "• \"Do you make the credit decision?\""
    ),
    "student": (
        "Hi! 👋 I'm your PlacementIQ coach. I can explain your placement score and, "
        "more usefully, how to improve it.\n\n"
        "Try asking:\n"
        "• \"Why is my risk band what it is?\"\n"
        "• \"How can I improve my score?\"\n"
        "• \"What if I do a 2-month internship?\""
    ),
    "admin": (
        "Hi! 👋 I'm your PlacementIQ copilot. Give me a student ID (e.g. STU-2026-00001) "
        "and I'll pull their placement risk, drivers, salary and recommended "
        "interventions — no data entry needed. You can also paste student data (JSON, "
        "CSV or plain text) and I'll onboard them for you.\n\n"
        "Try asking:\n"
        "• \"Why is STU-2026-00001 at risk?\"\n"
        "• \"Best-ROI interventions for STU-2026-00001\"\n"
        "• \"What's the current market shock risk?\""
    ),
}


def _is_greeting(text: str) -> bool:
    """True for short greetings / openers like 'hi', 'hey!', 'good morning 👋'."""
    t = re.sub(r"[^a-z ]+", "", (text or "").strip().lower()).strip()
    return t in _GREETING_WORDS


def _tools_for(role: str) -> list:
    if role == "admin":
        names = _ADMIN_TOOLS
    elif role == "student":
        names = _STUDENT_TOOLS
    else:
        return []  # public: no data tools
    return [t for t in TOOL_DEFINITIONS if t["name"] in names]


def _build_system(role, context_block, student_context, portfolio_summary, student_id) -> str:
    base = {"public": _PUBLIC_PROMPT, "student": _STUDENT_PROMPT, "admin": _ADMIN_PROMPT}[role]
    parts = [base]
    if role == "student" and student_context:
        parts.append(f"\nSTUDENT CONTEXT (this is the ONLY student you may discuss):\n{student_context}")
        parts.append(f"\nThe caller's locked student_id is: {student_id}")
    if role == "admin" and portfolio_summary:
        parts.append(f"\nPORTFOLIO SNAPSHOT:\n{portfolio_summary}")
    if context_block:
        parts.append(f"\nCONTEXT (retrieved from PlacementIQ docs):\n{context_block}")
    return "\n".join(parts)


def _scoped_execute(name: str, inp: dict, role: str, student_id: str | None) -> str:
    """Run a tool, enforcing student-id locking for the student scope."""
    if role == "student" and student_id:
        if name in _ID_SCOPED_TOOLS or "student_id" in inp:
            inp = {**inp, "student_id": student_id}  # force own id, ignore any other
    return execute_tool(name, inp)


_MAX_TOKENS = 1200


def _safe_call_llm(system_prompt, convo, tools):
    """Call the model, retrying once WITHOUT tools if a tool-enabled call fails.
    Tool-calling is the fragile path on smaller/free models; a plain completion
    almost always succeeds, so this keeps the assistant responsive instead of
    collapsing to a doc dump."""
    try:
        return call_llm(system=system_prompt, messages=convo,
                        tools=tools or None, max_tokens=_MAX_TOKENS)
    except Exception as e:
        if tools:
            print(f"[Chat] tool call failed ({type(e).__name__}: {e}) — retrying without tools")
            return call_llm(system=system_prompt, messages=convo, tools=None, max_tokens=_MAX_TOKENS)
        raise


def _run_chat(system_prompt, messages, tools, role, student_id, max_iters=3):
    convo = [{"role": m["role"], "content": m["content"]} for m in messages
             if m.get("role") in ("user", "assistant") and m.get("content")]
    used: list[str] = []
    last: LLMResponse | None = None

    for _ in range(max_iters):
        last = _safe_call_llm(system_prompt, convo, tools)
        if last.stop_reason != "tool_use" or not last.tool_calls:
            if (last.text or "").strip():
                return last.text, used
            break  # empty answer → synthesize one below

        _append_assistant_turn(convo, last, config.PROVIDER_CONFIG["tool_format"])
        results = []
        for tc in last.tool_calls:
            out = _scoped_execute(tc["name"], tc.get("input", {}), role, student_id)
            used.append(tc["name"])
            results.append({"tool_call_id": tc["id"], "result": out, "tool_name": tc["name"]})
        _append_tool_results(convo, results, config.PROVIDER_CONFIG["tool_format"])

    # Tool loop produced no direct text (or hit the iteration cap) → one plain
    # completion to synthesize an answer from the gathered tool results / context.
    final = _safe_call_llm(system_prompt, convo, None)
    return (final.text or (last.text if last else "") or "").strip(), used


def chat_reply(role, student_id=None, messages=None,
               student_context=None, portfolio_summary=None) -> dict:
    """Main entrypoint. Returns {reply, scope, used_tools, sources}."""
    role = (role or "public").lower()
    if role not in ("public", "student", "admin"):
        role = "public"
    messages = messages or []
    if role != "student":
        student_id = None  # only the student scope binds an id

    user_msgs = [m for m in messages if m.get("role") == "user"]
    query = user_msgs[-1]["content"] if user_msgs else ""

    # Greeting / vague opener → instant friendly intro. No LLM call, never asks for
    # data, and guarantees a good first impression instead of an interrogation.
    if len(user_msgs) <= 1 and _is_greeting(query):
        return {"reply": _GREETINGS.get(role, _GREETINGS["public"]),
                "scope": role, "used_tools": [], "sources": []}

    snippets = retrieve(query, k=3 if role == "public" else 2)
    context_block = "\n\n".join(
        f"[{s['source']} — {s['title']}]\n{s['text']}" for s in snippets
    )
    system = _build_system(role, context_block, student_context, portfolio_summary, student_id)
    tools = _tools_for(role)

    try:
        reply, used = _run_chat(system, messages, tools, role, student_id)
        reply = (reply or "").strip()
        if not reply:
            raise ValueError("empty reply from model")
    except Exception as e:
        print(f"[Chat] LLM call failed: {type(e).__name__}: {e}")
        # Graceful degradation: serve the top retrieved snippet if we have one.
        if snippets:
            return {
                "reply": ("Here's the most relevant information from our documentation:\n\n"
                          f"{snippets[0]['text'][:500]}\n\n"
                          "_(I'm in reduced mode for a moment — ask again shortly for a fuller, "
                          "tailored answer.)_"),
                "scope": role, "used_tools": [],
                "sources": sorted({s["source"] for s in snippets}), "degraded": True,
            }
        return {
            "reply": "I'm having trouble reaching the AI service right now — please try again in a few seconds.",
            "scope": role, "used_tools": [], "sources": [], "degraded": True,
        }

    return {
        "reply": reply,
        "scope": role,
        "used_tools": sorted(set(used)),
        "sources": sorted({s["source"] for s in snippets}),
    }
