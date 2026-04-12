"""Deep Solve 3-stage pipeline: Plan -> ReAct -> Write.

LLM reasoning + SymPy CAS verification.
"""

from __future__ import annotations

import json
import os
from collections.abc import Callable
from dataclasses import dataclass

import httpx

from app.models.solve import SolutionStep
from app.services.sympy_solver import solve_equation, verify_answer

_ZAI_API_URL = os.getenv(
    "ZAI_API_URL",
    "https://api.z.ai/api/coding/paas/v4/chat/completions",
)
_ZAI_MODEL = os.getenv("ZAI_MODEL", "glm-4.7")
_ZAI_API_KEY = os.getenv("ZAI_API_KEY", "")

_MAX_REACT_ITERATIONS = 5


# ---------------------------------------------------------------------------
# Result dataclasses (frozen)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PlanResult:
    """Stage 1 output."""

    problem_type: str
    approach: str
    estimated_steps: int


@dataclass(frozen=True)
class ReactResult:
    """Stage 2 output."""

    steps: list[SolutionStep]
    final_answer: str
    tool_calls_made: int


@dataclass(frozen=True)
class WriteResult:
    """Stage 3 output."""

    formatted_steps: list[SolutionStep]
    explanation: str


@dataclass(frozen=True)
class SolvePipelineResult:
    """Orchestrator output."""

    success: bool
    steps: list[SolutionStep] | None = None
    final_answer: str | None = None
    verification: str | None = None
    error: str | None = None


# ---------------------------------------------------------------------------
# LLM helper
# ---------------------------------------------------------------------------


async def _call_llm(messages: list[dict[str, str]]) -> httpx.Response:
    """Send a chat completion request to Z.ai."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        return await client.post(
            _ZAI_API_URL,
            headers={
                "Authorization": f"Bearer {_ZAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": _ZAI_MODEL,
                "messages": messages,
            },
        )


def _parse_llm_json(response: httpx.Response) -> dict:
    """Extract JSON from LLM response content."""
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    return json.loads(content)


# ---------------------------------------------------------------------------
# CAS tool dispatch
# ---------------------------------------------------------------------------

_CAS_TOOLS: dict[str, Callable[..., object]] = {
    "solve_equation": lambda args: solve_equation(args["latex"]),
    "verify_answer": lambda args: verify_answer(
        args["equation_latex"], args["answer_latex"],
    ),
}


def _run_cas_tool(name: str, args: dict) -> str:
    """Execute a CAS tool and return a string summary."""
    fn = _CAS_TOOLS.get(name)
    if fn is None:
        return f"Unknown tool: {name}"
    result = fn(args)
    # All sympy_solver results are frozen dataclasses — convert to dict-like string
    return json.dumps(
        {k: v for k, v in result.__dict__.items()},
        ensure_ascii=False,
        default=str,
    )


# ---------------------------------------------------------------------------
# Stage 1: Plan
# ---------------------------------------------------------------------------


async def plan_solution(latex: str, school_level: str) -> PlanResult:
    """Analyze problem structure via LLM."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are a math tutor. Analyze the problem and return JSON with "
                "keys: problem_type, approach, estimated_steps. No extra text."
            ),
        },
        {
            "role": "user",
            "content": f"Problem ({school_level} level): {latex}",
        },
    ]
    data = _parse_llm_json(await _call_llm(messages))
    return PlanResult(
        problem_type=data["problem_type"],
        approach=data["approach"],
        estimated_steps=int(data["estimated_steps"]),
    )


# ---------------------------------------------------------------------------
# Stage 2: ReAct
# ---------------------------------------------------------------------------


async def react_solve(plan: PlanResult, latex: str) -> ReactResult:
    """ReAct loop: LLM decides tool calls, CAS executes them."""
    steps: list[SolutionStep] = []
    tool_calls_made = 0
    conversation = [
        {
            "role": "system",
            "content": (
                "You are solving a math problem using tools. "
                "Available tools: solve_equation(latex), verify_answer(equation_latex, answer_latex). "
                f"Problem type: {plan.problem_type}. Approach: {plan.approach}. "
                "At each step return JSON: either "
                '{"action": "<tool>", "action_input": {<args>}} to call a tool, or '
                '{"final_answer": "<answer>"} when done. No extra text.'
            ),
        },
        {"role": "user", "content": f"Solve: {latex}"},
    ]

    for iteration in range(_MAX_REACT_ITERATIONS):
        data = _parse_llm_json(await _call_llm(conversation))

        # Final answer reached
        if "final_answer" in data:
            return ReactResult(
                steps=steps,
                final_answer=str(data["final_answer"]),
                tool_calls_made=tool_calls_made,
            )

        # Tool call
        action = data["action"]
        action_input = data["action_input"]
        tool_result = _run_cas_tool(action, action_input)
        tool_calls_made += 1

        steps.append(SolutionStep(
            step_num=len(steps) + 1,
            latex=action_input.get("latex", latex),
            explanation=f"Used {action}: {tool_result}",
            tool_used=action,
        ))

        conversation.append({"role": "assistant", "content": json.dumps(data)})
        conversation.append({"role": "user", "content": f"Tool result: {tool_result}"})

    # Exhausted iterations — use last tool result as answer
    return ReactResult(
        steps=steps,
        final_answer=steps[-1].explanation if steps else "Could not solve",
        tool_calls_made=tool_calls_made,
    )


# ---------------------------------------------------------------------------
# Stage 3: Write
# ---------------------------------------------------------------------------


async def write_solution(
    react_result: ReactResult,
    school_level: str,
) -> WriteResult:
    """Format solution for target audience via LLM."""
    messages = [
        {
            "role": "system",
            "content": (
                f"You are writing a math solution for a {school_level} school student. "
                "Return JSON with key 'steps': list of "
                '{"step_num": int, "latex": str, "explanation": str}. '
                "Use simple language appropriate for the level. No extra text."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Solution steps: {json.dumps([s.model_dump() for s in react_result.steps], ensure_ascii=False)}. "
                f"Final answer: {react_result.final_answer}"
            ),
        },
    ]
    data = _parse_llm_json(await _call_llm(messages))
    formatted_steps = [
        SolutionStep(
            step_num=s["step_num"],
            latex=s["latex"],
            explanation=s["explanation"],
            tool_used=None,
        )
        for s in data["steps"]
    ]
    return WriteResult(
        formatted_steps=formatted_steps,
        explanation=formatted_steps[-1].explanation if formatted_steps else "",
    )


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


async def run_solve_pipeline(
    latex: str,
    school_level: str,
    show_work: bool = True,
) -> SolvePipelineResult:
    """Run the full Plan -> ReAct -> Write pipeline."""
    stripped = latex.strip()
    if not stripped:
        return SolvePipelineResult(
            success=False,
            error="Empty LaTeX input.",
        )

    try:
        # Stage 1: Plan
        plan = await plan_solution(stripped, school_level)

        # Stage 2: ReAct
        react_result = await react_solve(plan, stripped)

        # Stage 3: Write (skip if show_work=False)
        if show_work:
            write_result = await write_solution(react_result, school_level)
            steps = write_result.formatted_steps
        else:
            steps = None

        # Verification via CAS
        verify = verify_answer(stripped, react_result.final_answer)
        verification = verify.explanation if verify.success else None

        return SolvePipelineResult(
            success=True,
            steps=steps,
            final_answer=react_result.final_answer,
            verification=verification,
        )

    except Exception as exc:  # noqa: BLE001
        return SolvePipelineResult(
            success=False,
            error=f"Pipeline error: {exc}",
        )
