#!/usr/bin/env bash
set -euo pipefail

# ── 색상 ──────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step() { printf "${GREEN}[start]${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}[warn]${NC}  %s\n" "$1"; }
fail() { printf "${RED}[error]${NC} %s\n" "$1"; exit 1; }

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

# ── 0. 기존 프로세스 정리 ────────────────────────────
step "기존 포트 사용 프로세스 정리 (3000, 8000)"
for port in 3000 8000; do
  pids=$(lsof -ti:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill 2>/dev/null || true
    warn "포트 $port 프로세스 종료됨"
  fi
done
sleep 1

# ── 1. 사전 조건 확인 ────────────────────────────────
step "사전 조건 확인"
command -v docker  >/dev/null 2>&1 || fail "docker 가 설치되어 있지 않습니다"
command -v pnpm    >/dev/null 2>&1 || fail "pnpm 이 설치되어 있지 않습니다"
command -v python3 >/dev/null 2>&1 || fail "python3 이 설치되어 있지 않습니다"

# ── 2. Docker 인프라 기동 ─────────────────────────────
step "Docker 인프라 기동 (PostgreSQL, Redis, Meilisearch)"
docker compose up -d

step "PostgreSQL 준비 대기"
until docker exec mathitem-postgres pg_isready -U postgres -d mathitem >/dev/null 2>&1; do
  sleep 1
done
step "PostgreSQL 준비 완료"

# ── 3. Python 가상환경 (math-ai) ─────────────────────
VENV_DIR="$ROOT_DIR/services/math-ai/.venv"
if [ ! -d "$VENV_DIR" ]; then
  step "Python 가상환경 생성"
  python3 -m venv "$VENV_DIR"
fi

step "Python 의존성 설치"
"$VENV_DIR/bin/pip" install -q -r "$ROOT_DIR/services/math-ai/requirements.txt"

# ── 4. pnpm 의존성 설치 ──────────────────────────────
step "pnpm 의존성 설치"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# ── 5. DB 마이그레이션 (이미 적용된 상태면 즉시 통과) ──
step "DB 마이그레이션 적용 (deploy)"
if ! pnpm --filter @math-item-os/db exec dotenv -e ../../.env -- prisma migrate deploy 2>/dev/null; then
  warn "마이그레이션 실패 -- 기존 스키마로 계속 진행합니다"
fi

# ── 6. 개발 서버 기동 ────────────────────────────────
step "개발 서버 기동 (Next.js :3000 + math-ai :8000)"
pnpm dev
