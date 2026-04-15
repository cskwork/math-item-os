"""Deep Solve 요청/응답 모델."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class SolveRequest(BaseModel):
    """수학 문제 풀이 요청."""

    latex: str = Field(..., description="풀이할 수학 문제의 LaTeX 문자열")
    school_level: Literal["elementary", "middle", "high"] = Field(
        ..., description="학교 수준",
    )
    show_work: bool = Field(True, description="풀이 과정 표시 여부")


class SolutionStep(BaseModel):
    """풀이 단계."""

    step_num: int = Field(..., description="단계 번호")
    latex: str = Field(..., description="해당 단계의 LaTeX 수식")
    explanation: str = Field(..., description="해당 단계 설명")
    tool_used: str | None = Field(None, description="사용된 CAS 도구")


class SolveResponse(BaseModel):
    """수학 문제 풀이 응답."""

    success: bool = Field(..., description="풀이 성공 여부")
    steps: list[SolutionStep] | None = Field(None, description="풀이 단계")
    final_answer: str | None = Field(None, description="최종 답")
    verification: str | None = Field(None, description="검증 결과")
    error: str | None = Field(None, description="실패 시 오류 메시지")
