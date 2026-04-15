"""변이 문항 생성 서비스 - 템플릿 기반 수학 문항 변이 생성 및 제약 조건 검증."""

from __future__ import annotations

import random
import re
import time
from collections.abc import Callable
from dataclasses import dataclass, field

from app.services.latex_utils import parse_cases_body, strip_render_braces


# ---------------------------------------------------------------------------
# 데이터 클래스 정의
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ParameterDef:
    """매개변수 정의 - 이름, 타입, 범위, 제약 조건."""

    name: str
    type: str  # "integer" | "float"
    min: int | float
    max: int | float
    constraints: list[str] = field(default_factory=list)
    # constraints: "nonzero", "positive", "negative", "odd", "even"


@dataclass(frozen=True)
class AnswerResult:
    """정답 계산 결과.

    단일변수 방정식은 `value`/`value_latex`만 채워지고,
    연립방정식은 추가로 `values`/`values_latex`에 변수별 해를 담는다.
    """

    success: bool
    value: str | None  # str(answer) — 단일값 또는 첫 변수 값
    value_latex: str | None  # sympy.latex(answer)
    values: dict[str, str] | None = None  # 연립방정식 해 {변수명: str(해)}
    values_latex: dict[str, str] | None = None  # {변수명: latex(해)}
    error: str | None = None


@dataclass(frozen=True)
class ConstraintResult:
    """제약 조건 검증 결과."""

    passed: bool
    failures: list[str]  # 실패한 제약 조건 설명 목록


@dataclass(frozen=True)
class VariantResult:
    """생성된 변이 문항 결과."""

    success: bool
    body_latex: str | None  # 치환된 LaTeX
    params: dict | None  # {매개변수명: 값}
    answer_value: str | None  # 계산된 정답 (단일값 또는 튜플의 첫 변수)
    answer_latex: str | None  # LaTeX 형식 정답
    answer_values: dict[str, str] | None = None  # 연립방정식 해
    answer_values_latex: dict[str, str] | None = None  # 연립방정식 해 LaTeX
    seed: int | None = None
    error: str | None = None


# ---------------------------------------------------------------------------
# 매개변수 제약 조건 검증 함수 (개별 매개변수 수준)
# ---------------------------------------------------------------------------

_PARAM_CONSTRAINT_VALIDATORS: dict[str, tuple[Callable[[int | float], bool], str]] = {}
"""매개변수 수준 제약 조건 -> (검증 함수, 실패 메시지 템플릿) 매핑."""


def _check_nonzero(value: int | float) -> bool:
    return value != 0


def _check_positive(value: int | float) -> bool:
    return value > 0


def _check_negative(value: int | float) -> bool:
    return value < 0


def _check_odd(value: int | float) -> bool:
    return isinstance(value, int) and value % 2 != 0


def _check_even(value: int | float) -> bool:
    return isinstance(value, int) and value % 2 == 0


_PARAM_CONSTRAINT_VALIDATORS = {
    "nonzero": (_check_nonzero, "값이 0이 아니어야 합니다"),
    "positive": (_check_positive, "값이 양수여야 합니다"),
    "negative": (_check_negative, "값이 음수여야 합니다"),
    "odd": (_check_odd, "값이 홀수여야 합니다"),
    "even": (_check_even, "값이 짝수여야 합니다"),
}


# ---------------------------------------------------------------------------
# 매개변수 생성
# ---------------------------------------------------------------------------


def _generate_single_param(
    param_def: ParameterDef,
    rng: random.Random,
    max_inner_attempts: int = 200,
) -> int | float | None:
    """단일 매개변수 값을 제약 조건을 만족하도록 생성한다.

    max_inner_attempts 안에 유효한 값을 찾지 못하면 None을 반환한다.
    """
    for _ in range(max_inner_attempts):
        if param_def.type == "integer":
            value = rng.randint(int(param_def.min), int(param_def.max))
        else:
            value = rng.uniform(float(param_def.min), float(param_def.max))

        if _satisfies_param_constraints(value, param_def.constraints):
            return value

    return None


def _satisfies_param_constraints(
    value: int | float,
    constraints: list[str],
) -> bool:
    """값이 매개변수 수준의 모든 제약 조건을 만족하는지 확인한다."""
    for constraint in constraints:
        validator = _PARAM_CONSTRAINT_VALIDATORS.get(constraint)
        if validator is None:
            continue
        check_fn, _ = validator
        if not check_fn(value):
            return False
    return True


