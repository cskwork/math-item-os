"""Manim animation generation endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from app.models.animate import AnimateRequest, AnimateResponse
from app.services.animate_pipeline import run_animate_pipeline

router = APIRouter()


@router.post(
    "",
    response_model=AnimateResponse,
    summary="Generate Manim animation code from LaTeX",
)
async def animate(body: AnimateRequest) -> AnimateResponse:
    """Generate Manim animation code for a LaTeX math expression."""
    result = await run_animate_pipeline(
        latex=body.latex,
        style=body.animation_style,
        duration_hint=body.duration_hint,
    )
    return AnimateResponse(
        success=result.success,
        manim_code=result.manim_code,
        summary=result.summary,
        error=result.error,
    )
