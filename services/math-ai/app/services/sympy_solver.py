"""SymPy 기반 CAS(Computer Algebra System) 풀이 서비스.

수학 문항의 방정식 풀이, 수식 간소화, 동치 검증, 정답 검증 기능을 제공한다.
모든 연산은 ThreadPoolExecutor를 통해 10초 타임아웃으로 실행되며,
예외 발생 시 HTTP 에러 대신 결과 객체의 error 필드로 반환한다.
"""

from __future__ import annotations

import concurrent.futures
import re
from dataclasses import dataclass

_SOLVE_TIMEOUT_SECONDS = 10


# ---------------------------------------------------------------------------
# 결과 데이터 클래스 (불변)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SolveResult:
    """방정식 풀이 결과."""

    success: bool
    solutions: list[str] | None  # str(solution) 리스트
    solutions_latex: list[str] | None  # sympy.latex(solution) 리스트
    error: str | None


@dataclass(frozen=True)
class SimplifyResult:
    """수식 간소화 결과."""

    success: bool
    simplified: str | None  # str(expr)
    simplified_latex: str | None  # sympy.latex(expr)
    error: str | None


@dataclass(frozen=True)
class EqualsCheckResult:
    """두 수식의 동치 검증 결과."""

    success: bool
    equivalent: bool | None
    error: str | None


@dataclass(frozen=True)
class VerifyResult:
    """정답 대입 검증 결과."""

    success: bool
    correct: bool | None
    explanation: str | None
    error: str | None


# ---------------------------------------------------------------------------
# 내부 워커 함수 (별도 스레드에서 실행, SymPy 지연 임포트)
# ---------------------------------------------------------------------------


def _worker_solve(latex: str) -> tuple[list[str], list[str]]:
    """LaTeX 방정식을 풀어 해 목록을 반환한다.

    Returns:
        (str 해 리스트, LaTeX 해 리스트)
    """
    from sympy import latex as sympy_latex, solve
    from sympy.parsing.latex import parse_latex

    expr = parse_latex(latex)

    # 등호가 포함된 경우 Eq 형태로 변환하여 풀이
    if expr.is_Relational:
        solutions = solve(expr, dict=False)
    else:
        # 등호 없이 '= 0'으로 간주
        solutions = solve(expr, dict=False)

    solutions_str = [str(s) for s in solutions]
    solutions_latex = [sympy_latex(s) for s in solutions]
    return solutions_str, solutions_latex


def _worker_simplify(latex: str) -> tuple[str, str]:
    """LaTeX 수식을 간소화한다.

    Returns:
        (간소화된 str, 간소화된 LaTeX)
    """
    from sympy import latex as sympy_latex, simplify
    from sympy.parsing.latex import parse_latex

    expr = parse_latex(latex)
    simplified = simplify(expr)
    return str(simplified), sympy_latex(simplified)


def _worker_check_equals(latex_a: str, latex_b: str) -> bool:
    """두 LaTeX 수식의 기호적 동치 여부를 판별한다.

    Returns:
        동치이면 True
    """
    from sympy import simplify
    from sympy.parsing.latex import parse_latex

    expr_a = parse_latex(latex_a)
    expr_b = parse_latex(latex_b)
    return simplify(expr_a - expr_b) == 0


_CASES_PATTERN = r"\\begin\{cases\}(.+?)\\end\{cases\}"
_BRACE_NEGATIVE_PATTERN = re.compile(r"\{(-[\d.]+)\}")


def _strip_render_braces(latex: str) -> str:
    """렌더링 전용 중괄호 래핑(`{-3}`)을 파서 친화 형태(`-3`)로 정규화한다.

    `generator._format_value_for_latex`가 음수 계수를 `{-N}` 형태로 감싸므로
    `parse_latex`가 인식할 수 있는 평문 형태로 복원한다.
    """
    return _BRACE_NEGATIVE_PATTERN.sub(r"\1", latex)


def _parse_tuple_answer(ans_clean: str, free_vars: list) -> dict:
    """제출 정답을 `{Symbol: expr}` 딕셔너리로 파싱한다.

    지원 입력 형태:
      - "x=42, y=-34" (권장, 튜플 스타일)
      - "2" 단일값 (backward compat — 첫 변수로 할당)
    """
    import re

    from sympy import Symbol
    from sympy.parsing.latex import parse_latex

    cleaned = ans_clean.strip()
    result: dict = {}

    if "=" in cleaned and re.search(r"[a-zA-Z_]\w*\s*=", cleaned):
        for pair in cleaned.split(","):
            if "=" not in pair:
                continue
            var_name, val_str = pair.split("=", 1)
            sym = Symbol(var_name.strip())
            result[sym] = parse_latex(val_str.strip())
        return result

    if free_vars:
        result[free_vars[0]] = parse_latex(cleaned)
    return result


