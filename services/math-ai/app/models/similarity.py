"""임베딩 생성 요청/응답 모델."""

from pydantic import BaseModel, Field


class EmbeddingRequest(BaseModel):
    """단일 텍스트 임베딩 요청."""

    text: str = Field(..., description="임베딩할 텍스트 (문항 body_latex + 선택적 맥락)")


class EmbeddingBatchRequest(BaseModel):
    """배치 텍스트 임베딩 요청."""

    texts: list[str] = Field(
        ..., description="임베딩할 텍스트 목록 (최대 100개)"
    )


class EmbeddingResponse(BaseModel):
    """단일 텍스트 임베딩 응답."""

    success: bool = Field(..., description="임베딩 생성 성공 여부")
    embedding: list[float] | None = Field(
        None, description="768차원 임베딩 벡터"
    )
    dimension: int = Field(768, description="임베딩 벡터 차원 수")
    error: str | None = Field(None, description="실패 시 오류 메시지")


class EmbeddingBatchResponse(BaseModel):
    """배치 텍스트 임베딩 응답."""

    success: bool = Field(..., description="임베딩 생성 성공 여부")
    embeddings: list[list[float]] | None = Field(
        None, description="768차원 임베딩 벡터 목록"
    )
    dimension: int = Field(768, description="임베딩 벡터 차원 수")
    error: str | None = Field(None, description="실패 시 오류 메시지")