def generate_parameters(
    param_defs: list[ParameterDef],
    seed: int | None = None,
) -> dict[str, int | float]:
    """매개변수 정의에 따라 무작위 값을 생성한다.

    Args:
        param_defs: 매개변수 정의 목록
        seed: 재현 가능한 생성을 위한 시드 값

    Returns:
        {매개변수명: 생성된 값} 딕셔너리

    Raises:
        ValueError: 제약 조건을 만족하는 값을 찾을 수 없는 경우
    """
    rng = random.Random(seed)
    result: dict[str, int | float] = {}

    for param_def in param_defs:
        value = _generate_single_param(param_def, rng)
        if value is None:
            raise ValueError(
                f"매개변수 '{param_def.name}'의 제약 조건을 만족하는 값을 "
                f"찾을 수 없습니다: range=[{param_def.min}, {param_def.max}], "
                f"constraints={param_def.constraints}"
            )
        result[param_def.name] = value

    return result


# ---------------------------------------------------------------------------
# 템플릿 치환
# ---------------------------------------------------------------------------

_PLACEHOLDER_PATTERN = re.compile(r"\{\{(\w+)\}\}")


def _strip_placeholders(template: str) -> str:
    """{{변수명}} 플레이스홀더의 중괄호를 제거하여 SymPy 호환 수식으로 변환한다.

    예: "({{c}} - {{b}}) / {{a}}" -> "(c - b) / a"
    """
    return _PLACEHOLDER_PATTERN.sub(r"\1", template)


def substitute_template(
    template: str,
    params: dict[str, int | float],
) -> str:
    """LaTeX 템플릿의 {{변수명}} 플레이스홀더를 실제 값으로 치환한다.

    음수 값은 LaTeX에서 올바르게 표시되도록 중괄호로 감싼다.
    예: -3 -> {-3}

    Args:
        template: {{변수명}} 플레이스홀더가 포함된 LaTeX 문자열
        params: {매개변수명: 값} 딕셔너리

    Returns:
        치환된 LaTeX 문자열
    """

    def _replace_match(match: re.Match) -> str:
        name = match.group(1)
        if name not in params:
            return match.group(0)  # 매칭되는 매개변수가 없으면 원본 유지
        value = params[name]
        return _format_value_for_latex(value)

    return _PLACEHOLDER_PATTERN.sub(_replace_match, template)


def _format_value_for_latex(value: int | float) -> str:
    """값을 LaTeX 삽입에 적합한 문자열로 변환한다.

    - 정수: 그대로 문자열 변환 (음수면 중괄호로 감쌈)
    - 실수: 불필요한 소수점 0 제거 후 변환 (음수면 중괄호로 감쌈)
    """
    if isinstance(value, float) and value == int(value):
        # 2.0 -> "2" 처럼 불필요한 소수점 제거
        formatted = str(int(value))
    else:
        formatted = str(value)

    if value < 0:
        return "{" + formatted + "}"

    return formatted


# ---------------------------------------------------------------------------
# 정답 계산
# ---------------------------------------------------------------------------


def compute_answer(
    answer_template: str,
    params: dict[str, int | float],
) -> AnswerResult:
    """SymPy를 사용하여 정답 표현식을 계산한다.

    answer_template에 매개변수 값을 대입하고 수식을 평가한다.

    Args:
        answer_template: 매개변수를 포함한 수식 문자열 (예: "c/a + b" 또는 "{{c}}/{{a}} + {{b}}")
        params: {매개변수명: 값} 딕셔너리

    Returns:
        계산 결과를 담은 AnswerResult
    """
    try:
        import sympy

        # {{변수명}} 플레이스홀더 제거 (SymPy 호환)
        answer_template = _strip_placeholders(answer_template)

        # SymPy 심볼로 매개변수를 정의한다
        symbols = {
            name: sympy.Symbol(name)
            for name in params
        }

        # 수식을 SymPy 표현식으로 파싱한다
        expr = sympy.sympify(answer_template, locals=symbols)

        # 매개변수 값을 대입한다
        substituted = expr.subs(
            {symbols[name]: value for name, value in params.items()}
        )

        # 수치 결과로 단순화한다
        result = sympy.nsimplify(substituted)

        return AnswerResult(
            success=True,
            value=str(result),
            value_latex=sympy.latex(result),
        )

    except Exception as exc:  # noqa: BLE001
        return AnswerResult(
            success=False,
            value=None,
            value_latex=None,
            error=f"정답 계산 실패: {exc}",
        )


