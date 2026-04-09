#!/usr/bin/env bash
set -euo pipefail

# ── 색상 ──────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
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
    echo "$pids" | xargs kill -9 2>/dev/null || true
    warn "포트 $port 프로세스 종료됨"
  fi
done
sleep 1

# ── 1. 사전 조건 확인 ────────────────────────────────
step "사전 조건 확인"
command -v docker  >/dev/null 2>&1 || fail "docker 가 설치되어 있지 않습니다"
command -v pnpm    >/dev/null 2>&1 || fail "pnpm 이 설치되어 있지 않습니다"
command -v python3 >/dev/null 2>&1 || fail "python3 이 설치되어 있지 않습니다"

# ── 2. .env 로드 + apps/web 심링크 ──────────────────
if [ ! -f "$ROOT_DIR/.env" ]; then
  fail ".env 파일이 없습니다. .env.example을 복사하세요: cp .env.example .env"
fi

# apps/web에서도 .env를 읽을 수 있도록 심링크
if [ ! -e "$ROOT_DIR/apps/web/.env" ]; then
  ln -sf "$ROOT_DIR/.env" "$ROOT_DIR/apps/web/.env"
  step ".env 심링크 생성 (apps/web/.env -> .env)"
fi

set -a
source "$ROOT_DIR/.env"
set +a
step ".env 환경변수 로드 완료"

# ── 3. Docker 인프라 기동 ─────────────────────────────
step "Docker 인프라 기동 (PostgreSQL, Redis, Meilisearch)"
docker compose up -d

step "PostgreSQL 준비 대기"
until docker exec mathitem-postgres pg_isready -U postgres -d mathitem >/dev/null 2>&1; do
  sleep 1
done
step "PostgreSQL 준비 완료"

# ── 4. Python 가상환경 (math-ai) ─────────────────────
VENV_DIR="$ROOT_DIR/services/math-ai/.venv"
if [ ! -d "$VENV_DIR" ]; then
  step "Python 가상환경 생성"
  python3 -m venv "$VENV_DIR"
fi

step "Python 의존성 설치"
"$VENV_DIR/bin/pip" install -q -r "$ROOT_DIR/services/math-ai/requirements.txt"

# ── 5. pnpm 의존성 설치 ──────────────────────────────
step "pnpm 의존성 설치"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# ── 6. DB 스키마 동기화 ──────────────────────────────
step "DB 스키마 동기화"
if ! pnpm --filter @math-item-os/db exec prisma db push --skip-generate --accept-data-loss 2>/dev/null; then
  warn "스키마 동기화 실패 -- 기존 스키마로 계속 진행합니다"
fi

# ── 6-1. Raw SQL 마이그레이션 (Prisma 스키마 외 pgvector 등) ──
PERF_SQL="$ROOT_DIR/packages/db/prisma/migrations/20260408_performance_optimization/migration.sql"
if [ -f "$PERF_SQL" ]; then
  step "Raw SQL 마이그레이션 실행 (pgvector 인덱스, embedding 컬럼)"
  if ! docker exec -i mathitem-postgres psql -U postgres -d mathitem < "$PERF_SQL" 2>/dev/null; then
    warn "Raw SQL 마이그레이션 실패 -- 기존 스키마로 계속 진행합니다"
  fi
fi

# ── 6-2. 기본 시드 데이터 확인 (조직/문항 없으면 자동 시딩) ──
ITEM_COUNT=$(docker exec mathitem-postgres psql -U postgres -d mathitem -tAc \
  "SELECT count(*) FROM items WHERE \"orgId\" = 'default-org'" 2>/dev/null || echo "0")
if [ "$ITEM_COUNT" -eq 0 ] 2>/dev/null; then
  step "시드 데이터 없음 -- 기본 시드 실행 (임베딩 제외)"
  pnpm --filter @math-item-os/db db:seed 2>&1 | tail -10
fi

# ── 6-3. 임베딩 시딩 (없으면 자동 생성) ────────────────
EMBED_COUNT=$(docker exec mathitem-postgres psql -U postgres -d mathitem -tAc \
  "SELECT count(*) FROM items WHERE embedding IS NOT NULL" 2>/dev/null || echo "0")
if [ "$EMBED_COUNT" -eq 0 ] 2>/dev/null; then
  step "임베딩 벡터 없음 -- math-ai 서비스 기동 후 시딩"

  # math-ai를 백그라운드로 기동 (로그 캡처)
  MATH_AI_LOG="/tmp/math-ai-startup.log"
  "$VENV_DIR/bin/uvicorn" app.main:app --port 8000 \
    --app-dir "$ROOT_DIR/services/math-ai" > "$MATH_AI_LOG" 2>&1 &
  MATH_AI_PID=$!

  # math-ai 준비 대기 (최대 60초)
  step "math-ai 서비스 준비 대기..."
  HEALTH_OK=false
  for i in $(seq 1 60); do
    if "$VENV_DIR/bin/python" -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" 2>/dev/null; then
      HEALTH_OK=true
      break
    fi
    sleep 1
  done

  if [ "$HEALTH_OK" = "false" ]; then
    warn "math-ai 서비스 기동 실패 -- 임베딩 생성 건너뜀"
    if [ -f "$MATH_AI_LOG" ]; then
      tail -10 "$MATH_AI_LOG" | while read -r line; do warn "  $line"; done
    fi
    kill "$MATH_AI_PID" 2>/dev/null || true
    wait "$MATH_AI_PID" 2>/dev/null || true
  else
    # 임베딩 모델 사전 로딩 (첫 실행 시 다운로드 포함, 최대 5분)
    step "임베딩 모델 사전 로딩 (첫 실행 시 다운로드 포함)..."
    if "$VENV_DIR/bin/python" -c "
import urllib.request, json
req = urllib.request.Request(
    'http://localhost:8000/similarity/embed',
    data=json.dumps({'text': 'warm up'}).encode(),
    headers={'Content-Type': 'application/json'}
)
urllib.request.urlopen(req, timeout=300)
" 2>/dev/null; then
      step "임베딩 시드 실행"
      MATH_AI_SERVICE_URL=http://localhost:8000 pnpm --filter @math-item-os/db db:seed 2>&1 | tail -5
    else
      warn "임베딩 모델 로딩 실패 -- 임베딩 생성 건너뜀"
      if [ -f "$MATH_AI_LOG" ]; then
        tail -10 "$MATH_AI_LOG" | while read -r line; do warn "  $line"; done
      fi
    fi

    # 백그라운드 math-ai 종료 (pnpm dev에서 다시 기동)
    kill "$MATH_AI_PID" 2>/dev/null || true
    wait "$MATH_AI_PID" 2>/dev/null || true
    sleep 1
  fi
else
  step "임베딩 벡터 존재 (${EMBED_COUNT}개) -- 시딩 건너뜀"
fi

# ── 7. 개발 서버 기동 ────────────────────────────────
printf "\n${CYAN}========================================${NC}\n"
printf "${CYAN}  Math Item OS - 개발 서버 시작${NC}\n"
printf "${CYAN}  Web:     http://localhost:3000${NC}\n"
printf "${CYAN}  Math AI: http://localhost:8000${NC}\n"
printf "${CYAN}  로그인:  dev@mathitem.local / dev1234${NC}\n"
printf "${CYAN}========================================${NC}\n\n"

pnpm dev
