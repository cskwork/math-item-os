"""generator.py 단위 테스트 - {{var}} 플레이스홀더 처리 및 정답 계산 검증."""

from __future__ import annotations

import pytest

from app.services.generator import (
    ParameterDef,
    _strip_placeholders,
    compute_answer,
    generate_variant,
    validate_constraints,
)


# ---------------------------------------------------------------------------
# _strip_placeholders
# ---------------------------------------------------------------------------


class TestStripPlaceholders:
    def test_basic(self) -> None:
        assert _strip_placeholders("({{c}} - {{b}}) / {{a}}") == "(c - b) / a"

    def test_complex_multichar_names(self) -> None:
        result = _strip_placeholders(
            "({{c1}}*{{b2}} - {{c2}}*{{b1}}) / ({{a1}}*{{b2}} - {{a2}}*{{b1}})"
        )
        assert result == "(c1*b2 - c2*b1) / (a1*b2 - a2*b1)"

    def test_idempotent(self) -> None:
        """이미 플레이스홀더가 없는 수식은 그대로 반환한다."""
        expr = "(c - b) / a"
        assert _strip_placeholders(expr) == expr

    def test_empty_string(self) -> None:
        assert _strip_placeholders("") == ""

    def test_mixed(self) -> None:
        """{{var}}와 일반 텍스트가 혼합된 경우."""
        assert _strip_placeholders("x < ({{c}} + {{b}}) / {{a}}") == "x < (c + b) / a"


# ---------------------------------------------------------------------------
# compute_answer
# ---------------------------------------------------------------------------


class TestComputeAnswer:
    def test_with_placeholders(self) -> None:
        result = compute_answer("({{c}} - {{b}}) / {{a}}", {"a": 2, "b": 3, "c": 7})
        assert result.success is True
        assert result.value == "2"

    def test_without_placeholders(self) -> None:
        result = compute_answer("(c - b) / a", {"a": 2, "b": 3, "c": 7})
        assert result.success is True
        assert result.value == "2"

    def test_negative_result(self) -> None:
        result = compute_answer("-{{b}}/{{a}}", {"a": 3, "b": 5})
        assert result.success is True
        assert result.value == "-5/3"

    def test_quadratic_with_sqrt(self) -> None:
        """이차방정식 근의 공식 (판별식이 완전제곱수인 경우)."""
        result = compute_answer(
            "(-{{b}} + sqrt({{b}}^2 - 4*{{c}})) / 2",
            {"b": -3, "c": 2},
        )
        assert result.success is True
        # (-(-3) + sqrt(9 - 8)) / 2 = (3 + 1) / 2 = 2
        assert result.value == "2"

    def test_invalid_expression(self) -> None:
        result = compute_answer("invalid!!!", {"a": 1})
        assert result.success is False
        assert result.error is not None


# ---------------------------------------------------------------------------
# validate_constraints
# ---------------------------------------------------------------------------


class TestValidateConstraints:
    def test_integer_solution_with_placeholders(self) -> None:
        """정수 해 제약 조건 - {{var}} 포함 answer_template."""
        result = validate_constraints(
            {"integer_solution": True, "no_zero_denominator": True},
            {"a": 2, "b": 3, "c": 7},
            "({{c}} - {{b}}) / {{a}}",
        )
        # (7 - 3) / 2 = 2 (정수)
        assert result.passed is True

    def test_non_integer_fails_constraint(self) -> None:
        """정수 해 제약 위반."""
        result = validate_constraints(
            {"integer_solution": True},
            {"a": 3, "b": 1, "c": 5},
            "({{c}} - {{b}}) / {{a}}",
        )
        # (5 - 1) / 3 = 4/3 (비정수)
        assert result.passed is False

    def test_zero_denominator_fails_constraint(self) -> None:
        """분모가 0인 경우 제약 위반."""
        result = validate_constraints(
            {"no_zero_denominator": True},
            {"a": 0, "b": 1, "c": 5},
            "({{c}} - {{b}}) / {{a}}",
        )
        assert result.passed is False


# ---------------------------------------------------------------------------
# generate_variant (통합)
# ---------------------------------------------------------------------------


class TestGenerateVariant:
    def test_linear_equation_with_placeholders(self) -> None:
        """일차방정식 전체 흐름 - {{var}} answer_template."""
        result = generate_variant(
            body_template="{{a}}x + {{b}} = {{c}}",
            param_defs=[
                ParameterDef(name="a", type="integer", min=1, max=5, constraints=["nonzero"]),
                ParameterDef(name="b", type="integer", min=-5, max=5, constraints=[]),
                ParameterDef(name="c", type="integer", min=-10, max=10, constraints=[]),
            ],
            answer_template="({{c}} - {{b}}) / {{a}}",
            constraints={"integer_solution": True, "no_zero_denominator": True},
            seed=42,
        )
        assert result.success is True
        assert result.body_latex is not None
        assert result.answer_value is not None
        assert result.answer_latex is not None

    def test_without_placeholders_also_works(self) -> None:
        """플레이스홀더 없는 answer_template도 동일하게 작동."""
        result = generate_variant(
            body_template="{{a}}x + {{b}} = {{c}}",
            param_defs=[
                ParameterDef(name="a", type="integer", min=1, max=5, constraints=["nonzero"]),
                ParameterDef(name="b", type="integer", min=-5, max=5, constraints=[]),
                ParameterDef(name="c", type="integer", min=-10, max=10, constraints=[]),
            ],
            answer_template="(c - b) / a",
            constraints={"integer_solution": True},
            seed=42,
        )
        assert result.success is True