def _worker_verify_answer(
    equation_latex: str,
    answer_latex: str,
) -> tuple[bool, str]:
    """방정식에 정답을 대입하여 만족 여부를 검증한다.

    Returns:
        (정답 여부, 설명 문자열)
    """
    import re

    from sympy import simplify, solve
    from sympy.parsing.latex import parse_latex

    eq_clean = _strip_render_braces(equation_latex)
    ans_clean = _strip_render_braces(answer_latex)

    # ── 연립방정식 (\begin{cases}) 분기 ──
    cases_match = re.search(_CASES_PATTERN, eq_clean, re.DOTALL)
    if cases_match:
        body = cases_match.group(1)
        eq_strs = [s.strip() for s in re.split(r"\\\\", body) if s.strip()]
        eqs = [parse_latex(s) for s in eq_strs]
        free_vars = sorted(
            {s for e in eqs for s in e.free_symbols},
            key=str,
        )
        sols = solve(eqs, free_vars, dict=True)
        if not sols:
            return False, "연립방정식의 해가 없습니다."

        submitted = _parse_tuple_answer(ans_clean, free_vars)
        if not submitted:
            return False, "제출된 정답을 파싱할 수 없습니다."

        all_correct = all(
            simplify(sols[0][var] - val) == 0
            for var, val in submitted.items()
            if var in sols[0]
        )
        pairs = ", ".join(f"{v}={sols[0][v]}" for v in free_vars)
        return all_correct, (
            f"연립방정식 해 ({pairs}), "
            f"제출: {'만족' if all_correct else '불만족'}"
        )

    eq_expr = parse_latex(eq_clean)
    ans_expr = parse_latex(ans_clean)

    # 방정식에서 자유 변수 추출
    free_vars = eq_expr.free_symbols

    if not free_vars:
        # 자유 변수가 없으면 수식 자체가 참/거짓
        result = simplify(eq_expr)
        is_correct = result == 0 or result is True
        explanation = (
            "변수 없는 수식입니다. "
            f"수식 평가 결과: {result}"
        )
        return is_correct, explanation

    # 변수가 하나인 경우 대입 검증
    if len(free_vars) == 1:
        var = free_vars.pop()

        if eq_expr.is_Relational:
            # Eq(lhs, rhs) 형태인 경우
            substituted = eq_expr.subs(var, ans_expr)
            # 대입 결과가 True/False(BooleanAtom)이면 직접 판정
            if substituted is True or substituted == True:  # noqa: E712
                is_correct = True
                explanation = (
                    f"변수 {var}에 {ans_expr}을 대입한 결과: 만족 (잔차: 0)"
                )
                return is_correct, explanation
            if substituted is False or substituted == False:  # noqa: E712
                is_correct = False
                explanation = (
                    f"변수 {var}에 {ans_expr}을 대입한 결과: 불만족"
                )
                return is_correct, explanation
            lhs = substituted.lhs if hasattr(substituted, "lhs") else substituted
            rhs = substituted.rhs if hasattr(substituted, "rhs") else 0
            diff = simplify(lhs - rhs)
        else:
            # expr = 0 형태로 간주
            diff = simplify(eq_expr.subs(var, ans_expr))

        is_correct = diff == 0
        explanation = (
            f"변수 {var}에 {ans_expr}을 대입한 결과: "
            f"{'만족' if is_correct else '불만족'} "
            f"(잔차: {diff})"
        )
        return is_correct, explanation

    # 다변수인 경우 단순 동치 비교로 대체
    explanation = (
        f"다변수 방정식({', '.join(str(v) for v in free_vars)})입니다. "
        "단일 값 대입 검증이 불가능합니다."
    )
    return False, explanation


# ---------------------------------------------------------------------------
# 공개 API 함수
# ---------------------------------------------------------------------------


def _run_with_timeout(fn, *args):
    """ThreadPoolExecutor로 fn을 실행하고 타임아웃을 적용한다."""
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(fn, *args)
        return future.result(timeout=_SOLVE_TIMEOUT_SECONDS)


