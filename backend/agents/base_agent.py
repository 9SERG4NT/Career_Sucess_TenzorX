# backend/agents/base_agent.py
"""
Provider-agnostic agentic loop.
Calls LLM, handles tool use, feeds results back, loops until done.
"""
import json
from provider import call_llm, LLMResponse
from tools import execute_tool, TOOL_DEFINITIONS
import config


def run_agent(
    system_prompt: str,
    user_message: str,
    tools: list = None,
    max_iterations: int = 6,
) -> str:
    """
    Agentic loop: runs the LLM until it produces a final text response.
    The agent may call tools multiple times before answering.

    Args:
        system_prompt: Role + rules for this agent
        user_message: Task description with student context
        tools: List of tool definitions (defaults to TOOL_DEFINITIONS)
        max_iterations: Safety cap on tool-call rounds

    Returns:
        Final text response from the agent
    """
    if tools is None:
        tools = TOOL_DEFINITIONS

    messages = [{"role": "user", "content": user_message}]

    for iteration in range(max_iterations):
        response: LLMResponse = call_llm(
            system=system_prompt,
            messages=messages,
            tools=tools,
            max_tokens=2000
        )

        # Agent is done — return final answer
        if response.stop_reason == "end_turn":
            return response.text or ""

        # Agent wants to call tools
        if response.stop_reason == "tool_use" and response.tool_calls:
            # Add assistant turn to history (format depends on provider)
            _append_assistant_turn(messages, response, config.PROVIDER_CONFIG["tool_format"])

            # Execute each requested tool and collect results
            tool_results = []
            for tc in response.tool_calls:
                result_str = execute_tool(tc["name"], tc["input"])
                print(f"  [Tool] {tc['name']}({list(tc['input'].keys())}) → {result_str[:120]}...")
                tool_results.append({
                    "tool_call_id": tc["id"],
                    "result": result_str,
                    "tool_name": tc["name"]
                })

            # Add tool results to message history
            _append_tool_results(messages, tool_results, config.PROVIDER_CONFIG["tool_format"])
            continue

        # Unexpected stop
        break

    return response.text or "Agent did not produce a final answer within iteration limit."


def _append_assistant_turn(messages: list, response: LLMResponse, tool_format: str):
    """Append the assistant's tool-calling turn in the correct format for the provider."""
    if tool_format == "anthropic":
        # Anthropic: assistant content is a list of blocks
        content_blocks = []
        if response.text:
            content_blocks.append({"type": "text", "text": response.text})
        for tc in response.tool_calls:
            content_blocks.append({
                "type": "tool_use",
                "id": tc["id"],
                "name": tc["name"],
                "input": tc["input"]
            })
        messages.append({"role": "assistant", "content": content_blocks})
    else:
        # OpenAI format: tool_calls array
        openai_tool_calls = []
        for tc in response.tool_calls:
            openai_tool_calls.append({
                "id": tc["id"],
                "type": "function",
                "function": {
                    "name": tc["name"],
                    "arguments": json.dumps(tc["input"])
                }
            })
        messages.append({
            "role": "assistant",
            "content": response.text,
            "tool_calls": openai_tool_calls
        })


def _append_tool_results(messages: list, tool_results: list, tool_format: str):
    """Append tool results to message history in the correct format for the provider."""
    if tool_format == "anthropic":
        # Anthropic: all results go in a single user message as tool_result blocks
        result_blocks = []
        for tr in tool_results:
            result_blocks.append({
                "type": "tool_result",
                "tool_use_id": tr["tool_call_id"],
                "content": tr["result"]
            })
        messages.append({"role": "user", "content": result_blocks})
    else:
        # OpenAI: each result is a separate "tool" role message
        for tr in tool_results:
            messages.append({
                "role": "tool",
                "tool_call_id": tr["tool_call_id"],
                "content": tr["result"]
            })
