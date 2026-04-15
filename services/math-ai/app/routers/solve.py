"""Deep Solve endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from app.models.solve import SolveRequest, SolveResponse, SolutionStep
from app.services.solve_pipeline import run_solve_pipeline

router = APIRouter()


@router.post(
    "",
    response_model=SolveResponse,
    summary="수학 문제를 다단계 에이전트 파이프라인으로 풀이",
)
async def solve(body: SolveRequest) -> SolveResponse:
    """Plan -> ReAct -> Write 파이프라인으로 수학 문제를 풀이한다."""
    result = await run_solve_pipeline(
        latex=body.latex,
        school_level=body.school_level,
        show_work=body.show_work,
    )

    return SolveResponse(
        success=result.success,
        steps=[
            SolutionStep(
                step_num=s.step_num,
                latex=s.latex,
                explanation=s.explanation,
                tool_used=s.tool_used,
            )
            for s in result.steps
        ]
        if result.steps
        else None,
        final_answer=result.final_answer,
        verification=result.verification,
        error=result.error,
    )
