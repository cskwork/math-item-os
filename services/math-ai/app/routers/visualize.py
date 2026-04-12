"""시각화 엔드포인트."""

from __future__ import annotations

from fastapi import APIRouter

from app.models.visualize import VisualizeRequest, VisualizeResponse
from app.services.visualize_pipeline import run_visualize_pipeline

router = APIRouter()


@router.post(
    "",
    response_model=VisualizeResponse,
    summary="LaTeX 수식을 SVG/Chart.js로 시각화",
)
async def visualize(body: VisualizeRequest) -> VisualizeResponse:
    """LaTeX 수식을 3단계 LLM 파이프라인으로 시각화한다."""
    result = await run_visualize_pipeline(
        latex=body.latex,
        viz_type=body.visualization_type,
        context=body.context,
    )
    return VisualizeResponse(
        success=result.success,
        visualization_type=body.visualization_type if result.success else None,
        content=result.content,
        review_notes=result.review_notes,
        error=result.error,
    )
