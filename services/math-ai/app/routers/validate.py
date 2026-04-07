"""LaTeX-to-SymPy 변환 엔드포인트."""

from __future__ import annotations

import concurrent.futures

from fastapi import APIRouter

from app.models.validate import LatexToSympyRequest, LatexToSympyResponse

router = APIRouter()

_PARSE_TIMEOUT_SECONDS = 10


def _parse_latex_to_sympy(latex: str) -> tuple[str, str]:
    """LaTeX 문자열을 SymPy 표현식으로 변환한다.

    별도 스레드에서 실행되므로 signal 대신 ThreadPoolExecutor 타임아웃을 사용한다.

    Returns:
        (sympy_expr 문자열, 정규화된 latex 문자열)

    Raises:
        Exception: 파싱 실패 시 원본 예외를 그대로 전파한다.
    """
    from sympy import latex as sympy_latex
    from sympy.parsing.latex import parse_latex

    expr = parse_latex(latex)
    return str(expr), sympy_latex(expr)


@router.post(
    "/latex-to-sympy",
    response_model=LatexToSympyResponse,
    summary="LaTeX를 SymPy 표현식으로 변환",
)
async def convert_latex_to_sympy(
    body: LatexToSympyRequest,
) -> LatexToSympyResponse:
    """LaTeX 수식을 SymPy 표현식으로 변환한다.

    - 빈 문자열: 즉시 실패 응답
    - 파싱 실패: success=false + error 메시지 (HTTP 에러 아님)
    - 10초 타임아웃: 복잡한 수식의 무한 루프 방지
    """
    latex_input = body.latex.strip()

    if not latex_input:
        return LatexToSympyResponse(
            success=False,
            sympy_expr=None,
            latex_normalized=None,
            error="빈 LaTeX 문자열입니다.",
        )

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_parse_latex_to_sympy, latex_input)
            sympy_expr, latex_normalized = future.result(
                timeout=_PARSE_TIMEOUT_SECONDS,
            )

        return LatexToSympyResponse(
            success=True,
            sympy_expr=sympy_expr,
            latex_normalized=latex_normalized,
            error=None,
        )

    except concurrent.futures.TimeoutError:
        return LatexToSympyResponse(
            success=False,
            sympy_expr=None,
            latex_normalized=None,
            error=f"파싱 타임아웃: {_PARSE_TIMEOUT_SECONDS}초 초과.",
        )
    except Exception as exc:  # noqa: BLE001
        return LatexToSympyResponse(
            success=False,
            sympy_expr=None,
            latex_normalized=None,
            error=f"LaTeX 파싱 실패: {exc}",
        )
