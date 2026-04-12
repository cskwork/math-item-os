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

    def test_decimal_coefficient_brace_stripping(self) -> None:
        """소수 음수 계수 `{-1.5}`도 정규식 `-\\d+(?:\\.\\d+)?`로 정규화된다."""
        # x + (-1.5) = 0 → x = 1.5
        result = verify_answer("x + {-1.5} = 0", "1.5")
        assert result.success is True
        assert result.correct is True


class TestVerifyAnswerInequalities:
    """일차부등식 해집합 동치 비교 (`.as_set()` 기반)."""

    def test_strict_less_than_correct(self) -> None:
        """`3x - 8 < 15`에 해답 `x < 23/3`은 동치."""
        result = verify_answer("3x - 8 < 15", "x < 23/3")
        assert result.success is True
        assert result.correct is True

    def test_rearranged_inequality_equivalent(self) -> None:
        """`2x - 4 > 0` vs `x > 2` — 재배열된 동치가 set 비교로 인식된다."""
        result = verify_answer("2x - 4 > 0", "x > 2")
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

    def test_system_rejects_partial_answer(self) -> None:
        """다변수 연립방정식은 `x=값, y=값` 튜플 형태만 인정한다.

        과거에는 단일값 제출을 첫 변수로 암묵 해석했으나, 학생이 y 없이
        x만으로 정답 받는 footgun이라 명시적으로 거부하도록 변경됨.
        """
        eq = r"\begin{cases} 2x + y = 5 \\ x - y = 1 \end{cases}"
        result = verify_answer(eq, "2")
        assert result.success is True
        assert result.correct is False

    def test_system_non_x_variables(self) -> None:
        """변수 이름이 x, y가 아니어도(a, b 등) 알파벳 정렬로 처리된다."""
        eq = r"\begin{cases} a + b = 3 \\ a - b = 1 \end{cases}"
        # 해: a = 2, b = 1
        result = verify_answer(eq, "a=2, b=1")
        assert result.success is True
        assert result.correct is True

    def test_system_malformed_tuple_answer(self) -> None:
        """튜플 답에 값이 누락되면 거부된다."""
        eq = r"\begin{cases} x + y = 3 \\ x - y = 1 \end{cases}"
        result = verify_answer(eq, "x=, y=1")
        # 파싱 실패 또는 불일치 — 어느 쪽이든 정답은 아님
        assert not (result.success and result.correct)


class TestComputeSystemAnswer:
    """generator.compute_system_answer 직접 단위 테스트 (first_var 계약 고정)."""

    def test_xy_system_first_var_is_x(self) -> None:
        """x, y 시스템은 알파벳 순 첫 변수 x의 값이 `value`에 복제된다."""
        from app.services.generator import compute_system_answer
        result = compute_system_answer(
            r"\begin{cases} 2x + y = 5 \\ x - y = 1 \end{cases}"
        )
        assert result.success is True
        assert result.values == {"x": "2", "y": "1"}
        assert result.value == "2"

    def test_ab_system_first_var_is_a(self) -> None:
        """a, b 시스템은 알파벳 순 첫 변수 a의 값이 `value`에 복제된다.

        이 계약을 명시적으로 pin해서 비-`x` 명명 템플릿에서 `value`가
        조용히 잘못된 변수를 가리키는 회귀를 방지.
        """
        from app.services.generator import compute_system_answer
        result = compute_system_answer(
            r"\begin{cases} a + b = 3 \\ a - b = 1 \end{cases}"
        )
        assert result.success is True
        assert result.values == {"a": "2", "b": "1"}
        assert result.value == "2"

    def test_no_solution_system(self) -> None:
        """해가 없는 연립방정식은 success=False로 반환된다."""
        from app.services.generator import compute_system_answer
        result = compute_system_answer(
            r"\begin{cases} x + y = 1 \\ x + y = 2 \end{cases}"
        )
        assert result.success is False
        assert result.error is not None and "해가 없습니다" in result.error
