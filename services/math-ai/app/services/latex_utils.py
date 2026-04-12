"""LaTeX 전처리 공유 유틸리티.

SymPy ANTLR 파서(`parse_latex`)와 자체 템플릿 포매터 사이의 불일치를 완충한다.
`generator._format_value_for_latex`가 음수 계수를 `{-N}` 형태로 감싸
KaTeX 렌더링에서 부호를 안전하게 표시하지만, 이 형태는 ANTLR 파서가
직접 이해하지 못하므로 검증/풀이 경로에서는 평문 형태로 복원해야 한다.

`sympy_solver.py`와 `generator.py`가 모두 이 모듈을 사용해
두 파일의 전처리 규칙이 조용히 어긋나지 않도록 한다.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sympy import Basic, Symbol

# `{-N}` 또는 `{-N.NN}` 형태만 매치한다.
# 일반 LaTeX 그룹핑(`{x^2}`, `\frac{1}{2}` 등)은 건드리지 않는다.
_BRACE_NEGATIVE_PATTERN = re.compile(r"\{(-\d+(?:\.\d+)?)\}")

# `\begin{cases}...\end{cases}` 환경의 본문을 캡처한다.
_CASES_PATTERN = re.compile(
    r"\\begin\{cases\}(.+?)\\end\{cases\}",
    re.DOTALL,
)


def strip_render_braces(latex: str) -> str:
    """렌더링 전용 중괄호 래핑(`{-3}`, `{-1.5}`)을 `-3`, `-1.5`로 정규화."""
    return _BRACE_NEGATIVE_PATTERN.sub(r"\1", latex)


def parse_cases_body(
    latex: str,
) -> tuple[list["Basic"], list["Symbol"]] | None:
    """`\\begin{cases}...\\end{cases}` 본문을 (방정식 목록, 자유변수) 로 분해.

    입력 LaTeX는 이미 `strip_render_braces`로 정규화된 상태여야 한다.
    cases 환경이 없으면 `None`을 반환한다.

    Args:
        latex: brace-stripped LaTeX 문자열

    Returns:
        `(eqs, free_vars)` 튜플. `eqs`는 `parse_latex`로 파싱된 SymPy 표현식,
        `free_vars`는 등장하는 자유 심볼의 **알파벳 정렬** 리스트.
        cases 환경 미감지 시 `None`.
    """
    from sympy.parsing.latex import parse_latex

    match = _CASES_PATTERN.search(latex)
    if match is None:
        return None

    body = match.group(1)
    eq_strs = [s.strip() for s in re.split(r"\\\\", body) if s.strip()]
    eqs = [parse_latex(s) for s in eq_strs]
    free_vars = sorted(
        {s for e in eqs for s in e.free_symbols},
        key=str,
    )
    return eqs, free_vars
