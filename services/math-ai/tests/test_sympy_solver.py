"""sympy_solver 공개 API 단위 테스트.

특히 `verify_answer`의 연립방정식 분기 회귀 방지에 집중한다.
"""

from __future__ import annotations

from app.services.sympy_solver import verify_answer


class TestVerifyAnswerSingleEquation:
    """단일 변수 방정식 회귀 방지."""

    def test_linear_equation_correct_answer(self) -> None:
        result = verify_answer("2x + 3 = 7", "2")
        assert result.success is True
        assert result.correct is True

    def test_linear_equation_incorrect_answer(self) -> None:
        result = verify_answer("2x + 3 = 7", "5")
        assert result.success is True
        assert result.correct is False

    def test_brace_wrapped_negative_constant(self) -> None:
        """렌더링 전용 중괄호 정규화가 단일 방정식에서도 동작한다."""
        # 원래 2x + -3 = 7 인데 음수는 {-3}로 감싸진 형태
        result = verify_answer("2x + {-3} = 7", "5")
        assert result.success is True
        assert result.correct is True


class TestVerifyAnswerInequalities:
    """일차부등식 해집합 동치 비교."""

    def test_strict_less_than_correct(self) -> None:
        """`3x - 8 < 15`에 해답 `x < 23/3`은 동치."""
        result = verify_answer("3x - 8 < 15", "x < 23/3")
        assert result.success is True
        assert result.correct is True

    def test_strict_less_than_wrong_bound(self) -> None:
        """경계가 다른 오답."""
        result = verify_answer("3x - 8 < 15", "x < 8")
        assert result.success is True
        assert result.correct is False

    def test_wrong_direction(self) -> None:
        """부등호 방향이 반대인 오답."""
        result = verify_answer("2x + 1 > 5", "x < 2")
        assert result.success is True
        assert result.correct is False


class TestVerifyAnswerSystemOfEquations:
    """2원1차 연립방정식 CAS 검증 분기."""

    def test_positive_coefficients_correct_tuple(self) -> None:
        """양수 계수 연립방정식, 튜플 정답."""
        eq = r"\begin{cases} 2x + y = 5 \\ x - y = 1 \end{cases}"
        # 해: x = 2, y = 1
        result = verify_answer(eq, "x=2, y=1")
        assert result.success is True
        assert result.correct is True

    def test_brace_wrapped_negatives_user_case(self) -> None:
        """사용자 실제 실패 케이스 - 음수 계수 + 중괄호 래핑.

        {-1}x + {-1}y = {-8}  →  -x - y = -8  →  x + y = 8
        5x + 6y = 6
        연립 해: x = 42, y = -34
        """
        eq = (
            r"\begin{cases} {-1}x + {-1}y = {-8} \\ "
            r"5x + 6y = 6 \end{cases}"
        )
        result = verify_answer(eq, "x=42, y=-34")
        assert result.success is True, f"검증 실패: {result.error}"
        assert result.correct is True

    def test_system_no_solution(self) -> None:
        """해가 존재하지 않는 연립방정식 (평행한 두 직선)."""
        eq = r"\begin{cases} x + y = 1 \\ x + y = 2 \end{cases}"
        result = verify_answer(eq, "x=0, y=1")
        assert result.success is True
        assert result.correct is False

    def test_system_backward_compat_single_value(self) -> None:
        """backward compat: 튜플 없이 단일값만 제출 시 첫 변수로 해석."""
        eq = r"\begin{cases} 2x + y = 5 \\ x - y = 1 \end{cases}"
        # x만 제출: x=2 (첫 변수, 알파벳 순)
        result = verify_answer(eq, "2")
        assert result.success is True
        assert result.correct is True
