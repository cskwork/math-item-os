"""문항 변이 생성 및 CAS 검증 요청/응답 모델."""

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# /generate 엔드포인트 모델
# ---------------------------------------------------------------------------


class ParameterDefModel(BaseModel):
    """매개변수 정의 - 이름, 타입, 범위, 제약 조건."""

    name: str = Field(..., description="매개변수 이름")
    type: str = Field(
        "integer",
        pattern="^(integer|float)$",
        description="매개변수 타입 (integer 또는 float)",
    )
    min: float = Field(..., description="최솟값")
    max: float = Field(..., description="최댓값")
    constraints: list[str] = Field(
        default_factory=list,
        description="매개변수 제약 조건 목록 (nonzero, positive, negative, odd, even)",
    )


class VariantModel(BaseModel):
    """생성된 변이 문항 단건 결과."""

    body_latex: str = Field(..., description="치환된 LaTeX 본문")
    params: dict = Field(..., description="사용된 매개변수 {이름: 값}")
    answer_value: str = Field(..., description="계산된 정답 값 (문자열)")
    answer_latex: str = Field(..., description="정답의 LaTeX 표현")
    seed: int = Field(..., description="재현용 시드 값")


class GenerateRequest(BaseModel):
    """문항 변이 생성 요청."""

    body_template: str = Field(
        ..., description="{{변수명}} 플레이스홀더가 포함된 LaTeX 템플릿"
    )
    parameters: list[ParameterDefModel] = Field(
        ..., description="매개변수 정의 목록"
    )
    answer_template: str = Field(
        ..., description="정답 계산 수식 (예: 'c/a + b')"
    )
    constraints: dict = Field(
        default_factory=dict,
        description="전체 제약 조건 (예: {integer_solution: true})",
    )
    count: int = Field(
        1, ge=1, le=50, description="생성할 변이 수 (1~50)"
    )
    seed: int | None = Field(
        None, description="재현 가능한 생성을 위한 시드 값"
    )


class GenerateResponse(BaseModel):
    """문항 변이 생성 응답."""

    success: bool = Field(..., description="생성 성공 여부")
    variants: list[VariantModel] | None = Field(
        None, description="생성된 변이 목록"
    )
    failed_count: int = Field(0, description="생성 실패 건수")
    error: str | None = Field(None, description="실패 시 오류 메시지")


# ---------------------------------------------------------------------------
# /verify 엔드포인트 모델
# ---------------------------------------------------------------------------


class VerifyRequest(BaseModel):
    """CAS 정답 검증 요청."""

    equation_latex: str = Field(..., description="검증할 방정식 LaTeX")
    answer_latex: str = Field(..., description="제출된 정답 LaTeX")
    check_equivalence: bool = Field(
        False, description="동치 여부도 함께 검증할지 여부"
    )


class CasVerification(BaseModel):
    """CAS 검증 상세 결과."""

    answer_correct: bool = Field(..., description="정답 여부")
    answer_equivalence: bool | None = Field(
        None, description="동치 여부 (check_equivalence=true 시)"
    )
    solution_uniqueness: bool | None = Field(
        None, description="해의 유일성 (check_equivalence=true 시)"
    )
    explanation: str | None = Field(None, description="검증 설명")


class VerifyResponse(BaseModel):
    """CAS 정답 검증 응답."""

    success: bool = Field(..., description="검증 수행 성공 여부")
    verification: CasVerification | None = Field(
        None, description="검증 결과 상세"
    )
    error: str | None = Field(None, description="실패 시 오류 메시지")
