"""5-agent Manim animation pipeline.

Each agent is a function that calls the Z.ai LLM (except validate which uses ast).
The main orchestrator runs them in sequence and returns a frozen dataclass result.
"""

from __future__ import annotations

import ast
import json
import os
from dataclasses import dataclass

import httpx

ZAI_API_URL = os.getenv(
    "ZAI_API_URL",
    "https://api.z.ai/api/coding/paas/v4/chat/completions",
)
ZAI_MODEL = os.getenv("ZAI_MODEL", "glm-4.7")
ZAI_API_KEY = os.getenv("ZAI_API_KEY", "")

_TIMEOUT = 30


# ---------------------------------------------------------------------------
# Result dataclasses (frozen/immutable)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ConceptAnalysis:
    concept_type: str
    key_elements: list[str]
    complexity: str


@dataclass(frozen=True)
class AnimationDesign:
    scenes: list[dict]
    transitions: list[str]
    estimated_duration: int


@dataclass(frozen=True)
class CodeGenResult:
    code: str
    imports: list[str]
    class_name: str


@dataclass(frozen=True)
class ValidationResult:
    is_valid: bool
    errors: list[str]
    warnings: list[str]


@dataclass(frozen=True)
class AnimatePipelineResult:
    success: bool
    manim_code: str | None
    summary: str | None
    error: str | None


# ---------------------------------------------------------------------------
# LLM helper
# ---------------------------------------------------------------------------


async def _call_llm(system_prompt: str, user_prompt: str) -> str:
    """Call Z.ai chat completions and return the assistant message content."""
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            ZAI_API_URL,
            headers={
                "Authorization": f"Bearer {ZAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": ZAI_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


# ---------------------------------------------------------------------------
# Pipeline agent functions
# ---------------------------------------------------------------------------


async def analyze_concept(latex: str) -> ConceptAnalysis:
    """Agent 1: Parse the math concept from LaTeX."""
    raw = await _call_llm(
        system_prompt=(
            "You are a math concept analyzer. Given a LaTeX expression, "
            "return a JSON object with keys: concept_type (str), "
            "key_elements (list[str]), complexity (str: simple/medium/complex). "
            "Return ONLY valid JSON, no markdown."
        ),
        user_prompt=latex,
    )
    parsed = json.loads(raw)
    return ConceptAnalysis(
        concept_type=parsed["concept_type"],
        key_elements=parsed["key_elements"],
        complexity=parsed["complexity"],
    )


async def design_animation(
    analysis: ConceptAnalysis, style: str, duration_hint: int | None = None,
) -> AnimationDesign:
    """Agent 2: Design animation scenes and transitions."""
    context = (
        f"Concept: {analysis.concept_type}, "
        f"Elements: {analysis.key_elements}, "
        f"Complexity: {analysis.complexity}, "
        f"Style: {style}"
    )
    if duration_hint is not None:
        context += f", Target duration: {duration_hint}s"

    raw = await _call_llm(
        system_prompt=(
            "You are a Manim animation designer. Given a math concept analysis, "
            "plan the animation. Return a JSON object with keys: "
            "scenes (list of dicts with 'description'), "
            "transitions (list[str]), estimated_duration (int seconds). "
            "Return ONLY valid JSON, no markdown."
        ),
        user_prompt=context,
    )
    parsed = json.loads(raw)
    return AnimationDesign(
        scenes=parsed["scenes"],
        transitions=parsed["transitions"],
        estimated_duration=parsed["estimated_duration"],
    )


async def generate_manim_code(design: AnimationDesign) -> CodeGenResult:
    """Agent 3: Generate Manim Python code from the design."""
    raw = await _call_llm(
        system_prompt=(
            "You are a Manim code generator. Given an animation design, "
            "produce valid Python code using the Manim library. "
            "Return ONLY the Python code, no markdown fences."
        ),
        user_prompt=json.dumps({
            "scenes": design.scenes,
            "transitions": design.transitions,
            "estimated_duration": design.estimated_duration,
        }),
    )
    # Extract class name from code
    class_name = "Scene"
    for line in raw.splitlines():
        stripped = line.strip()
        if stripped.startswith("class ") and "Scene" in stripped:
            class_name = stripped.split("(")[0].replace("class ", "").strip()
            break

    # Extract imports
    imports = [
        line.strip()
        for line in raw.splitlines()
        if line.strip().startswith(("import ", "from "))
    ]

    return CodeGenResult(code=raw, imports=imports, class_name=class_name)


def validate_manim_code(code: str) -> ValidationResult:
    """Agent 4: Validate generated code using ast.parse (no LLM)."""
    errors: list[str] = []
    warnings: list[str] = []

    try:
        ast.parse(code)
    except SyntaxError as exc:
        errors.append(f"Syntax error at line {exc.lineno}: {exc.msg}")

    if "Scene" not in code:
        warnings.append("Code does not contain a Scene class.")

    return ValidationResult(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
    )


async def summarize_animation(design: AnimationDesign, code: str) -> str:
    """Agent 5: Produce a text summary of the animation."""
    raw = await _call_llm(
        system_prompt=(
            "You are a math animation summarizer. Given the animation design "
            "and Manim code, write a brief (1-2 sentence) summary of what "
            "the animation shows. Return ONLY the summary text."
        ),
        user_prompt=f"Design: {json.dumps({'scenes': design.scenes})}\nCode:\n{code}",
    )
    return raw.strip()


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------


async def run_animate_pipeline(
    latex: str,
    style: str,
    duration_hint: int | None = None,
) -> AnimatePipelineResult:
    """Run the 5-agent animation pipeline end-to-end."""
    stripped = latex.strip()
    if not stripped:
        return AnimatePipelineResult(
            success=False,
            manim_code=None,
            summary=None,
            error="Empty LaTeX string.",
        )

    try:
        analysis = await analyze_concept(stripped)
        design = await design_animation(analysis, style, duration_hint)
        code_result = await generate_manim_code(design)

        validation = validate_manim_code(code_result.code)
        if not validation.is_valid:
            return AnimatePipelineResult(
                success=False,
                manim_code=None,
                summary=None,
                error=f"Invalid generated code: {'; '.join(validation.errors)}",
            )

        summary = await summarize_animation(design, code_result.code)

        return AnimatePipelineResult(
            success=True,
            manim_code=code_result.code,
            summary=summary,
            error=None,
        )
    except Exception as exc:  # noqa: BLE001
        return AnimatePipelineResult(
            success=False,
            manim_code=None,
            summary=None,
            error=f"Pipeline error: {exc}",
        )