def compute_system_answer(body_latex_substituted: str) -> AnswerResult:
    """`\\begin{cases}` 환경을 감지해 SymPy solve로 연립방정식을 풀이한다.

    단일변수 템플릿에는 사용하지 말고, `\\begin{cases}...\\end{cases}`를
    포함한 치환 완료된 LaTeX 본문을 전달해야 한다.

    Args:
        body_latex_substituted: 매개변수가 이미 치환된 LaTeX 본문

    Returns:
        `AnswerResult` — `values`/`values_latex`에 변수별 해가 담긴다.
        `value`/`value_latex`에는 첫 변수(알파벳 순)의 값이 복제된다.
    """
    try:
        import sympy

        eq_clean = strip_render_braces(body_latex_substituted)
        parsed = parse_cases_body(eq_clean)
        if parsed is None:
            return AnswerResult(
                success=False,
                value=None,
                value_latex=None,
                error="\\begin{cases} 환경을 찾을 수 없습니다.",
            )

        eqs, free_vars = parsed
        sols = sympy.solve(eqs, free_vars, dict=True)
        if not sols:
            return AnswerResult(
                success=False,
                value=None,
                value_latex=None,
                error="연립방정식의 해가 없습니다.",
            )

        primary = sols[0]
        values = {str(var): str(primary[var]) for var in free_vars}
        values_latex = {
            str(var): sympy.latex(primary[var]) for var in free_vars
        }
        first_var = free_vars[0]
        return AnswerResult(
            success=True,
            value=str(primary[first_var]),
            value_latex=sympy.latex(primary[first_var]),
            values=values,
            values_latex=values_latex,
        )

    except Exception as exc:  # noqa: BLE001
        return AnswerResult(
            success=False,
            value=None,
            value_latex=None,
            error=f"연립방정식 풀이 실패: {exc}",
        )


# ---------------------------------------------------------------------------
# 제약 조건 검증 (전체 변이 수준)
# ---------------------------------------------------------------------------


def validate_constraints(
    constraints: dict,
    params: dict[str, int | float],
    answer_template: str,
) -> ConstraintResult:
    """생성된 매개변수와 정답이 전체 제약 조건을 만족하는지 검증한다.

    Args:
        constraints: 제약 조건 딕셔너리 (예: {"integer_solution": true, ...})
        params: {매개변수명: 값} 딕셔너리
        answer_template: 정답 계산 수식

    Returns:
        검증 결과를 담은 ConstraintResult
    """
    failures: list[str] = []

    # {{변수명}} 플레이스홀더 제거 (직접 호출 시에도 안전하도록)
    answer_template = _strip_placeholders(answer_template)

    answer_result = compute_answer(answer_template, params)

    if not answer_result.success:
        failures.append(f"정답 계산 실패: {answer_result.error}")
        return ConstraintResult(passed=False, failures=failures)

    # 각 제약 조건별 검증
    _ConstraintValidator = Callable[[AnswerResult, dict[str, int | float], str], str | None]
    validator_map: dict[str, _ConstraintValidator] = {
        "integer_solution": _validate_integer_solution,
        "positive_answer": _validate_positive_answer,
        "no_zero_denominator": _validate_no_zero_denominator,
        "negative_answer": _validate_negative_answer,
        "nonzero_answer": _validate_nonzero_answer,
    }

    for constraint_name, enabled in constraints.items():
        if not enabled:
            continue
        validator = validator_map.get(constraint_name)
        if validator is None:
            continue
        failure_msg = validator(answer_result, params, answer_template)
        if failure_msg is not None:
            failures.append(failure_msg)

    return ConstraintResult(passed=len(failures) == 0, failures=failures)


def _validate_integer_solution(
    answer: AnswerResult,
    _params: dict[str, int | float],
    _answer_template: str,
) -> str | None:
    """정답이 정수인지 검증한다."""
    import sympy

    try:
        value = sympy.sympify(answer.value)
        if not value.is_integer:
            return f"정답이 정수가 아닙니다: {answer.value}"
    except Exception:  # noqa: BLE001
        return f"정답의 정수 여부 확인 실패: {answer.value}"

    return None


def _validate_positive_answer(
    answer: AnswerResult,
    _params: dict[str, int | float],
    _answer_template: str,
) -> str | None:
    """정답이 양수인지 검증한다."""
    import sympy

    try:
        value = sympy.sympify(answer.value)
        if not value.is_positive:
            return f"정답이 양수가 아닙니다: {answer.value}"
    except Exception:  # noqa: BLE001
        return f"정답의 양수 여부 확인 실패: {answer.value}"

    return None


def _validate_negative_answer(
    answer: AnswerResult,
    _params: dict[str, int | float],
    _answer_template: str,
) -> str | None:
    """정답이 음수인지 검증한다."""
    import sympy

    try:
        value = sympy.sympify(answer.value)
        if not value.is_negative:
            return f"정답이 음수가 아닙니다: {answer.value}"
    except Exception:  # noqa: BLE001
        return f"정답의 음수 여부 확인 실패: {answer.value}"

    return None