def solve_equation(latex: str) -> SolveResult:
    """LaTeX 방정식을 풀어 해 목록을 반환한다.

    Args:
        latex: 풀이할 방정식의 LaTeX 문자열

    Returns:
        SolveResult: 풀이 결과 (성공 시 해 목록, 실패 시 에러 메시지)
    """
    stripped = latex.strip()
    if not stripped:
        return SolveResult(
            success=False,
            solutions=None,
            solutions_latex=None,
            error="빈 LaTeX 문자열입니다.",
        )

    try:
        solutions_str, solutions_latex = _run_with_timeout(
            _worker_solve, stripped,
        )
        return SolveResult(
            success=True,
            solutions=solutions_str,
            solutions_latex=solutions_latex,
            error=None,
        )
    except concurrent.futures.TimeoutError:
        return SolveResult(
            success=False,
            solutions=None,
            solutions_latex=None,
            error=f"풀이 타임아웃: {_SOLVE_TIMEOUT_SECONDS}초 초과.",
        )
    except Exception as exc:  # noqa: BLE001
        return SolveResult(
            success=False,
            solutions=None,
            solutions_latex=None,
            error=f"방정식 풀이 실패: {exc}",
        )


def simplify_expression(latex: str) -> SimplifyResult:
    """LaTeX 수식을 간소화한다.

    Args:
        latex: 간소화할 수식의 LaTeX 문자열

    Returns:
        SimplifyResult: 간소화 결과 (성공 시 간소화된 수식, 실패 시 에러 메시지)
    """
    stripped = latex.strip()
    if not stripped:
        return SimplifyResult(
            success=False,
            simplified=None,
            simplified_latex=None,
            error="빈 LaTeX 문자열입니다.",
        )

    try:
        simplified_str, simplified_latex = _run_with_timeout(
            _worker_simplify, stripped,
        )
        return SimplifyResult(
            success=True,
            simplified=simplified_str,
            simplified_latex=simplified_latex,
            error=None,
        )
    except concurrent.futures.TimeoutError:
        return SimplifyResult(
            success=False,
            simplified=None,
            simplified_latex=None,
            error=f"간소화 타임아웃: {_SOLVE_TIMEOUT_SECONDS}초 초과.",
        )
    except Exception as exc:  # noqa: BLE001
        return SimplifyResult(
            success=False,
            simplified=None,
            simplified_latex=None,
            error=f"수식 간소화 실패: {exc}",
        )


def check_equals(latex_a: str, latex_b: str) -> EqualsCheckResult:
    """두 LaTeX 수식의 기호적 동치 여부를 판별한다.

    Args:
        latex_a: 첫 번째 수식의 LaTeX 문자열
        latex_b: 두 번째 수식의 LaTeX 문자열

    Returns:
        EqualsCheckResult: 동치 검증 결과
    """
    stripped_a = latex_a.strip()
    stripped_b = latex_b.strip()

    if not stripped_a or not stripped_b:
        return EqualsCheckResult(
            success=False,
            equivalent=None,
            error="비교할 LaTeX 문자열이 비어 있습니다.",
        )

    try:
        equivalent = _run_with_timeout(
            _worker_check_equals, stripped_a, stripped_b,
        )
        return EqualsCheckResult(
            success=True,
            equivalent=equivalent,
            error=None,
        )
    except concurrent.futures.TimeoutError:
        return EqualsCheckResult(
            success=False,
            equivalent=None,
            error=f"동치 검증 타임아웃: {_SOLVE_TIMEOUT_SECONDS}초 초과.",
        )
    except Exception as exc:  # noqa: BLE001
        return EqualsCheckResult(
            success=False,
            equivalent=None,
            error=f"동치 검증 실패: {exc}",
        )


def verify_answer(
    equation_latex: str,
    answer_latex: str,
) -> VerifyResult:
    """방정식에 정답을 대입하여 만족 여부를 검증한다.

    Args:
        equation_latex: 방정식의 LaTeX 문자열
        answer_latex: 정답의 LaTeX 문자열

    Returns:
        VerifyResult: 정답 검증 결과 (정답 여부 + 설명)
    """
    stripped_eq = equation_latex.strip()
    stripped_ans = answer_latex.strip()

    if not stripped_eq or not stripped_ans:
        return VerifyResult(
            success=False,
            correct=None,
            explanation=None,
            error="방정식 또는 정답 LaTeX 문자열이 비어 있습니다.",
        )

    try:
        correct, explanation = _run_with_timeout(
            _worker_verify_answer, stripped_eq, stripped_ans,
        )
        return VerifyResult(
            success=True,
            correct=correct,
            explanation=explanation,
            error=None,
        )
    except concurrent.futures.TimeoutError:
        return VerifyResult(
            success=False,
            correct=None,
            explanation=None,
            error=f"정답 검증 타임아웃: {_SOLVE_TIMEOUT_SECONDS}초 초과.",
        )
    except Exception as exc:  # noqa: BLE001
        return VerifyResult(
            success=False,
            correct=None,
            explanation=None,
            error=f"정답 검증 실패: {exc}",
        )
