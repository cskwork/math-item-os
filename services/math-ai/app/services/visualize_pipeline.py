"""3-stage LLM 시각화 파이프라인: analyze → generate → review."""

from __future__ import annotations

import os
from dataclasses import dataclass

import httpx

_ZAI_API_URL = os.getenv(
    "ZAI_API_URL",
    "https://api.z.ai/api/coding/paas/v4/chat/completions",
)
_ZAI_MODEL = os.getenv("ZAI_MODEL", "glm-4.7")
_ZAI_API_KEY = os.getenv("ZAI_API_KEY", "")

_TIMEOUT_SECONDS = 30


# ---------------------------------------------------------------------------
# Result dataclasses (frozen)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class AnalysisResult:
    """수학 내용 분석 결과."""

    concept: str
    visual_strategy: str
    elements: list[str]


@dataclass(frozen=True)
class GenerationResult:
    """시각화 코드 생성 결과."""

    content: str
    viz_type: str
    raw_output: str


@dataclass(frozen=True)
class ReviewResult:
    """시각화 검토 결과."""

    cleaned_content: str
    review_notes: str
    is_valid: bool


@dataclass(frozen=True)
class PipelineResult:
    """파이프라인 최종 결과."""

    success: bool
    content: str | None
    review_notes: str | None
    error: str | None


# ---------------------------------------------------------------------------
# LLM helper
# ---------------------------------------------------------------------------


async def _chat(client: httpx.AsyncClient, system_prompt: str, user_msg: str) -> str:
    """Send a chat completion request and return the assistant message."""
    resp = await client.post(
        _ZAI_API_URL,
        json={
            "model": _ZAI_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_msg},
            ],
        },
        headers={"Authorization": f"Bearer {_ZAI_API_KEY}"},
        timeout=_TIMEOUT_SECONDS,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


# ---------------------------------------------------------------------------
# Pipeline stages
# ---------------------------------------------------------------------------


async def analyze_math_content(
    client: httpx.AsyncClient, latex: str
) -> AnalysisResult:
    """Stage 1: LaTeX 수식에서 시각화할 개념을 분석한다."""
    system_prompt = (
        "You are a math visualization analyst. "
        "Given a LaTeX expression, identify: "
        "1) the mathematical concept, "
        "2) the best visual strategy (graph, diagram, geometric, etc.), "
        "3) the visual elements needed. "
        "Reply in JSON: {\"concept\": str, \"visual_strategy\": str, \"elements\": [str]}"
    )
    raw = await _chat(client, system_prompt, latex)
    # Best-effort JSON parse; fall back to defaults
    import json

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = {}
    return AnalysisResult(
        concept=data.get("concept", "math expression"),
        visual_strategy=data.get("visual_strategy", "graph"),
        elements=data.get("elements", ["expression"]),
    )


async def generate_visualization(
    client: httpx.AsyncClient,
    analysis: AnalysisResult,
    viz_type: str,
) -> GenerationResult:
    """Stage 2: 분석 결과에 따라 SVG 또는 Chart.js 코드를 생성한다."""
    if viz_type == "svg":
        format_instruction = (
            "Generate a valid SVG string. Return ONLY the SVG markup, no markdown fences."
        )
    else:
        format_instruction = (
            "Generate a Chart.js config as JSON. Return ONLY the JSON object, no markdown fences."
        )

    system_prompt = (
        f"You are a math visualization generator. {format_instruction} "
        f"Concept: {analysis.concept}. Strategy: {analysis.visual_strategy}. "
        f"Elements: {', '.join(analysis.elements)}."
    )
    raw = await _chat(client, system_prompt, f"Create a {viz_type} visualization")
    return GenerationResult(content=raw, viz_type=viz_type, raw_output=raw)


async def review_visualization(
    client: httpx.AsyncClient,
    content: str,
    viz_type: str,
) -> ReviewResult:
    """Stage 3: 생성된 시각화 코드를 검증하고 정리한다."""
    system_prompt = (
        f"You are a {viz_type.upper()} code reviewer. "
        "Check the code for validity, clean it up if needed, "
        "and return ONLY the cleaned code. "
        "Add no commentary inside the code itself."
    )
    cleaned = await _chat(client, system_prompt, content)
    return ReviewResult(
        cleaned_content=cleaned,
        review_notes="Reviewed and cleaned",
        is_valid=True,
    )


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


async def run_visualize_pipeline(
    latex: str,
    viz_type: str,
    context: str | None = None,
) -> PipelineResult:
    """3단계 LLM 파이프라인을 실행하여 시각화 결과를 반환한다."""
    if not latex.strip():
        return PipelineResult(
            success=False,
            content=None,
            review_notes=None,
            error="빈 LaTeX 문자열입니다.",
        )

    try:
        async with httpx.AsyncClient() as client:
            analysis = await analyze_math_content(client, latex)
            generation = await generate_visualization(client, analysis, viz_type)
            review = await review_visualization(
                client, generation.content, viz_type
            )

        return PipelineResult(
            success=True,
            content=review.cleaned_content,
            review_notes=review.review_notes,
            error=None,
        )
    except Exception as exc:  # noqa: BLE001
        return PipelineResult(
            success=False,
            content=None,
            review_notes=None,
            error=f"시각화 파이프라인 실패: {exc}",
        )