def _validate_nonzero_answer(
    answer: AnswerResult,
    _params: dict[str, int | float],
    _answer_template: str,
) -> str | None:
    """정답이 0이 아닌지 검증한다."""
    import sympy

    try:
        value = sympy.sympify(answer.value)
        if value.is_zero:
            return f"정답이 0입니다: {answer.value}"
    except Exception:  # noqa: BLE001
        return f"정답의 0 여부 확인 실패: {answer.value}"

    return None


def _validate_no_zero_denominator(
    _answer: AnswerResult,
    params: dict[str, int | float],
    answer_template: str,
) -> str | None:
    """정답 수식에서 분모가 0이 되지 않는지 검증한다.

    SymPy로 수식을 분석하여 분모에 해당하는 부분이 0이 아닌지 확인한다.
    """
    import sympy

    try:
        symbols = {
            name: sympy.Symbol(name)
            for name in params
        }
        expr = sympy.sympify(answer_template, locals=symbols)

        # 분모를 추출한다
        _, denominator = expr.as_numer_denom()

        # 매개변수 대입 후 분모 값을 확인한다
        denom_value = denominator.subs(
            {symbols[name]: value for name, value in params.items()}
        )

        if denom_value == 0:
            return "수식의 분모가 0입니다"

    except Exception:  # noqa: BLE001
        # 분모 추출이 불가능한 단순 수식은 분모가 0일 수 없으므로 통과
        pass

    return None


# ---------------------------------------------------------------------------
# 변이 문항 생성 (오케스트레이션)
# ---------------------------------------------------------------------------


def generate_variant(
    body_template: str,
    param_defs: list[ParameterDef],
    answer_template: str,
    constraints: dict,
    seed: int | None = None,
    max_attempts: int = 50,
) -> VariantResult:
    """템플릿으로부터 변이 문항을 생성한다.

    매개변수 생성 -> 제약 조건 검증 -> (실패 시 재시도) -> 템플릿 치환 -> 정답 계산
    순서로 처리한다.

    Args:
        body_template: {{변수명}} 플레이스홀더가 포함된 LaTeX 템플릿
        param_defs: 매개변수 정의 목록
        answer_template: 정답 계산 수식 (예: "c/a + b")
        constraints: 제약 조건 딕셔너리 (예: {"integer_solution": true})
        seed: 재현 가능한 생성을 위한 시드 값
        max_attempts: 유효한 변이를 찾기 위한 최대 시도 횟수

    Returns:
        생성된 변이 문항 결과를 담은 VariantResult
    """
    # 시드가 지정되지 않으면 현재 시각 기반으로 생성한다
    effective_seed = seed if seed is not None else int(time.time() * 1000) % (2**31)

    # {{변수명}} 플레이스홀더 제거 (SymPy 호환)
    answer_template = _strip_placeholders(answer_template)

    last_failures: list[str] = []

    for attempt in range(max_attempts):
        # 시도마다 시드를 변경하여 다른 매개변수를 생성한다
        attempt_seed = effective_seed + attempt

        try:
            params = generate_parameters(param_defs, seed=attempt_seed)
        except ValueError as exc:
            last_failures = [str(exc)]
            continue

        # 제약 조건 검증
        constraint_result = validate_constraints(
            constraints, params, answer_template,
        )

        if not constraint_result.passed:
            last_failures = constraint_result.failures
            continue

        # 제약 조건을 통과한 경우 - 템플릿 치환 및 정답 계산
        body_latex = substitute_template(body_template, params)

        # 연립방정식(\begin{cases}) 템플릿은 SymPy solve로 전체 해를 계산
        if r"\begin{cases}" in body_template:
            answer_result = compute_system_answer(body_latex)
        else:
            answer_result = compute_answer(answer_template, params)

        if not answer_result.success:
            last_failures = [answer_result.error or "정답 계산 실패"]
            continue

        return VariantResult(
            success=True,
            body_latex=body_latex,
            params=params,
            answer_value=answer_result.value,
            answer_latex=answer_result.value_latex,
            answer_values=answer_result.values,
            answer_values_latex=answer_result.values_latex,
            seed=attempt_seed,
        )

    # 모든 시도 실패
    return VariantResult(
        success=False,
        body_latex=None,
        params=None,
        answer_value=None,
        answer_latex=None,
        seed=effective_seed,
        error=(
            f"{max_attempts}회 시도 후 유효한 변이를 생성하지 못했습니다. "
            f"마지막 실패 사유: {', '.join(last_failures)}"
        ),
    )
