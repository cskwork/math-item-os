"""문항 변이 생성 및 CAS 정답 검증 엔드포인트."""

from __future__ import annotations

import time

from fastapi import APIRouter

from app.models.generate import (
    CasVerification,
    GenerateRequest,
    GenerateResponse,
    ParameterDefModel,
    VariantModel,
    VerifyRequest,
    VerifyResponse,
)
from app.services.generator import ParameterDef, generate_variant
from app.services.sympy_solver import solve_equation, verify_answer

router = APIRouter()


# ---------------------------------------------------------------------------
# 내부 변환 함수
# ---------------------------------------------------------------------------


def _to_parameter_def(model: ParameterDefModel) -> ParameterDef:
    """ParameterDefModel (Pydantic) -> ParameterDef (dataclass) 변환."""
    return ParameterDef(
        name=model.name,
        type=model.type,
        min=model.min,
        max=model.max,
        constraints=list(model.constraints),
    )


# ---------------------------------------------------------------------------
# POST /generate - 변이 문항 생성
# ---------------------------------------------------------------------------


@router.post(
    "",
    response_model=GenerateResponse,
    summary="템플릿 기반 변이 문항 생성",
)
async def generate_variants(body: GenerateRequest) -> GenerateResponse:
    """매개변수 정의와 템플릿으로부터 변이 문항을 생성한다.

    - count 만큼 변이를 생성하며, seed가 지정되면 각 변이마다 seed를 1씩 증가시킨다.
    - 생성 실패한 변이는 failed_count에 집계한다.
    - 모든 변이 생성에 실패하면 success=false를 반환한다.
    """
    if not body.body_template.strip():
        return GenerateResponse(
            success=False,
            variants=None,
            failed_count=0,
            error="빈 본문 템플릿입니다.",
        )

    if not body.parameters:
        return GenerateResponse(
            success=False,
            variants=None,
            failed_count=0,
            error="매개변수 정의가 비어 있습니다.",
        )

    param_defs = [_to_parameter_def(p) for p in body.parameters]

    # 시드가 없으면 현재 시각 기반으로 생성
    base_seed = (
        body.seed
        if body.seed is not None
        else int(time.time() * 1000) % (2**31)
    )

    variants: list[VariantModel] = []
    failed_count = 0

    for i in range(body.count):
        current_seed = base_seed + i

        result = generate_variant(
            body_template=body.body_template,
            param_defs=param_defs,
            answer_template=body.answer_template,
            constraints=body.constraints,
            seed=current_seed,
        )

        if result.success:
            variants.append(
                VariantModel(
                    body_latex=result.body_latex,  # type: ignore[arg-type]
                    params=result.params,  # type: ignore[arg-type]
                    answer_value=result.answer_value,  # type: ignore[arg-type]
                    answer_latex=result.answer_latex,  # type: ignore[arg-type]
                    seed=result.seed,  # type: ignore[arg-type]
                )
            )
        else:
            failed_count += 1

    if not variants:
        return GenerateResponse(
            success=False,
            variants=None,
            failed_count=failed_count,
            error="모든 변이 생성에 실패했습니다.",
        )

    return GenerateResponse(
        success=True,
        variants=variants,
        failed_count=failed_count,
        error=None,
    )


# ---------------------------------------------------------------------------
# POST /verify - CAS 정답 검증
# ---------------------------------------------------------------------------


@router.post(
    "/verify",
    response_model=VerifyResponse,
    summary="CAS 기반 정답 검증",
)
async def verify_math_answer(body: VerifyRequest) -> VerifyResponse:
    """방정식에 정답을 대입하여 CAS 기반으로 검증한다.

    - verify_answer()로 정답 대입 검증을 수행한다.
    - check_equivalence=true이면 solve_equation()으로 해를 구해 유일성도 확인한다.
    """
    equation = body.equation_latex.strip()
    answer = body.answer_latex.strip()

    if not equation or not answer:
        return VerifyResponse(
            success=False,
            verification=None,
            error="방정식 또는 정답 LaTeX가 비어 있습니다.",
        )

    # 정답 대입 검증
    verify_result = verify_answer(equation, answer)

    if not verify_result.success:
        return VerifyResponse(
            success=False,
            verification=None,
            error=verify_result.error,
        )

    answer_equivalence: bool | None = None
    solution_uniqueness: bool | None = None

    # 동치 검증 요청 시 추가 검증
    if body.check_equivalence:
        solve_result = solve_equation(equation)

        if solve_result.success and solve_result.solutions is not None:
            # 해의 유일성: 해가 정확히 1개이면 유일
            solution_uniqueness = len(solve_result.solutions) == 1

            # 동치 여부: 제출된 정답이 풀이 결과 중 하나와 일치하는지 확인
            answer_equivalence = _check_answer_in_solutions(
                answer, solve_result.solutions,
            )

    return VerifyResponse(
        success=True,
        verification=CasVerification(
            answer_correct=verify_result.correct or False,
            answer_equivalence=answer_equivalence,
            solution_uniqueness=solution_uniqueness,
            explanation=verify_result.explanation,
        ),
        error=None,
    )


def _check_answer_in_solutions(
    answer_latex: str,
    solutions: list[str],
) -> bool:
    """제출된 정답이 풀이 결과 목록에 포함되는지 확인한다.

    SymPy check_equals를 사용하여 기호적으로 비교한다.
    """
    from app.services.sympy_solver import check_equals

    for solution in solutions:
        result = check_equals(answer_latex, solution)
        if result.success and result.equivalent:
            return True

    return False
