# backend/agents/provider.py
"""
Universal LLM client for PlacementIQ.
Supports Anthropic SDK (direct) and OpenAI-compatible APIs (Groq, OpenRouter, OpenAI).
Handles tool call format conversion and response parsing for both formats.
"""
import json
import anthropic
from openai import OpenAI
from config import ACTIVE_PROVIDER, PROVIDER_CONFIG, MODEL, API_KEY


# ── Tool Format Converters ────────────────────────────────────────────────────

def _to_openai_tools(anthropic_tools: list) -> list:
    """Convert Anthropic-format tools to OpenAI function-calling format."""
    return [
        {
            "type": "function",
            "function": {
                "name": t["name"],
                "description": t["description"],
                "parameters": t["input_schema"],
            },
        }
        for t in anthropic_tools
    ]


def _to_anthropic_messages(openai_messages: list) -> list:
    """
    Convert OpenAI-style message list to Anthropic format.
    OpenAI uses role=tool with tool_call_id; Anthropic uses role=user with tool_result blocks.
    This function is used internally when building Anthropic message history.
    """
    # For our use case, messages are always built internally per-provider, so this
    # function handles the conversion when we have tool_result messages.
    converted = []
    for msg in openai_messages:
        if msg["role"] == "tool":
            # Wrap as Anthropic tool_result inside a user turn
            converted.append({
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": msg.get("tool_call_id", "unknown"),
                    "content": msg["content"]
                }]
            })
        else:
            converted.append(msg)
    return converted


# ── Unified LLM Call ──────────────────────────────────────────────────────────

class LLMResponse:
    """Normalized response object — same shape regardless of provider."""
    def __init__(self, text: str = None, tool_calls: list = None, stop_reason: str = "end_turn"):
        self.text = text                  # Final text answer
        self.tool_calls = tool_calls or []  # List of {"id", "name", "input"} dicts
        self.stop_reason = stop_reason    # "end_turn" or "tool_use"


def call_llm(
    system: str,
    messages: list,
    tools: list = None,
    max_tokens: int = 2000
) -> LLMResponse:
    """
    Make a single LLM call. Returns a normalized LLMResponse.
    `messages` should be in a neutral internal format:
      [{"role": "user"|"assistant"|"tool", "content": str, "tool_call_id": ...}]
    """
    tool_format = PROVIDER_CONFIG["tool_format"]

    if tool_format == "anthropic":
        return _call_anthropic(system, messages, tools, max_tokens)
    else:
        return _call_openai_compatible(system, messages, tools, max_tokens)


# ── Anthropic Implementation ──────────────────────────────────────────────────

def _call_anthropic(system, messages, tools, max_tokens) -> LLMResponse:
    client = anthropic.Anthropic(api_key=API_KEY)

    # Build Anthropic message list
    anthropic_messages = []
    for msg in messages:
        role = msg["role"]
        content = msg["content"]

        if role == "tool":
            # Tool result — must be wrapped in user role as tool_result block
            anthropic_messages.append({
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": msg.get("tool_call_id"),
                    "content": content
                }]
            })
        elif role == "assistant" and isinstance(content, list):
            # Assistant message with tool_use blocks (already in Anthropic format)
            anthropic_messages.append({"role": "assistant", "content": content})
        else:
            anthropic_messages.append({"role": role, "content": content})

    kwargs = {
        "model": MODEL,
        "max_tokens": max_tokens,
        "system": system,
        "messages": anthropic_messages,
    }
    if tools:
        kwargs["tools"] = tools  # Already in Anthropic format

    response = client.messages.create(**kwargs)

    # Parse response
    if response.stop_reason == "tool_use":
        tool_calls = []
        text_parts = []
        for block in response.content:
            if block.type == "tool_use":
                tool_calls.append({
                    "id": block.id,
                    "name": block.name,
                    "input": block.input,
                    "_raw_block": block  # Keep for message reconstruction
                })
            elif hasattr(block, "text"):
                text_parts.append(block.text)
        return LLMResponse(
            text=" ".join(text_parts) if text_parts else None,
            tool_calls=tool_calls,
            stop_reason="tool_use"
        )
    else:
        text = " ".join(b.text for b in response.content if hasattr(b, "text"))
        return LLMResponse(text=text, stop_reason="end_turn")


# ── OpenAI-Compatible Implementation (Groq, OpenRouter, OpenAI) ───────────────

def _call_openai_compatible(system, messages, tools, max_tokens) -> LLMResponse:
    extra_headers = PROVIDER_CONFIG.get("extra_headers", {})
    client = OpenAI(
        api_key=API_KEY,
        base_url=PROVIDER_CONFIG["base_url"],
        default_headers=extra_headers
    )

    # Build OpenAI message list
    openai_messages = [{"role": "system", "content": system}]
    for msg in messages:
        role = msg["role"]
        if role == "tool":
            openai_messages.append({
                "role": "tool",
                "tool_call_id": msg.get("tool_call_id"),
                "content": msg["content"]
            })
        elif role == "assistant" and "tool_calls" in msg:
            openai_messages.append({
                "role": "assistant",
                "content": msg.get("content"),
                "tool_calls": msg["tool_calls"]
            })
        else:
            openai_messages.append({"role": role, "content": msg["content"]})

    kwargs = {
        "model": MODEL,
        "max_tokens": max_tokens,
        "messages": openai_messages,
    }
    if tools:
        kwargs["tools"] = _to_openai_tools(tools)
        kwargs["tool_choice"] = "auto"

    response = client.chat.completions.create(**kwargs)
    choice = response.choices[0]
    message = choice.message

    if choice.finish_reason == "tool_calls" and message.tool_calls:
        tool_calls = []
        for tc in message.tool_calls:
            tool_calls.append({
                "id": tc.id,
                "name": tc.function.name,
                "input": json.loads(tc.function.arguments),
                "_raw_openai": tc  # Keep for message reconstruction
            })
        return LLMResponse(
            text=message.content,
            tool_calls=tool_calls,
            stop_reason="tool_use"
        )
    else:
        return LLMResponse(text=message.content, stop_reason="end_turn")
