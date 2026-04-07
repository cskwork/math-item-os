# Quickstart: Math Knowledge Graph + Item OS

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose
- Python 3.11+ (math-ai 서비스용)

## 1. Repository Setup

```bash
git clone <repo-url>
cd hwp-to-html
pnpm install
```

## 2. Infrastructure (Docker Compose)

```bash
# PostgreSQL 17, Redis 7, Meilisearch 1.12 시작
docker compose up -d
```

`docker-compose.yml` 구성:

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL 17 | 5432 | Primary DB (pgvector, ltree, pg_trgm) |
| Redis 7 | 6379 | Cache, session, rate limiting |
| Meilisearch 1.12 | 7700 | Full-text search (Korean CJK) |

## 3. Environment Variables

```bash
cp .env.example .env
```

필수 변수:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mathitem?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/mathitem"

# Redis
REDIS_URL="redis://localhost:6379"

# Meilisearch
MEILISEARCH_HOST="http://localhost:7700"
MEILISEARCH_MASTER_KEY="your-master-key"

# Auth
AUTH_SECRET="your-auth-secret"
AUTH_URL="http://localhost:3000"
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"

# Math AI Service
MATH_AI_SERVICE_URL="http://localhost:8000"

# Optional
LOG_LEVEL="debug"
NODE_ENV="development"
```

## 4. Database Setup

```bash
# Prisma 마이그레이션 실행
pnpm --filter db db:migrate

# Seed 데이터 (기본 스킬, 성취기준, 오개념 사전 목록)
pnpm --filter db db:seed
```

## 5. Math AI Service (Python)

```bash
cd services/math-ai
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## 6. Development Server

```bash
# 루트에서 전체 실행 (Turborepo)
pnpm dev
```

| Service | URL |
|---------|-----|
| Web App | http://localhost:3000 |
| tRPC Playground | http://localhost:3000/api/trpc |
| Math AI | http://localhost:8000/docs |
| Meilisearch Dashboard | http://localhost:7700 |

## 7. Testing

```bash
# Unit + Integration
pnpm test

# E2E (Playwright)
pnpm test:e2e

# Coverage
pnpm test:coverage
```

## 8. Seed Data

초기 시드 데이터 포함:

- **Skills**: 중학교 대수/방정식 스킬 트리 (~50 nodes)
- **Standards**: 2022 개정 교육과정 중2 수학 성취기준 (~30 entries)
- **Misconceptions**: 연구 기반 오개념 사전 목록 (~20 entries)
- **Sample Items**: 참조용 문항 fixture (~100 items)
- **Prerequisite Edges**: 스킬 간 선수학습 관계 (~80 edges)

## 9. Project Commands

```bash
pnpm dev          # 개발 서버 시작
pnpm build        # 프로덕션 빌드
pnpm test         # 테스트 실행
pnpm test:e2e     # E2E 테스트
pnpm lint         # ESLint
pnpm format       # Prettier
pnpm db:migrate   # DB 마이그레이션
pnpm db:seed      # 시드 데이터
pnpm db:studio    # Prisma Studio (DB GUI)
```
