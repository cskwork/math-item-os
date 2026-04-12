"""시각화 요청/응답 모델."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class VisualizeRequest(BaseModel):
    """LaTeX 수식 시각화 요청."""

    latex: str = Field(..., description="시각화할 LaTeX 수식 문자열")
    visualization_type: Literal["svg", "chartjs"] = Field(
        "svg", description="출력 형식: svg 또는 chartjs"
    )
    context: str | None = Field(None, description="추가 맥락 정보 (선택)")


class VisualizeResponse(BaseModel):
    """시각화 결과 응답."""

    success: bool = Field(..., description="시각화 성공 여부")
    visualization_type: str | None = Field(None, description="출력 형식")
    content: str | None = Field(None, description="SVG 문자열 또는 Chart.js JSON")
    review_notes: str | None = Field(None, description="검토 노트")
    error: str | None = Field(None, description="실패 시 오류 메시지")
