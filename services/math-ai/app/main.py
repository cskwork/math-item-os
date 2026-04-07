"""Math AI 마이크로서비스 - SymPy 기반 수식 검증/변환/생성."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.validate import router as validate_router

app = FastAPI(
    title="Math AI Service",
    description="SymPy 기반 수학 수식 검증, 변환, 유사문항 생성 서비스",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(validate_router, prefix="/convert", tags=["convert"])


@app.get("/health")
async def health_check():
    """헬스 체크 엔드포인트."""
    return {"status": "ok", "service": "math-ai"}
