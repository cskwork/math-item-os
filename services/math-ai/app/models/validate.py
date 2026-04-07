"""LaTeX-to-SymPy 변환 요청/응답 모델."""

from pydantic import BaseModel, Field


class LatexToSympyRequest(BaseModel):
    """LaTeX 수식 변환 요청."""

    latex: str = Field(..., description="변환할 LaTeX 수식 문자열")


class LatexToSympyResponse(BaseModel):
    """LaTeX 수식 변환 응답."""

    success: bool = Field(..., description="변환 성공 여부")
    sympy_expr: str | None = Field(
        None, description="SymPy 표현식 문자열 (str(expr))"
    )
    latex_normalized: str | None = Field(
        None, description="정규화된 LaTeX 문자열 (sympy.latex(expr))"
    )
    error: str | None = Field(None, description="실패 시 오류 메시지")
