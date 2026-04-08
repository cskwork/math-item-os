"""임베딩 생성 엔드포인트 - sentence-transformers 기반."""

from __future__ import annotations

import logging
import threading
from typing import TYPE_CHECKING

from fastapi import APIRouter

from app.models.similarity import (
    EmbeddingBatchRequest,
    EmbeddingBatchResponse,
    EmbeddingRequest,
    EmbeddingResponse,
)

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

router = APIRouter()

_EMBEDDING_MODEL_NAME = "paraphrase-multilingual-mpnet-base-v2"
_EMBEDDING_DIMENSION = 768
_MAX_BATCH_SIZE = 100

# --- 싱글턴 모델 인스턴스 (lazy + thread-safe) ---
_model: SentenceTransformer | None = None
_model_lock = threading.Lock()


def _get_model() -> SentenceTransformer:
    """sentence-transformers 모델을 lazy-load 한다.

    첫 호출 시에만 모델을 로드하며, threading.Lock 으로 동시 로드를 방지한다.
    """
    global _model  # noqa: PLW0603
    if _model is not None:
        return _model

    with _model_lock:
        # double-checked locking
        if _model is not None:
            return _model

        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer(_EMBEDDING_MODEL_NAME)
        logger.info(
            "sentence-transformers 모델 로드 완료: %s", _EMBEDDING_MODEL_NAME
        )
        return _model


def _encode_texts(texts: list[str]) -> list[list[float]]:
    """텍스트 목록을 임베딩 벡터로 변환한다.

    Returns:
        각 텍스트에 대한 768차원 float 리스트의 목록.
    """
    model = _get_model()
    embeddings = model.encode(texts, normalize_embeddings=True)
    return [vec.tolist() for vec in embeddings]


@router.post(
    "/embed",
    response_model=EmbeddingResponse,
    summary="단일 텍스트 임베딩 생성",
)
async def create_embedding(body: EmbeddingRequest) -> EmbeddingResponse:
    """단일 텍스트에 대한 768차원 임베딩 벡터를 생성한다.

    - 빈 문자열: 즉시 실패 응답
    - 모델 로드 실패 또는 인코딩 실패: success=false + error 메시지
    """
    text = body.text.strip()

    if not text:
        return EmbeddingResponse(
            success=False,
            embedding=None,
            dimension=_EMBEDDING_DIMENSION,
            error="빈 텍스트입니다.",
        )

    try:
        embeddings = _encode_texts([text])
        return EmbeddingResponse(
            success=True,
            embedding=embeddings[0],
            dimension=_EMBEDDING_DIMENSION,
            error=None,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("임베딩 생성 실패")
        return EmbeddingResponse(
            success=False,
            embedding=None,
            dimension=_EMBEDDING_DIMENSION,
            error=f"임베딩 생성 실패: {exc}",
        )


@router.post(
    "/embed-batch",
    response_model=EmbeddingBatchResponse,
    summary="배치 텍스트 임베딩 생성",
)
async def create_embedding_batch(
    body: EmbeddingBatchRequest,
) -> EmbeddingBatchResponse:
    """여러 텍스트에 대한 768차원 임베딩 벡터를 일괄 생성한다.

    - 빈 목록: 즉시 실패 응답
    - 100개 초과: 즉시 실패 응답
    - 모델 로드 실패 또는 인코딩 실패: success=false + error 메시지
    """
    if not body.texts:
        return EmbeddingBatchResponse(
            success=False,
            embeddings=None,
            dimension=_EMBEDDING_DIMENSION,
            error="텍스트 목록이 비어 있습니다.",
        )

    if len(body.texts) > _MAX_BATCH_SIZE:
        return EmbeddingBatchResponse(
            success=False,
            embeddings=None,
            dimension=_EMBEDDING_DIMENSION,
            error=f"최대 {_MAX_BATCH_SIZE}개까지 요청할 수 있습니다. (요청: {len(body.texts)}개)",
        )

    # 빈 문자열이 포함되어 있는지 확인
    stripped_texts = [t.strip() for t in body.texts]
    empty_indices = [i for i, t in enumerate(stripped_texts) if not t]
    if empty_indices:
        return EmbeddingBatchResponse(
            success=False,
            embeddings=None,
            dimension=_EMBEDDING_DIMENSION,
            error=f"빈 텍스트가 포함되어 있습니다. (인덱스: {empty_indices})",
        )

    try:
        embeddings = _encode_texts(stripped_texts)
        return EmbeddingBatchResponse(
            success=True,
            embeddings=embeddings,
            dimension=_EMBEDDING_DIMENSION,
            error=None,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("배치 임베딩 생성 실패")
        return EmbeddingBatchResponse(
            success=False,
            embeddings=None,
            dimension=_EMBEDDING_DIMENSION,
            error=f"배치 임베딩 생성 실패: {exc}",
        )
