# MVP 기술 아키텍처 문서: 수학 지식 그래프 + Item OS

> **버전**: 1.0.0 | **작성일**: 2026-04-07 | **Phase**: 1 (MVP, 3-4개월)
> **대상**: 중학교 수학 (대수/방정식) — 교사 대상 플랫폼, 80,000+ 문항

---

## 목차

1. [디렉터리 구조](#1-디렉터리-구조)
2. [패키지 선정](#2-패키지-선정)
3. [환경 설정](#3-환경-설정)
4. [API 설계](#4-api-설계)
5. [데이터 흐름 다이어그램](#5-데이터-흐름-다이어그램)
6. [인증 및 권한](#6-인증-및-권한)
7. [검색 아키텍처](#7-검색-아키텍처)
8. [LaTeX 파이프라인](#8-latex-파이프라인)
9. [일괄 업로드 파이프라인](#9-일괄-업로드-파이프라인)
10. [배포 아키텍처](#10-배포-아키텍처)
11. [테스트 전략](#11-테스트-전략)
12. [모니터링 및 로깅](#12-모니터링-및-로깅)
13. [Phase 1 -> Phase 2 마이그레이션 경로](#13-phase-1---phase-2-마이그레이션-경로)

---

## 1. 디렉터리 구조

```
math-item-os/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                      # PR별 린트/타입체크/테스트/빌드
│   │   ├── e2e.yml                     # E2E 테스트 (Playwright)
│   │   └── deploy.yml                  # Vercel 배포 트리거
│   └── CODEOWNERS                      # 코드 소유자 정의
│
├── packages/
│   ├── db/                             # Prisma 스키마 및 마이그레이션 패키지
│   │   ├── prisma/
│   │   │   ├── schema.prisma           # 메인 Prisma 스키마
│   │   │   ├── migrations/             # 마이그레이션 히스토리
│   │   │   └── seed.ts                 # 시드 데이터 (표준, 교육과정, 기본 스킬)
│   │   ├── src/
│   │   │   ├── client.ts               # PrismaClient 싱글턴 export
│   │   │   ├── types.ts                # Prisma에서 파생된 공유 타입
│   │   │   └── index.ts                # 패키지 진입점
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── shared/                         # 프론트/백엔드 공유 유틸리티
│   │   ├── src/
│   │   │   ├── constants/
│   │   │   │   ├── roles.ts            # RBAC 역할 상수 정의
│   │   │   │   ├── item-status.ts      # 문항 상태 열거형
│   │   │   │   └── error-codes.ts      # 에러 코드 체계
│   │   │   ├── validators/
│   │   │   │   ├── item.validator.ts   # Zod 문항 유효성 검증 스키마
│   │   │   │   ├── search.validator.ts # 검색 쿼리 유효성 검증
│   │   │   │   └── upload.validator.ts # 업로드 입력 유효성 검증
│   │   │   ├── types/
│   │   │   │   ├── item.types.ts       # 문항 도메인 타입
│   │   │   │   ├── search.types.ts     # 검색 관련 타입
│   │   │   │   ├── auth.types.ts       # 인증/권한 타입
│   │   │   │   └── api.types.ts        # API 응답 공통 envelope 타입
│   │   │   ├── utils/
│   │   │   │   ├── latex.utils.ts      # LaTeX 정규화/정리 유틸리티
│   │   │   │   ├── pagination.utils.ts # 페이지네이션 헬퍼
│   │   │   │   └── id.utils.ts         # CUID2 ID 생성 유틸리티
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── math-parser/                    # LaTeX/수식 파싱 전용 패키지
│       ├── src/
│       │   ├── katex-renderer.ts       # KaTeX 서버사이드 렌더링
│       │   ├── mathml-converter.ts     # LaTeX -> MathML 변환
│       │   ├── latex-normalizer.ts     # LaTeX 정규화 (동치식 통일)
│       │   ├── latex-validator.ts      # LaTeX 구문 유효성 검증
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── apps/
│   └── web/                            # Next.js 15 메인 웹 애플리케이션
│       ├── src/
│       │   ├── app/                    # App Router (Next.js 15)
│       │   │   ├── layout.tsx          # 루트 레이아웃 (KaTeX CSS, 폰트)
│       │   │   ├── page.tsx            # 랜딩/대시보드
│       │   │   ├── (auth)/
│       │   │   │   ├── login/
│       │   │   │   │   └── page.tsx    # 로그인 페이지
│       │   │   │   └── register/
│       │   │   │       └── page.tsx    # 교사 등록 페이지
│       │   │   ├── (dashboard)/
│       │   │   │   ├── layout.tsx      # 대시보드 레이아웃 (사이드바)
│       │   │   │   ├── items/
│       │   │   │   │   ├── page.tsx          # 문항 목록/검색
│       │   │   │   │   ├── [id]/
│       │   │   │   │   │   ├── page.tsx      # 문항 상세 보기
│       │   │   │   │   │   └── edit/
│       │   │   │   │   │       └── page.tsx  # 문항 편집
│       │   │   │   │   ├── new/
│       │   │   │   │   │   └── page.tsx      # 새 문항 생성
│       │   │   │   │   └── upload/
│       │   │   │   │       └── page.tsx      # 일괄 업로드
│       │   │   │   ├── skills/
│       │   │   │   │   ├── page.tsx          # 스킬 트리 보기
│       │   │   │   │   └── [id]/
│       │   │   │   │       └── page.tsx      # 스킬 상세
│       │   │   │   ├── standards/
│       │   │   │   │   └── page.tsx          # 교육과정 표준 탐색
│       │   │   │   ├── review/
│       │   │   │   │   └── page.tsx          # 문항 검수 큐
│       │   │   │   └── settings/
│       │   │   │       └── page.tsx          # 사용자/조직 설정
│       │   │   └── api/
│       │   │       ├── trpc/
│       │   │       │   └── [trpc]/
│       │   │       │       └── route.ts      # tRPC HTTP 핸들러
│       │   │       ├── auth/
│       │   │       │   └── [...nextauth]/
│       │   │       │       └── route.ts      # Auth.js 라우트 핸들러
│       │   │       ├── upload/
│       │   │       │   └── route.ts          # 파일 업로드 엔드포인트 (멀티파트)
│       │   │       └── webhooks/
│       │   │           └── meilisearch/
│       │   │               └── route.ts      # Meilisearch 동기화 웹훅
│       │   │
│       │   ├── server/                       # 서버 전용 코드
│       │   │   ├── trpc/
│       │   │   │   ├── root.ts               # 루트 라우터 통합
│       │   │   │   ├── trpc.ts               # tRPC 초기화, 컨텍스트, 미들웨어
│       │   │   │   └── routers/
│       │   │   │       ├── item.router.ts     # 문항 CRUD 라우터
│       │   │   │       ├── search.router.ts   # 검색 라우터
│       │   │   │       ├── skill.router.ts    # 스킬/선수학습 라우터
│       │   │   │       ├── standard.router.ts # 교육과정 표준 라우터
│       │   │   │       ├── upload.router.ts   # 일괄 업로드 라우터
│       │   │   │       ├── review.router.ts   # 검수 큐 라우터
│       │   │   │       ├── auth.router.ts     # 인증 관련 라우터
│       │   │   │       └── admin.router.ts    # 관리자 전용 라우터
│       │   │   ├── services/
│       │   │   │   ├── item.service.ts        # 문항 비즈니스 로직
│       │   │   │   ├── search.service.ts      # Meilisearch 연동 서비스
│       │   │   │   ├── upload.service.ts      # 업로드 파싱/처리 서비스
│       │   │   │   ├── skill.service.ts       # 스킬 그래프 서비스
│       │   │   │   ├── version.service.ts     # 문항 버전 관리 서비스
│       │   │   │   ├── review.service.ts      # 검수 워크플로우 서비스
│       │   │   │   └── sync.service.ts        # DB-Meilisearch 동기화 서비스
│       │   │   ├── parsers/
│       │   │   │   ├── csv.parser.ts          # CSV 파일 파싱
│       │   │   │   ├── json.parser.ts         # JSON 일괄 파싱
│       │   │   │   ├── qti.parser.ts          # QTI XML 파싱
│       │   │   │   └── hwp.parser.ts          # HWP 파일 파싱 (hwpjs 래퍼)
│       │   │   ├── middleware/
│       │   │   │   ├── auth.middleware.ts      # 인증 검증 미들웨어
│       │   │   │   ├── rbac.middleware.ts      # 역할 기반 접근 제어
│       │   │   │   ├── rate-limit.middleware.ts # 요청 속도 제한
│       │   │   │   ├── audit.middleware.ts     # 감사 로깅 미들웨어
│       │   │   │   └── org-isolation.middleware.ts # 조직 데이터 격리
│       │   │   └── lib/
│       │   │       ├── meilisearch.ts         # Meilisearch 클라이언트 설정
│       │   │       ├── redis.ts               # Redis 클라이언트 설정
│       │   │       ├── auth.ts                # Auth.js v5 설정
│       │   │       ├── feature-flags.ts       # 피처 플래그 유틸리티
│       │   │       └── logger.ts              # 구조화 로거 (pino)
│       │   │
│       │   ├── components/                    # React 컴포넌트
│       │   │   ├── ui/                        # shadcn/ui 기반 컴포넌트
│       │   │   │   ├── button.tsx
│       │   │   │   ├── dialog.tsx
│       │   │   │   ├── data-table.tsx         # TanStack Table 래퍼
│       │   │   │   ├── command.tsx            # 커맨드 팔레트
│       │   │   │   └── ...                    # shadcn/ui 컴포넌트들
│       │   │   ├── math/
│       │   │   │   ├── katex-display.tsx      # KaTeX 렌더링 컴포넌트
│       │   │   │   ├── math-editor.tsx        # LaTeX 입력 에디터
│       │   │   │   ├── math-preview.tsx       # 실시간 수식 미리보기
│       │   │   │   └── mathml-fallback.tsx    # MathML 폴백 컴포넌트
│       │   │   ├── items/
│       │   │   │   ├── item-card.tsx          # 문항 카드 컴포넌트
│       │   │   │   ├── item-form.tsx          # 문항 생성/편집 폼
│       │   │   │   ├── item-detail.tsx        # 문항 상세 보기
│       │   │   │   ├── item-version-diff.tsx  # 문항 버전 비교
│       │   │   │   └── item-list.tsx          # 문항 목록 테이블
│       │   │   ├── search/
│       │   │   │   ├── search-bar.tsx         # 검색 입력 컴포넌트
│       │   │   │   ├── search-filters.tsx     # 필터 패널
│       │   │   │   └── search-results.tsx     # 검색 결과 컴포넌트
│       │   │   ├── upload/
│       │   │   │   ├── upload-dropzone.tsx    # 파일 드래그앤드롭
│       │   │   │   ├── upload-progress.tsx    # 업로드 진행 상태
│       │   │   │   └── upload-preview.tsx     # 업로드 결과 미리보기
│       │   │   └── layout/
│       │   │       ├── sidebar.tsx            # 사이드바 내비게이션
│       │   │       ├── header.tsx             # 상단 헤더
│       │   │       └── breadcrumb.tsx         # 브레드크럼 내비게이션
│       │   │
│       │   ├── hooks/
│       │   │   ├── use-debounced-search.ts    # 디바운스 검색 훅
│       │   │   ├── use-math-editor.ts         # 수식 에디터 상태 훅
│       │   │   └── use-upload.ts              # 업로드 상태 관리 훅
│       │   │
│       │   ├── lib/
│       │   │   ├── trpc.ts                    # tRPC 클라이언트 설정
│       │   │   └── utils.ts                   # 클라이언트 유틸리티
│       │   │
│       │   └── styles/
│       │       └── globals.css                # Tailwind + KaTeX 스타일
│       │
│       ├── public/
│       │   └── fonts/                         # KaTeX 수학 폰트
│       ├── next.config.ts                     # Next.js 설정
│       ├── tailwind.config.ts                 # Tailwind 설정
│       ├── package.json
│       └── tsconfig.json
│
├── services/
│   └── math-ai/                              # Python AI/수학 마이크로서비스
│       ├── app/
│       │   ├── main.py                       # FastAPI 진입점
│       │   ├── routers/
│       │   │   ├── validation.py             # 수식 검증 엔드포인트
│       │   │   └── similarity.py             # 유사도 계산 엔드포인트
│       │   ├── services/
│       │   │   ├── sympy_solver.py           # SymPy 수식 검증
│       │   │   └── embedding.py              # 문항 임베딩 생성
│       │   └── models/
│       │       └── schemas.py                # Pydantic 스키마
│       ├── tests/
│       ├── requirements.txt
│       ├── pyproject.toml
│       └── Dockerfile
│
├── tests/                                    # 통합/E2E 테스트 루트
│   ├── integration/
│   │   ├── item.test.ts                      # 문항 CRUD 통합 테스트
│   │   ├── search.test.ts                    # 검색 통합 테스트
│   │   └── upload.test.ts                    # 업로드 통합 테스트
│   ├── e2e/
│   │   ├── item-workflow.spec.ts             # 문항 생성-편집-검색 E2E
│   │   ├── upload.spec.ts                    # 일괄 업로드 E2E
│   │   └── auth.spec.ts                      # 인증 흐름 E2E
│   ├── fixtures/
│   │   ├── items.fixture.ts                  # 문항 테스트 데이터
│   │   ├── sample.csv                        # CSV 업로드 샘플
│   │   ├── sample.qti.xml                    # QTI 업로드 샘플
│   │   └── sample.hwp                        # HWP 업로드 샘플
│   └── helpers/
│       ├── db.helper.ts                      # 테스트 DB 초기화/정리
│       └── auth.helper.ts                    # 테스트 인증 헬퍼
│
├── docs/
│   ├── architecture.md                       # 이 문서
│   └── changelog/                            # 변경 로그
│
├── scripts/
│   ├── seed-standards.ts                     # 교육과정 표준 시드 스크립트
│   ├── sync-meilisearch.ts                   # Meilisearch 전체 동기화
│   └── migrate-items.ts                      # 기존 데이터 마이그레이션
│
├── turbo.json                                # Turborepo 파이프라인 설정
├── package.json                              # 루트 워크스페이스 설정
├── pnpm-workspace.yaml                       # pnpm 워크스페이스 정의
├── .env.example                              # 환경 변수 템플릿
├── .eslintrc.cjs                             # ESLint 루트 설정
├── .prettierrc                               # Prettier 설정
├── docker-compose.yml                        # 로컬 개발 인프라 (PG, Redis, Meilisearch)
└── tsconfig.base.json                        # 공유 TypeScript 설정
```

---

## 2. 패키지 선정

### 2.1 프론트엔드 (apps/web)

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `next` | `15.2.x` | App Router, RSC, 서버 액션 |
| `react` / `react-dom` | `19.x` | UI 렌더링 |
| `@trpc/client` | `11.x` | tRPC 클라이언트 |
| `@trpc/react-query` | `11.x` | React Query 통합 tRPC |
| `@tanstack/react-query` | `5.x` | 서버 상태 관리 |
| `@tanstack/react-table` | `8.x` | 문항 목록 테이블 |
| `katex` | `0.16.x` | LaTeX -> HTML 렌더링 |
| `tailwindcss` | `4.x` | 유틸리티 CSS |
| `@shadcn/ui` | `latest` | 디자인 시스템 컴포넌트 |
| `@radix-ui/react-*` | `latest` | Headless UI 프리미티브 (shadcn 의존성) |
| `lucide-react` | `latest` | 아이콘 |
| `react-dropzone` | `14.x` | 파일 업로드 드래그앤드롭 |
| `cmdk` | `1.x` | 커맨드 팔레트 (문항 빠른 검색) |
| `nuqs` | `2.x` | URL 기반 상태 관리 (검색 파라미터) |
| `sonner` | `1.x` | 토스트 알림 |
| `zustand` | `5.x` | 클라이언트 상태 관리 (에디터 상태) |

### 2.2 백엔드 (apps/web/server)

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `@trpc/server` | `11.x` | tRPC 서버 |
| `zod` | `3.23.x` | 런타임 유효성 검증 + tRPC 입력 타입 |
| `next-auth` (Auth.js v5) | `5.x` | 인증 (OAuth, Credentials) |
| `@auth/prisma-adapter` | `2.x` | Auth.js Prisma 어댑터 |
| `meilisearch` | `0.44.x` | Meilisearch JS 클라이언트 |
| `ioredis` | `5.x` | Redis 클라이언트 |
| `pino` | `9.x` | 구조화 로깅 |
| `pino-pretty` | `11.x` | 개발 환경 로그 포매팅 |
| `bullmq` | `5.x` | 비동기 작업 큐 (업로드 처리) |
| `@paralleldrive/cuid2` | `2.x` | 충돌 없는 고유 ID 생성 |
| `csv-parse` | `5.x` | CSV 스트리밍 파서 |
| `fast-xml-parser` | `4.x` | QTI XML 파싱 |
| `hwpjs` | `latest` | HWP 파일 파싱 (Rust 코어, MIT) |
| `superjson` | `2.x` | tRPC 직렬화 (Date, BigInt 지원) |
| `@sentry/nextjs` | `8.x` | 에러 추적 |

### 2.3 ORM/DB (packages/db)

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `prisma` | `6.x` | ORM, 마이그레이션, 스키마 관리 |
| `@prisma/client` | `6.x` | 타입 안전 DB 쿼리 |
| `pg` | `8.x` | PostgreSQL 드라이버 (Prisma 하위) |
| `pgvector` | (PostgreSQL 확장) | 벡터 유사도 검색 |
| `ltree` | (PostgreSQL 확장) | 계층 구조 (스킬 트리) |

### 2.4 Python AI 서비스 (services/math-ai)

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `fastapi` | `0.115.x` | REST API 프레임워크 |
| `uvicorn` | `0.34.x` | ASGI 서버 |
| `sympy` | `1.13.x` | 수학 수식 검증/풀이 |
| `pydantic` | `2.x` | 데이터 유효성 검증 |
| `httpx` | `0.28.x` | 비동기 HTTP 클라이언트 |

### 2.5 개발/빌드 도구

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `turbo` | `2.x` | 모노레포 빌드 시스템 |
| `pnpm` | `9.x` | 패키지 매니저 |
| `typescript` | `5.7.x` | 타입 검사 |
| `vitest` | `2.x` | 단위/통합 테스트 |
| `@playwright/test` | `1.49.x` | E2E 테스트 |
| `eslint` | `9.x` | 린팅 |
| `prettier` | `3.x` | 코드 포매팅 |
| `@testing-library/react` | `16.x` | React 컴포넌트 테스트 |
| `msw` | `2.x` | API 목킹 (테스트용) |

---

## 3. 환경 설정

### `.env.example`

```bash
# ──────────────────────────────────────────────
# 데이터베이스 (PostgreSQL 17 + Supabase)
# ──────────────────────────────────────────────
DATABASE_URL="postgresql://postgres:password@localhost:5432/math_item_os?schema=public"
DIRECT_URL="postgresql://postgres:password@localhost:5432/math_item_os?schema=public"
# Supabase 사용 시: pooling URL -> DATABASE_URL, direct URL -> DIRECT_URL

# ──────────────────────────────────────────────
# Redis 7.x
# ──────────────────────────────────────────────
REDIS_URL="redis://localhost:6379"

# ──────────────────────────────────────────────
# Meilisearch
# ──────────────────────────────────────────────
MEILISEARCH_HOST="http://localhost:7700"
MEILISEARCH_MASTER_KEY="dev-master-key-change-in-prod"

# ──────────────────────────────────────────────
# Auth.js v5
# ──────────────────────────────────────────────
AUTH_SECRET="openssl-rand-base64-32-result"
AUTH_URL="http://localhost:3000"

# OAuth 제공자 (Google 우선, 네이버/카카오 추후)
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""

# ──────────────────────────────────────────────
# Python AI 서비스
# ──────────────────────────────────────────────
MATH_AI_SERVICE_URL="http://localhost:8000"

# ──────────────────────────────────────────────
# Anthropic Claude API (Phase 2+)
# ──────────────────────────────────────────────
ANTHROPIC_API_KEY=""

# ──────────────────────────────────────────────
# Sentry 에러 추적
# ──────────────────────────────────────────────
SENTRY_DSN=""
SENTRY_AUTH_TOKEN=""

# ──────────────────────────────────────────────
# 피처 플래그
# ──────────────────────────────────────────────
FEATURE_HWP_UPLOAD="true"
FEATURE_AI_SIMILARITY="false"
FEATURE_ITEM_GENERATION="false"

# ──────────────────────────────────────────────
# 앱 설정
# ──────────────────────────────────────────────
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
LOG_LEVEL="debug"
UPLOAD_MAX_FILE_SIZE_MB="100"
UPLOAD_MAX_BATCH_SIZE="10000"
```

### `docker-compose.yml` (로컬 개발 인프라)

```yaml
# 로컬 개발용 인프라 서비스
version: "3.9"
services:
  postgres:
    image: pgvector/pgvector:pg17
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: math_item_os
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./scripts/init-extensions.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  meilisearch:
    image: getmeili/meilisearch:v1.12
    ports:
      - "7700:7700"
    environment:
      MEILI_MASTER_KEY: "dev-master-key-change-in-prod"
      MEILI_ENV: "development"
    volumes:
      - msdata:/meili_data

volumes:
  pgdata:
  msdata:
```

---

## 4. API 설계

### 4.1 tRPC 라우터 구조

```
appRouter
├── item          # 문항 CRUD + 버전 관리
├── search        # 통합 검색 (Meilisearch)
├── skill         # 스킬/선수학습 관계
├── standard      # 교육과정 표준
├── upload        # 일괄 업로드
├── review        # 검수 워크플로우
├── auth          # 인증 관련
└── admin         # 관리자 전용
```

### 4.2 tRPC 초기화 및 미들웨어

```typescript
// apps/web/src/server/trpc/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { Session } from "next-auth";
import { prisma } from "@math-item-os/db";
import { logger } from "../lib/logger";
import type { Role } from "@math-item-os/shared";

// 컨텍스트 타입 정의
interface CreateContextOptions {
  session: Session | null;
}

// tRPC 컨텍스트 생성
export const createTRPCContext = async (opts: CreateContextOptions) => {
  return {
    session: opts.session,
    prisma,
    logger,
  };
};

// tRPC 인스턴스 초기화
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

// 기본 라우터/프로시저
export const createRouter = t.router;
export const publicProcedure = t.procedure;

// 감사 로그 미들웨어 — 모든 mutation에 적용
const auditMiddleware = t.middleware(async ({ ctx, path, type, next }) => {
  const start = Date.now();
  const result = await next();
  const durationMs = Date.now() - start;

  if (type === "mutation") {
    ctx.logger.info({
      type: "audit",
      path,
      userId: ctx.session?.user?.id,
      durationMs,
      success: result.ok,
    });
  }

  return result;
});

// 인증 필수 미들웨어
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "로그인이 필요합니다" });
  }
  return next({
    ctx: { session: { ...ctx.session, user: ctx.session.user } },
  });
});

// 역할 기반 접근 제어 미들웨어
const enforceRole = (allowedRoles: Role[]) =>
  t.middleware(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    const userRole = ctx.session.user.role as Role;
    if (!allowedRoles.includes(userRole)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `이 작업에는 ${allowedRoles.join(" 또는 ")} 역할이 필요합니다`,
      });
    }
    return next({ ctx: { session: { ...ctx.session, user: ctx.session.user } } });
  });

// 조직 데이터 격리 미들웨어
const enforceOrgIsolation = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user?.organizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "조직에 소속되어야 합니다",
    });
  }
  return next({
    ctx: {
      organizationId: ctx.session.user.organizationId,
    },
  });
});

// 인증된 프로시저
export const protectedProcedure = t.procedure
  .use(enforceAuth)
  .use(enforceOrgIsolation)
  .use(auditMiddleware);

// 관리자 프로시저
export const adminProcedure = t.procedure
  .use(enforceAuth)
  .use(enforceRole(["admin"]))
  .use(auditMiddleware);

// 컨텐츠 운영자 프로시저
export const contentOpsProcedure = t.procedure
  .use(enforceAuth)
  .use(enforceRole(["admin", "content-ops"]))
  .use(auditMiddleware);
```

### 4.3 루트 라우터

```typescript
// apps/web/src/server/trpc/root.ts
import { createRouter } from "./trpc";
import { itemRouter } from "./routers/item.router";
import { searchRouter } from "./routers/search.router";
import { skillRouter } from "./routers/skill.router";
import { standardRouter } from "./routers/standard.router";
import { uploadRouter } from "./routers/upload.router";
import { reviewRouter } from "./routers/review.router";
import { authRouter } from "./routers/auth.router";
import { adminRouter } from "./routers/admin.router";

export const appRouter = createRouter({
  item: itemRouter,
  search: searchRouter,
  skill: skillRouter,
  standard: standardRouter,
  upload: uploadRouter,
  review: reviewRouter,
  auth: authRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
```

### 4.4 문항 라우터 (핵심 CRUD)

```typescript
// apps/web/src/server/trpc/routers/item.router.ts
import { z } from "zod";
import { createRouter, protectedProcedure, contentOpsProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

// 입력 스키마 정의
const CreateItemInput = z.object({
  // 기본 정보
  title: z.string().min(1).max(200),
  stem: z.string().min(1),                    // 문항 본문 (LaTeX 포함 가능)
  stemLatex: z.string().optional(),            // 순수 LaTeX 수식 부분
  stemHtml: z.string().optional(),             // KaTeX 렌더링 결과 HTML

  // 문항 유형
  itemType: z.enum([
    "multiple_choice",        // 객관식
    "short_answer",           // 단답형
    "essay",                  // 서술형
    "true_false",             // 참/거짓
    "fill_in_blank",          // 빈칸 채우기
  ]),

  // 정답/선택지
  answer: z.string(),                          // 정답 (LaTeX 가능)
  choices: z.array(z.object({                  // 객관식 선택지
    label: z.string(),                         // "1", "2", "3", "4", "5"
    content: z.string(),                       // 선택지 내용
    contentLatex: z.string().optional(),
    isCorrect: z.boolean(),
  })).optional(),

  // 풀이
  solution: z.object({
    content: z.string(),                       // 풀이 텍스트
    contentLatex: z.string().optional(),        // 풀이 내 수식
    steps: z.array(z.object({                  // 단계별 풀이
      order: z.number(),
      description: z.string(),
      latex: z.string().optional(),
    })).optional(),
  }).optional(),

  // 메타데이터
  gradeLevel: z.number().min(1).max(3),        // 중학교 1-3학년
  difficulty: z.number().min(1).max(5),        // 난이도 1-5
  estimatedTimeSeconds: z.number().optional(), // 예상 풀이 시간

  // 관계
  skillIds: z.array(z.string()).optional(),    // 연결 스킬 ID 목록
  standardIds: z.array(z.string()).optional(), // 연결 교육과정 표준 ID 목록
  tagIds: z.array(z.string()).optional(),      // 태그 ID 목록

  // 출처
  source: z.object({
    type: z.enum(["textbook", "exam", "original", "modified", "external"]),
    name: z.string().optional(),               // 교재명/시험명
    year: z.number().optional(),
    page: z.number().optional(),
    publisher: z.string().optional(),
  }).optional(),
});

const UpdateItemInput = CreateItemInput.partial().extend({
  id: z.string(),
  changeNote: z.string().optional(),           // 변경 사유 (버전 관리용)
});

const GetItemsInput = z.object({
  cursor: z.string().optional(),               // 커서 기반 페이지네이션
  limit: z.number().min(1).max(100).default(20),
  gradeLevel: z.number().optional(),
  difficulty: z.number().optional(),
  itemType: z.string().optional(),
  skillId: z.string().optional(),
  standardId: z.string().optional(),
  status: z.enum(["draft", "review", "published", "archived"]).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "difficulty"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const itemRouter = createRouter({
  // 문항 생성
  create: protectedProcedure
    .input(CreateItemInput)
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.$transaction(async (tx) => {
        // 1. 문항 생성
        const created = await tx.item.create({
          data: {
            ...input,
            organizationId: ctx.organizationId,
            createdById: ctx.session.user.id,
            status: "draft",
            version: 1,
            // 관계 연결
            skills: input.skillIds
              ? { connect: input.skillIds.map((id) => ({ id })) }
              : undefined,
            standards: input.standardIds
              ? { connect: input.standardIds.map((id) => ({ id })) }
              : undefined,
            tags: input.tagIds
              ? { connect: input.tagIds.map((id) => ({ id })) }
              : undefined,
          },
          include: {
            skills: true,
            standards: true,
            tags: true,
            createdBy: { select: { id: true, name: true } },
          },
        });

        // 2. 초기 버전 스냅샷 생성
        await tx.itemVersion.create({
          data: {
            itemId: created.id,
            version: 1,
            snapshot: JSON.parse(JSON.stringify(created)),
            createdById: ctx.session.user.id,
            changeNote: "초기 생성",
          },
        });

        return created;
      });

      // 3. Meilisearch 비동기 동기화 큐에 추가
      await ctx.prisma.syncQueue.create({
        data: {
          entityType: "item",
          entityId: item.id,
          operation: "create",
        },
      });

      return item;
    }),

  // 문항 상세 조회
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.prisma.item.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          skills: true,
          standards: true,
          tags: true,
          solution: true,
          choices: { orderBy: { order: "asc" } },
          createdBy: { select: { id: true, name: true } },
          updatedBy: { select: { id: true, name: true } },
          versions: {
            orderBy: { version: "desc" },
            take: 5,
            select: { version: true, changeNote: true, createdAt: true },
          },
        },
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "문항을 찾을 수 없습니다" });
      }

      return item;
    }),

  // 문항 목록 조회 (커서 기반 페이지네이션)
  list: protectedProcedure
    .input(GetItemsInput)
    .query(async ({ ctx, input }) => {
      const { cursor, limit, sortBy, sortOrder, ...filters } = input;

      const where = {
        organizationId: ctx.organizationId,
        ...(filters.gradeLevel && { gradeLevel: filters.gradeLevel }),
        ...(filters.difficulty && { difficulty: filters.difficulty }),
        ...(filters.itemType && { itemType: filters.itemType }),
        ...(filters.status && { status: filters.status }),
        ...(filters.skillId && { skills: { some: { id: filters.skillId } } }),
        ...(filters.standardId && { standards: { some: { id: filters.standardId } } }),
      };

      const items = await ctx.prisma.item.findMany({
        where,
        take: limit + 1,  // 다음 페이지 존재 여부 확인
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { [sortBy]: sortOrder },
        include: {
          skills: { select: { id: true, name: true } },
          tags: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });

      let nextCursor: string | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.id;
      }

      return { items, nextCursor };
    }),

  // 문항 수정 (버전 관리 포함)
  update: protectedProcedure
    .input(UpdateItemInput)
    .mutation(async ({ ctx, input }) => {
      const { id, changeNote, skillIds, standardIds, tagIds, ...data } = input;

      const updated = await ctx.prisma.$transaction(async (tx) => {
        // 1. 기존 문항 확인
        const existing = await tx.item.findFirst({
          where: { id, organizationId: ctx.organizationId },
        });

        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "문항을 찾을 수 없습니다" });
        }

        const newVersion = existing.version + 1;

        // 2. 문항 업데이트
        const result = await tx.item.update({
          where: { id },
          data: {
            ...data,
            version: newVersion,
            updatedById: ctx.session.user.id,
            // 관계 재설정 (set: 기존 관계 교체)
            ...(skillIds && { skills: { set: skillIds.map((sid) => ({ id: sid })) } }),
            ...(standardIds && { standards: { set: standardIds.map((sid) => ({ id: sid })) } }),
            ...(tagIds && { tags: { set: tagIds.map((tid) => ({ id: tid })) } }),
          },
          include: { skills: true, standards: true, tags: true },
        });

        // 3. 버전 스냅샷 생성
        await tx.itemVersion.create({
          data: {
            itemId: id,
            version: newVersion,
            snapshot: JSON.parse(JSON.stringify(result)),
            createdById: ctx.session.user.id,
            changeNote: changeNote ?? `버전 ${newVersion} 업데이트`,
          },
        });

        return result;
      });

      // 4. Meilisearch 동기화 큐
      await ctx.prisma.syncQueue.create({
        data: { entityType: "item", entityId: id, operation: "update" },
      });

      return updated;
    }),

  // 문항 삭제 (소프트 삭제)
  delete: contentOpsProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.item.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
      });

      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await ctx.prisma.item.update({
        where: { id: input.id },
        data: { status: "archived", archivedAt: new Date() },
      });

      await ctx.prisma.syncQueue.create({
        data: { entityType: "item", entityId: input.id, operation: "delete" },
      });

      return { success: true };
    }),

  // 문항 버전 히스토리 조회
  getVersionHistory: protectedProcedure
    .input(z.object({
      itemId: z.string(),
      limit: z.number().min(1).max(50).default(10),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.itemVersion.findMany({
        where: {
          itemId: input.itemId,
          item: { organizationId: ctx.organizationId },
        },
        orderBy: { version: "desc" },
        take: input.limit,
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      });
    }),

  // 특정 버전 상세 조회
  getVersion: protectedProcedure
    .input(z.object({ itemId: z.string(), version: z.number() }))
    .query(async ({ ctx, input }) => {
      const version = await ctx.prisma.itemVersion.findFirst({
        where: {
          itemId: input.itemId,
          version: input.version,
          item: { organizationId: ctx.organizationId },
        },
      });

      if (!version) {
        throw new TRPCError({ code: "NOT_FOUND", message: "해당 버전을 찾을 수 없습니다" });
      }

      return version;
    }),
});
```

### 4.5 검색 라우터

```typescript
// apps/web/src/server/trpc/routers/search.router.ts
import { z } from "zod";
import { createRouter, protectedProcedure } from "../trpc";
import { searchService } from "../services/search.service";

const SearchInput = z.object({
  query: z.string().min(1).max(500),
  filters: z.object({
    gradeLevel: z.array(z.number()).optional(),     // [1, 2, 3]
    difficulty: z.array(z.number()).optional(),      // [1, 2, 3, 4, 5]
    itemType: z.array(z.string()).optional(),
    skillIds: z.array(z.string()).optional(),
    standardIds: z.array(z.string()).optional(),
    tagIds: z.array(z.string()).optional(),
    status: z.array(z.string()).optional(),
    source: z.string().optional(),
  }).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sort: z.enum(["relevance", "difficulty_asc", "difficulty_desc", "newest", "oldest"]).default("relevance"),
});

const SimilarItemInput = z.object({
  itemId: z.string(),
  limit: z.number().min(1).max(20).default(5),
  // Phase 1: 스킬 기반 유사도만 사용, Phase 2에서 pgvector 벡터 유사도 추가
  method: z.enum(["skill_based"]).default("skill_based"),
});

export const searchRouter = createRouter({
  // 통합 검색 (Meilisearch)
  items: protectedProcedure
    .input(SearchInput)
    .query(async ({ ctx, input }) => {
      const results = await searchService.searchItems({
        query: input.query,
        filters: {
          ...input.filters,
          organizationId: ctx.organizationId,  // 조직 격리 필터 자동 추가
        },
        page: input.page,
        limit: input.limit,
        sort: input.sort,
      });

      return {
        items: results.hits,
        totalHits: results.estimatedTotalHits,
        page: input.page,
        totalPages: Math.ceil((results.estimatedTotalHits ?? 0) / input.limit),
        processingTimeMs: results.processingTimeMs,
        facets: results.facetDistribution,
      };
    }),

  // 유사 문항 검색
  similar: protectedProcedure
    .input(SimilarItemInput)
    .query(async ({ ctx, input }) => {
      // Phase 1: 동일 스킬 보유 문항 중 난이도 유사한 순서로 반환
      const sourceItem = await ctx.prisma.item.findFirst({
        where: { id: input.itemId, organizationId: ctx.organizationId },
        include: { skills: { select: { id: true } } },
      });

      if (!sourceItem) {
        return { items: [] };
      }

      const skillIds = sourceItem.skills.map((s) => s.id);

      const similarItems = await ctx.prisma.item.findMany({
        where: {
          id: { not: input.itemId },
          organizationId: ctx.organizationId,
          status: "published",
          skills: { some: { id: { in: skillIds } } },
        },
        orderBy: [
          // 난이도 차이가 적은 순 (SQL raw 필요, Prisma 한계)
          { difficulty: "asc" },
        ],
        take: input.limit,
        include: {
          skills: { select: { id: true, name: true } },
          tags: { select: { id: true, name: true } },
        },
      });

      return { items: similarItems };
    }),

  // 자동 완성 제안
  suggest: protectedProcedure
    .input(z.object({ query: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      return searchService.suggest({
        query: input.query,
        organizationId: ctx.organizationId,
      });
    }),
});
```

### 4.6 업로드 라우터

```typescript
// apps/web/src/server/trpc/routers/upload.router.ts
import { z } from "zod";
import { createRouter, contentOpsProcedure, protectedProcedure } from "../trpc";

const StartUploadInput = z.object({
  fileName: z.string(),
  fileType: z.enum(["csv", "json", "qti", "hwp"]),
  fileSizeBytes: z.number(),
  // CSV/JSON 전용: 열 매핑 정보
  columnMapping: z.record(z.string(), z.string()).optional(),
});

export const uploadRouter = createRouter({
  // 업로드 작업 시작 — 작업 ID 반환
  start: contentOpsProcedure
    .input(StartUploadInput)
    .mutation(async ({ ctx, input }) => {
      const job = await ctx.prisma.uploadJob.create({
        data: {
          fileName: input.fileName,
          fileType: input.fileType,
          fileSizeBytes: input.fileSizeBytes,
          columnMapping: input.columnMapping,
          status: "pending",
          organizationId: ctx.organizationId,
          createdById: ctx.session.user.id,
        },
      });

      return { jobId: job.id, uploadUrl: `/api/upload?jobId=${job.id}` };
    }),

  // 업로드 작업 상태 조회 (폴링)
  getStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.prisma.uploadJob.findFirst({
        where: {
          id: input.jobId,
          organizationId: ctx.organizationId,
        },
        select: {
          id: true,
          status: true,
          totalItems: true,
          processedItems: true,
          successCount: true,
          errorCount: true,
          errors: true,
          createdAt: true,
          completedAt: true,
        },
      });

      return job;
    }),

  // 업로드 히스토리
  listJobs: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(10),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const jobs = await ctx.prisma.uploadJob.findMany({
        where: { organizationId: ctx.organizationId },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileName: true,
          fileType: true,
          status: true,
          totalItems: true,
          successCount: true,
          errorCount: true,
          createdAt: true,
          completedAt: true,
          createdBy: { select: { name: true } },
        },
      });

      let nextCursor: string | undefined;
      if (jobs.length > input.limit) {
        nextCursor = jobs.pop()?.id;
      }

      return { jobs, nextCursor };
    }),
});
```

### 4.7 스킬/선수학습 라우터

```typescript
// apps/web/src/server/trpc/routers/skill.router.ts
import { z } from "zod";
import { createRouter, protectedProcedure, contentOpsProcedure } from "../trpc";

export const skillRouter = createRouter({
  // 스킬 트리 조회 (ltree 계층 구조)
  getTree: protectedProcedure
    .input(z.object({
      rootPath: z.string().optional(),        // ltree 경로 (예: "algebra.equations")
      depth: z.number().min(1).max(5).default(3),
    }))
    .query(async ({ ctx, input }) => {
      // ltree 쿼리: 지정된 루트 하위의 스킬을 depth만큼 조회
      const skills = await ctx.prisma.$queryRaw`
        SELECT id, name, code, path::text, description,
               nlevel(path) as level,
               (SELECT COUNT(*) FROM "_ItemSkills" WHERE "B" = skill.id) as item_count
        FROM "Skill" as skill
        WHERE ${input.rootPath
          ? /* ltree: 해당 경로의 하위 노드 */ `path <@ ${input.rootPath}::ltree AND nlevel(path) <= nlevel(${input.rootPath}::ltree) + ${input.depth}`
          : /* 전체 트리에서 depth 제한 */ `nlevel(path) <= ${input.depth}`
        }
        ORDER BY path
      `;

      return skills;
    }),

  // 선수학습 관계 조회
  getPrerequisites: protectedProcedure
    .input(z.object({ skillId: z.string() }))
    .query(async ({ ctx, input }) => {
      const prerequisites = await ctx.prisma.skillPrerequisite.findMany({
        where: { skillId: input.skillId },
        include: {
          prerequisite: {
            select: { id: true, name: true, code: true, path: true },
          },
        },
        orderBy: { order: "asc" },
      });

      return prerequisites;
    }),

  // 스킬 생성
  create: contentOpsProcedure
    .input(z.object({
      name: z.string(),
      code: z.string(),
      path: z.string(),         // ltree 경로
      description: z.string().optional(),
      prerequisiteIds: z.array(z.object({
        skillId: z.string(),
        strength: z.enum(["required", "recommended"]),
        order: z.number(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { prerequisiteIds, ...skillData } = input;

      return ctx.prisma.skill.create({
        data: {
          ...skillData,
          prerequisites: prerequisiteIds
            ? {
                create: prerequisiteIds.map((p) => ({
                  prerequisiteId: p.skillId,
                  strength: p.strength,
                  order: p.order,
                })),
              }
            : undefined,
        },
      });
    }),
});
```

### 4.8 Phase 1 전체 엔드포인트 요약

| 라우터 | 프로시저 | 유형 | 설명 |
|--------|----------|------|------|
| `item.create` | protectedProcedure | mutation | 문항 생성 |
| `item.getById` | protectedProcedure | query | 문항 상세 조회 |
| `item.list` | protectedProcedure | query | 문항 목록 (커서 페이지네이션) |
| `item.update` | protectedProcedure | mutation | 문항 수정 + 버전 생성 |
| `item.delete` | contentOpsProcedure | mutation | 문항 소프트 삭제 |
| `item.getVersionHistory` | protectedProcedure | query | 버전 히스토리 |
| `item.getVersion` | protectedProcedure | query | 특정 버전 스냅샷 |
| `search.items` | protectedProcedure | query | 통합 검색 |
| `search.similar` | protectedProcedure | query | 유사 문항 (스킬 기반) |
| `search.suggest` | protectedProcedure | query | 자동 완성 |
| `skill.getTree` | protectedProcedure | query | 스킬 트리 조회 |
| `skill.getPrerequisites` | protectedProcedure | query | 선수학습 관계 |
| `skill.create` | contentOpsProcedure | mutation | 스킬 생성 |
| `standard.list` | protectedProcedure | query | 교육과정 표준 목록 |
| `standard.getById` | protectedProcedure | query | 표준 상세 |
| `upload.start` | contentOpsProcedure | mutation | 업로드 작업 시작 |
| `upload.getStatus` | protectedProcedure | query | 업로드 상태 조회 |
| `upload.listJobs` | protectedProcedure | query | 업로드 히스토리 |
| `review.getQueue` | contentOpsProcedure | query | 검수 대기 큐 |
| `review.approve` | contentOpsProcedure | mutation | 검수 승인 |
| `review.reject` | contentOpsProcedure | mutation | 검수 반려 |
| `auth.getSession` | publicProcedure | query | 현재 세션 조회 |
| `admin.getStats` | adminProcedure | query | 대시보드 통계 |
| `admin.getAuditLogs` | adminProcedure | query | 감사 로그 조회 |

---

## 5. 데이터 흐름 다이어그램

### 5.1 문항 생성 흐름

```
[교사 브라우저]
    │
    │ 1. 문항 폼 작성 (LaTeX 수식 입력)
    │    - math-editor 컴포넌트에서 실시간 KaTeX 미리보기
    │    - Zod 클라이언트 유효성 검증
    │
    ▼
[Next.js App Router]
    │
    │ 2. tRPC mutation: item.create
    │
    ▼
[tRPC 미들웨어 체인]
    │
    │ enforceAuth → enforceOrgIsolation → auditMiddleware
    │
    ▼
[item.router.ts → item.service.ts]
    │
    │ 3. Prisma 트랜잭션:
    │    a. LaTeX 정규화 (latex-normalizer)
    │    b. KaTeX 서버사이드 렌더링 → stemHtml 저장
    │    c. Item 레코드 생성
    │    d. ItemVersion 스냅샷 생성 (v1)
    │    e. SyncQueue 레코드 추가
    │
    ▼
[PostgreSQL 17]                    [BullMQ Worker]
    │                                   │
    │ 트랜잭션 커밋                       │ 4. SyncQueue 폴링
    │                                   │    또는 Prisma 후크 트리거
    │                                   │
    │                                   ▼
    │                          [sync.service.ts]
    │                                   │
    │                                   │ 5. 문항 데이터를
    │                                   │    Meilisearch 인덱스 형식으로 변환
    │                                   │
    │                                   ▼
    │                          [Meilisearch]
    │                                   │
    │                                   │ 인덱스 업데이트 완료
    │                                   │
    ▼                                   ▼
[Redis Cache]                  [검색 즉시 반영]
    │
    │ 6. 관련 캐시 무효화
    │    (문항 목록, 스킬별 문항 수 등)
```

### 5.2 검색 흐름

```
[교사 브라우저]
    │
    │ 1. 검색어 입력 + 필터 선택
    │    - useDebounce(300ms) 적용
    │    - URL 파라미터로 검색 상태 동기화 (nuqs)
    │
    ▼
[tRPC query: search.items]
    │
    │ 2. 입력 유효성 검증 (Zod)
    │    + organizationId 필터 자동 추가
    │
    ▼
[search.service.ts]
    │
    │ 3. Meilisearch 검색 실행
    │    - 한국어 CJK 토큰화 적용
    │    - 필터 조건 변환
    │    - facet 집계 요청
    │
    ▼
[Meilisearch]
    │
    │ 4. 검색 결과 반환
    │    - hits: 문항 목록 (하이라이팅 포함)
    │    - estimatedTotalHits: 총 건수
    │    - facetDistribution: 필터별 분포
    │    - processingTimeMs: 처리 시간
    │
    ▼
[search.service.ts]
    │
    │ 5. 결과 후처리:
    │    - LaTeX 수식 하이라이팅 보정
    │    - 접근 권한 필터링 (이중 확인)
    │
    ▼
[교사 브라우저]
    │
    │ 6. search-results 컴포넌트 렌더링
    │    - KaTeX 클라이언트 렌더링
    │    - 무한 스크롤 또는 페이지네이션
    │    - 필터 패싯 카운트 표시
```

### 5.3 일괄 업로드 흐름

```
[교사 브라우저]
    │
    │ 1. 파일 드래그앤드롭 (upload-dropzone)
    │    - 파일 유형 검증 (csv/json/qti/hwp)
    │    - 파일 크기 검증 (< 100MB)
    │
    ▼
[tRPC mutation: upload.start]
    │
    │ 2. UploadJob 레코드 생성 (status: "pending")
    │    - jobId + 업로드 URL 반환
    │
    ▼
[POST /api/upload?jobId=xxx]
    │
    │ 3. 멀티파트 파일 업로드
    │    - 스트리밍 수신 (메모리 효율)
    │    - 임시 저장소에 파일 저장
    │
    ▼
[BullMQ 작업 큐]
    │
    │ 4. 비동기 처리 작업 enqueue
    │    - 작업 우선순위: 파일 크기에 반비례
    │    - 동시 실행 제한: 3 워커
    │
    ▼
[upload.service.ts — BullMQ Worker]
    │
    │ 5. 파일 형식별 파싱:
    │    ┌─ CSV:  csv-parse 스트리밍 파서
    │    ├─ JSON: 스트리밍 JSON 파서
    │    ├─ QTI:  fast-xml-parser (QTI 2.1 스키마)
    │    └─ HWP:  hwpjs → 텍스트/수식 추출
    │
    │ 6. 행별 처리 (배치: 500행씩):
    │    a. Zod 스키마 유효성 검증
    │    b. LaTeX 구문 검증
    │    c. 스킬/표준 코드 → ID 매핑 (캐시 활용)
    │    d. 중복 검사 (stem 해시)
    │
    │ 7. Prisma createMany (배치 삽입)
    │    + ItemVersion 일괄 생성
    │    + SyncQueue 일괄 추가
    │
    │ 8. 진행률 업데이트:
    │    - Redis pub/sub로 실시간 진행 상태 발행
    │    - UploadJob.processedItems 업데이트
    │
    ▼
[교사 브라우저 — upload-progress 컴포넌트]
    │
    │ 9. tRPC query: upload.getStatus 폴링 (2초 간격)
    │    - 진행률 프로그레스 바
    │    - 오류 행 목록 표시
    │    - 완료 시 결과 요약
    │
    ▼
[완료]
    │
    │ 10. 자동 검수 큐 등록
    │     (status: "review" — 관리자 확인 필요)
```

---

## 6. 인증 및 권한

### 6.1 Auth.js v5 설정

```typescript
// apps/web/src/server/lib/auth.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@math-item-os/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

// 로그인 입력 스키마
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },

  providers: [
    // Google OAuth
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // 교사 이메일 도메인 제한 (선택적)
      // profile(profile) { ... }
    }),

    // 이메일/비밀번호 인증 (교사 직접 등록용)
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          include: { organization: true },
        });

        if (!user?.hashedPassword) return null;

        const isValid = await bcrypt.compare(
          parsed.data.password,
          user.hashedPassword,
        );

        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
        };
      },
    }),
  ],

  callbacks: {
    // JWT에 역할/조직 정보 포함
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.organizationId = user.organizationId;
      }
      return token;
    },

    // 세션에 역할/조직 정보 전달
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
        session.user.organizationId = token.organizationId as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
});
```

### 6.2 역할 정의 (RBAC)

```typescript
// packages/shared/src/constants/roles.ts

// 역할 정의
export const ROLES = {
  admin: "admin",           // 시스템 관리자: 전체 권한
  contentOps: "content-ops", // 콘텐츠 운영자: 문항 CRUD + 검수 + 업로드
  teacher: "teacher",        // 교사: 문항 조회/검색/생성 + 자기 문항 편집
  student: "student",        // 학생: 조회 전용 (Phase 2+)
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// 권한 매트릭스
export const PERMISSIONS = {
  // 문항
  "item:create":    ["admin", "content-ops", "teacher"],
  "item:read":      ["admin", "content-ops", "teacher", "student"],
  "item:update":    ["admin", "content-ops"],          // teacher는 자기 문항만
  "item:delete":    ["admin", "content-ops"],
  "item:publish":   ["admin", "content-ops"],
  "item:archive":   ["admin", "content-ops"],

  // 검색
  "search:items":   ["admin", "content-ops", "teacher", "student"],

  // 업로드
  "upload:create":  ["admin", "content-ops"],
  "upload:read":    ["admin", "content-ops"],

  // 스킬/표준
  "skill:create":   ["admin", "content-ops"],
  "skill:read":     ["admin", "content-ops", "teacher"],

  // 검수
  "review:read":    ["admin", "content-ops"],
  "review:resolve": ["admin", "content-ops"],

  // 관리
  "admin:dashboard": ["admin"],
  "admin:audit":     ["admin"],
  "admin:users":     ["admin"],
} as const;

// 권한 검사 헬퍼
export function hasPermission(
  role: Role,
  permission: keyof typeof PERMISSIONS,
): boolean {
  const allowed = PERMISSIONS[permission] as readonly string[];
  return allowed.includes(role);
}
```

### 6.3 교사 자기 문항 편집 규칙

```typescript
// apps/web/src/server/middleware/rbac.middleware.ts

// 교사는 자신이 생성한 문항만 수정 가능
export async function canEditItem(
  userId: string,
  role: Role,
  itemId: string,
  prisma: PrismaClient,
): Promise<boolean> {
  if (role === "admin" || role === "content-ops") {
    return true;
  }

  if (role === "teacher") {
    const item = await prisma.item.findFirst({
      where: { id: itemId, createdById: userId },
      select: { id: true },
    });
    return item !== null;
  }

  return false;
}
```

### 6.4 조직 데이터 격리

모든 데이터 쿼리에 `organizationId` 필터가 자동 적용됨:

- tRPC 미들웨어 `enforceOrgIsolation`이 컨텍스트에 `organizationId` 주입
- 모든 `protectedProcedure`가 이 미들웨어를 포함
- Prisma 쿼리의 `where` 조건에 항상 `organizationId` 포함
- Meilisearch 검색 필터에도 `organizationId` 필터 자동 추가

---

## 7. 검색 아키텍처

### 7.1 Meilisearch 인덱스 설계

```typescript
// apps/web/src/server/lib/meilisearch.ts
import { MeiliSearch } from "meilisearch";

export const meili = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST!,
  apiKey: process.env.MEILISEARCH_MASTER_KEY!,
});

// 인덱스 초기화 설정
export async function initializeIndexes() {
  const itemsIndex = meili.index("items");

  // 검색 가능 속성 설정
  await itemsIndex.updateSearchableAttributes([
    "stem",              // 문항 본문 (최우선)
    "title",             // 제목
    "answer",            // 정답
    "skillNames",        // 관련 스킬명
    "standardNames",     // 교육과정 표준명
    "tagNames",          // 태그명
    "solutionContent",   // 풀이 내용
    "sourceInfo",        // 출처 정보
  ]);

  // 필터링 가능 속성
  await itemsIndex.updateFilterableAttributes([
    "organizationId",    // 조직 격리 (필수)
    "gradeLevel",        // 학년
    "difficulty",        // 난이도
    "itemType",          // 문항 유형
    "status",            // 상태
    "skillIds",          // 스킬 ID
    "standardIds",       // 표준 ID
    "tagIds",            // 태그 ID
    "createdById",       // 작성자
    "sourceType",        // 출처 유형
  ]);

  // 정렬 가능 속성
  await itemsIndex.updateSortableAttributes([
    "difficulty",
    "createdAt",
    "updatedAt",
    "gradeLevel",
  ]);

  // facet 설정 (필터 카운트 표시용)
  await itemsIndex.updateFaceting({ maxValuesPerFacet: 100 });

  // 한국어 CJK 토큰화 설정
  // Meilisearch v1.12+는 CJK 자동 감지 지원
  // 추가 딕셔너리 설정 필요 시:
  await itemsIndex.updateSettings({
    // 동의어 설정 (수학 용어)
    synonyms: {
      "방정식": ["equation", "eq"],
      "부등식": ["inequality"],
      "일차방정식": ["1차방정식", "linear equation"],
      "이차방정식": ["2차방정식", "quadratic equation"],
      "다항식": ["polynomial"],
      "인수분해": ["factoring", "factorization"],
      "근": ["root", "solution"],
      "계수": ["coefficient"],
    },
    // 불용어 (한국어)
    stopWords: [
      "의", "가", "이", "은", "는", "을", "를", "에", "에서", "와", "과",
      "도", "로", "으로", "만", "뿐", "까지", "부터",
    ],
    // 오타 허용 설정
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 3, twoTypos: 6 },
    },
    // 페이지네이션 제한
    pagination: { maxTotalHits: 10000 },
  });
}
```

### 7.2 인덱스 문서 형식

```typescript
// Meilisearch에 저장되는 문항 문서 형식
interface MeiliItemDocument {
  id: string;                        // 문항 ID (primary key)
  organizationId: string;            // 조직 ID (격리용 필터)

  // 검색 대상 텍스트
  title: string;
  stem: string;                      // LaTeX 제거된 순수 텍스트
  stemOriginal: string;              // LaTeX 포함 원본 (표시용)
  answer: string;
  solutionContent: string | null;

  // 메타데이터
  itemType: string;
  gradeLevel: number;
  difficulty: number;
  status: string;

  // 관계 (필터 + 검색)
  skillIds: string[];
  skillNames: string[];              // 검색용 스킬 이름 배열
  standardIds: string[];
  standardNames: string[];
  tagIds: string[];
  tagNames: string[];

  // 출처
  sourceType: string | null;
  sourceInfo: string | null;         // "교재명 2024 p.123"

  // 작성자
  createdById: string;
  createdByName: string;

  // 시간 (정렬용, Unix timestamp)
  createdAt: number;
  updatedAt: number;
}
```

### 7.3 PostgreSQL -> Meilisearch 동기화 전략

```
동기화 방식: 이벤트 기반 + 주기적 전체 동기화 (이중 안전망)

1. 이벤트 기반 동기화 (실시간):
   ┌─────────────────────┐
   │ item.create/update/ │
   │ delete mutation     │
   └────────┬────────────┘
            │
            ▼
   ┌─────────────────────┐
   │ SyncQueue 테이블에   │
   │ 레코드 추가          │
   └────────┬────────────┘
            │
            ▼
   ┌─────────────────────┐
   │ BullMQ Worker       │
   │ (5초 폴링 간격)      │
   │                     │
   │ - SyncQueue 읽기     │
   │ - 배치 처리 (100건)   │
   │ - Meilisearch 업서트  │
   │ - SyncQueue 완료 마킹 │
   └─────────────────────┘

2. 전체 동기화 (일일 새벽 3시 cron):
   - scripts/sync-meilisearch.ts 실행
   - PostgreSQL 전체 문항 스캔
   - Meilisearch 인덱스 재구축
   - 불일치 감지 및 로깅
   - 소요 시간: ~80K 문항 기준 약 5분

3. SyncQueue 테이블 스키마:
   id          | cuid
   entityType  | "item" | "skill" | "standard"
   entityId    | string
   operation   | "create" | "update" | "delete"
   status      | "pending" | "processing" | "done" | "failed"
   attempts    | number (max 3)
   error       | string | null
   createdAt   | timestamp
   processedAt | timestamp | null
```

### 7.4 검색 성능 최적화

| 전략 | 설명 |
|------|------|
| **Redis 캐시** | 자주 사용되는 검색어 결과 캐시 (TTL: 5분) |
| **디바운스** | 클라이언트 300ms 디바운스 |
| **인덱스 최적화** | searchableAttributes 우선순위 설정 |
| **필터 인덱스** | filterableAttributes에 자주 사용되는 필터 설정 |
| **facet 제한** | maxValuesPerFacet: 100으로 제한 |
| **페이지네이션** | maxTotalHits: 10,000 (Deep pagination 방지) |
| **동의어** | 수학 용어 한/영 동의어 설정 |

---

## 8. LaTeX 파이프라인

### 8.1 저장 구조

```
모든 수학 수식 데이터는 3가지 형태로 저장:

1. stem (원본): "x의 값이 $x^2 + 3x + 2 = 0$을 만족할 때, 모든 근의 합을 구하시오."
   → LaTeX 인라인 마크업($...$) 포함 원문

2. stemLatex: "x^2 + 3x + 2 = 0"
   → 순수 LaTeX 수식만 추출 (정규화 완료)

3. stemHtml: "<span class=\"katex\">...</span>"
   → KaTeX 서버사이드 렌더링 결과 HTML

검색용: stem에서 LaTeX 마크업 제거한 텍스트 → Meilisearch 인덱스
```

### 8.2 렌더링 파이프라인

```
[입력: LaTeX 수식 텍스트]
    │
    ▼
[1. LaTeX 정규화 — latex-normalizer.ts]
    │
    │ - 공백 정규화: \,  \;  \quad 통일
    │ - 분수 정규화: 1/2 → \frac{1}{2}
    │ - 괄호 정규화: \left( \right) 일관성
    │ - 연산자 정규화: * → \times, · → \cdot
    │ - 불필요한 중괄호 제거
    │
    ▼
[2. LaTeX 유효성 검증 — latex-validator.ts]
    │
    │ - 괄호/중괄호 짝 확인
    │ - 알려진 LaTeX 명령어 검증
    │ - KaTeX 지원 범위 내 명령어 확인
    │ - 유효하지 않은 수식: 에러 반환 + 원본 보존
    │
    ▼
[3. KaTeX 서버사이드 렌더링 — katex-renderer.ts]
    │
    │ - katex.renderToString(latex, {
    │     throwOnError: false,      // 에러 시 원본 텍스트 표시
    │     displayMode: true/false,  // 블록/인라인 모드
    │     output: "htmlAndMathml",  // HTML + MathML 동시 출력
    │     trust: false,             // 보안: 외부 URL 차단
    │     strict: false,            // 비표준 명령어 허용
    │     macros: {                 // 한국 수학 교육 커스텀 매크로
    │       "\\따라서": "\\therefore",
    │       "\\또는": "\\text{또는}",
    │     },
    │   })
    │
    │ - 렌더링 시간: < 50ms (p95)
    │
    ▼
[4. 출력]
    │
    ├── stemHtml:   KaTeX HTML (빠른 표시용)
    ├── MathML:     KaTeX output에 포함 (접근성/SEO)
    └── 원본 LaTeX: 편집 시 재사용
```

### 8.3 클라이언트 렌더링

```typescript
// apps/web/src/components/math/katex-display.tsx

// KaTeX 렌더링 전략:
// 1. SSR HTML이 있으면 → dangerouslySetInnerHTML (즉시 표시, 0ms)
// 2. SSR HTML이 없으면 → 클라이언트 KaTeX 렌더링
// 3. KaTeX 실패 시 → MathML 폴백
// 4. MathML도 실패 시 → 원본 LaTeX 텍스트 표시

interface KaTeXDisplayProps {
  latex: string;              // 원본 LaTeX
  html?: string;              // SSR 렌더링 결과 (있으면 사용)
  displayMode?: boolean;      // 블록(true) vs 인라인(false)
}

// 구현 시 주의사항:
// - KaTeX CSS는 layout.tsx에서 전역 로드
// - KaTeX 폰트는 public/fonts/에 정적 배포
// - auto-render 미사용 (보안: XSS 방지)
// - 사용자 입력 LaTeX는 항상 서버에서 렌더링 후 제공
```

### 8.4 수식 에디터

```
[math-editor 컴포넌트]
    │
    ├── 입력 모드:
    │   ├── 텍스트 직접 입력: $...$ 또는 $$...$$ 구문
    │   ├── 버튼 팔레트: 자주 사용하는 수학 기호 삽입
    │   │   ├── 분수, 거듭제곱, 루트
    │   │   ├── 그리스 문자
    │   │   ├── 비교 연산자 (≤, ≥, ≠)
    │   │   └── 중학 수학 전용 기호
    │   └── 단축키: Ctrl+M → 수식 모드 토글
    │
    ├── 실시간 미리보기:
    │   ├── 디바운스 100ms
    │   ├── KaTeX 클라이언트 렌더링
    │   └── 오류 시 빨간 하이라이트 + 에러 메시지
    │
    └── 저장 시:
        ├── LaTeX 정규화
        ├── 서버 유효성 검증
        └── SSR HTML 생성 → DB 저장
```

---

## 9. 일괄 업로드 파이프라인

### 9.1 지원 형식별 파싱 사양

#### CSV 파싱

```
필수 열:
  - stem (문항 본문, LaTeX 포함 가능)
  - answer (정답)
  - item_type (문항 유형)
  - grade_level (학년)
  - difficulty (난이도)

선택 열:
  - title (제목, 없으면 stem 앞 50자 자동 생성)
  - choices (객관식: JSON 배열 또는 "A|B|C|D|E" 파이프 구분)
  - correct_choice (객관식 정답 번호)
  - solution (풀이)
  - skill_codes (스킬 코드, 쉼표 구분)
  - standard_codes (표준 코드, 쉼표 구분)
  - tags (태그, 쉼표 구분)
  - source_type, source_name, source_year, source_page

인코딩: UTF-8 (BOM 허용), EUC-KR 자동 감지
구분자: 쉼표(,) 기본, 탭(\t) 지원
```

#### JSON 파싱

```json
{
  "items": [
    {
      "stem": "문항 본문",
      "stemLatex": "x^2 + 1 = 0",
      "answer": "-1, 1",
      "itemType": "short_answer",
      "gradeLevel": 2,
      "difficulty": 3,
      "choices": [
        { "label": "1", "content": "선택지1", "isCorrect": false }
      ],
      "solution": { "content": "풀이 내용", "steps": [] },
      "skillCodes": ["ALG.EQ.001"],
      "standardCodes": ["M-8-A-01"],
      "tags": ["방정식", "이차"]
    }
  ],
  "metadata": {
    "source": { "type": "textbook", "name": "교재명" },
    "defaultGradeLevel": 2
  }
}
```

#### QTI 2.1 XML 파싱

```
지원 QTI interaction 유형:
  - choiceInteraction → multiple_choice
  - textEntryInteraction → short_answer / fill_in_blank
  - extendedTextInteraction → essay

매핑 규칙:
  - <itemBody> → stem (MathML → LaTeX 변환)
  - <responseDeclaration> → answer + choices
  - <modalFeedback> → solution
  - QTI metadata → gradeLevel, difficulty 매핑

주의: QTI 내 MathML은 LaTeX로 역변환 후 저장
```

#### HWP 파싱

```
hwpjs 라이브러리 사용:
  1. HWP 바이너리 → 구조화된 문서 객체
  2. 텍스트 추출 (문단 단위)
  3. 수식 객체 → LaTeX 변환 (HWP 수식 → LaTeX 매핑)
  4. 표 → 구조화된 선택지 추출
  5. 이미지 → Base64 추출 (문항에 포함된 그림)

제한사항 (Phase 1):
  - HWP 5.x만 지원 (3.x는 Phase 2)
  - 복잡한 도형/그래프는 이미지로 추출
  - 문항 경계 자동 인식은 휴리스틱 기반 (수동 보정 필요)
```

### 9.2 유효성 검증 체계

```
[행 단위 검증 — 3단계]

1단계: 구조 검증 (Zod)
  - 필수 필드 존재 여부
  - 데이터 타입 일치
  - 값 범위 (gradeLevel: 1-3, difficulty: 1-5)
  - 문자열 길이 제한

2단계: 수학 검증
  - LaTeX 구문 유효성 (latex-validator)
  - KaTeX 렌더링 가능 여부
  - 정답 형식 검증 (숫자, 분수, 식)

3단계: 관계 검증
  - skillCodes → Skill ID 매핑 가능 여부
  - standardCodes → Standard ID 매핑 가능 여부
  - 중복 검사 (stem 해시 비교)

검증 결과:
  - valid: 즉시 삽입
  - warning: 삽입 + 경고 기록 (예: 매핑 안 된 태그)
  - error: 건너뜀 + 에러 기록 (예: 필수 필드 누락)
  - critical: 전체 중단 (예: 파일 형식 오류)
```

### 9.3 성능 요구사항

```
목표: 10,000 문항/배치

처리 전략:
  - 스트리밍 파싱: 전체 파일을 메모리에 올리지 않음
  - 배치 삽입: 500행 단위 Prisma createMany
  - 스킬/표준 매핑 캐시: Redis에 code→ID 매핑 캐시
  - 병렬 검증: LaTeX 검증은 비동기 병렬 처리
  - 진행률: 500행마다 상태 업데이트

예상 처리 시간:
  - CSV 10K 행: ~30초
  - JSON 10K 항목: ~45초
  - QTI 10K 항목: ~60초 (XML 파싱 오버헤드)
  - HWP: 파일당 ~5초 (단일 파일 기준)
```

---

## 10. 배포 아키텍처

### 10.1 초기 (MVP): Supabase + Vercel

```
┌──────────────────────────────────────────────────────────┐
│                      Vercel                              │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │            Next.js 15 (apps/web)                   │  │
│  │                                                    │  │
│  │  Edge Runtime:                                     │  │
│  │    - 미들웨어 (인증 검증, 리다이렉트)                  │  │
│  │                                                    │  │
│  │  Node.js Runtime (Serverless Functions):            │  │
│  │    - tRPC API 핸들러                                │  │
│  │    - Auth.js 핸들러                                 │  │
│  │    - 파일 업로드 핸들러                               │  │
│  │                                                    │  │
│  │  Static:                                           │  │
│  │    - RSC 정적 페이지                                 │  │
│  │    - KaTeX CSS/폰트                                 │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  환경 분리:                                               │
│    - Production: main 브랜치 자동 배포                     │
│    - Preview: PR별 미리보기 배포                           │
│    - Development: dev 브랜치 자동 배포                     │
└────────────────┬─────────────────────────────────────────┘
                 │
    ┌────────────┼──────────────┬──────────────┐
    │            │              │              │
    ▼            ▼              ▼              ▼
┌────────┐ ┌─────────┐  ┌──────────┐  ┌──────────────┐
│Supabase│ │ Upstash │  │Meilisearch│ │ Python AI    │
│        │ │         │  │ Cloud     │ │ (Railway/    │
│ PG 17  │ │ Redis   │  │           │ │  Render)     │
│ pgvec  │ │ + BullMQ│  │ 한국어 CJK│ │              │
│ ltree  │ │         │  │ 토큰화    │ │ FastAPI      │
│        │ │ 서버리스  │  │           │ │ SymPy        │
└────────┘ └─────────┘  └──────────┘  └──────────────┘
```

### 10.2 환경 분리

| 환경 | DB | Redis | Meilisearch | 도메인 |
|------|-----|-------|-------------|--------|
| Production | Supabase Pro | Upstash Pro | Meilisearch Cloud | math-os.example.com |
| Staging | Supabase Free (별도 프로젝트) | Upstash Free | Meilisearch Cloud (별도) | staging.math-os.example.com |
| Development | Docker (로컬) | Docker (로컬) | Docker (로컬) | localhost:3000 |

### 10.3 Vercel 설정

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack 활성화 (개발 빌드 속도)
  experimental: {
    // tRPC + Prisma 호환성
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
  },

  // Vercel serverless function 크기 제한 대응
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/.prisma/**"],
  },

  // 보안 헤더
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // KaTeX 필요
            "style-src 'self' 'unsafe-inline'",                  // KaTeX CSS
            "font-src 'self'",                                   // KaTeX 폰트
            "img-src 'self' data: blob:",
          ].join("; "),
        },
      ],
    },
  ],
};

export default nextConfig;
```

### 10.4 BullMQ Worker 배포 (Vercel 외부)

```
Vercel Serverless Function은 장시간 실행 작업에 부적합.
BullMQ Worker는 별도 long-running 프로세스로 배포:

선택지:
  A. Railway (추천 — 간편, 무료 티어 있음)
  B. Render Background Worker
  C. AWS ECS Fargate (Phase 2 전환 시)

Worker 프로세스:
  - sync.worker.ts: Meilisearch 동기화
  - upload.worker.ts: 일괄 업로드 처리
  - 동일 Redis(Upstash)에 연결
  - 동일 DB(Supabase)에 연결
```

---

## 11. 테스트 전략

### 11.1 테스트 피라미드

```
          /\
         /  \         E2E 테스트 (Playwright)
        / 10% \       - 문항 생성-편집-검색 워크플로우
       /--------\     - 일괄 업로드 완전 흐름
      /          \    - 인증/권한 시나리오
     /  통합 30%  \
    /              \  통합 테스트 (Vitest)
   /----------------\ - tRPC 라우터 + 실제 DB
  /                  \ - Meilisearch 동기화
 /    단위 60%        \ - 업로드 파서 + 실제 파일
/______________________\
                        단위 테스트 (Vitest)
                        - 서비스 로직 (모킹)
                        - LaTeX 파서/렌더러
                        - Zod 유효성 검증
                        - 유틸리티 함수
```

### 11.2 테스트 설정

```typescript
// vitest.config.ts (루트)
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // 단위 테스트
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["**/e2e/**", "**/node_modules/**"],

    // 테스트 환경
    environment: "node",

    // 전역 셋업 (테스트 DB 초기화)
    globalSetup: ["./tests/helpers/global-setup.ts"],

    // 커버리지 설정
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: [
        "apps/web/src/server/**",
        "packages/*/src/**",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        "**/node_modules/**",
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },

    // 타임아웃
    testTimeout: 10000,

    // 경로 별칭
    alias: {
      "~": path.resolve(__dirname, "apps/web/src"),
      "@math-item-os/db": path.resolve(__dirname, "packages/db/src"),
      "@math-item-os/shared": path.resolve(__dirname, "packages/shared/src"),
    },
  },
});
```

### 11.3 테스트 유형별 예시

```typescript
// 단위 테스트 — LaTeX 정규화
// packages/math-parser/src/__tests__/latex-normalizer.test.ts
import { describe, it, expect } from "vitest";
import { normalizeLatex } from "../latex-normalizer";

describe("normalizeLatex", () => {
  it("분수 표기를 정규화한다", () => {
    expect(normalizeLatex("1/2")).toBe("\\frac{1}{2}");
  });

  it("불필요한 중괄호를 제거한다", () => {
    expect(normalizeLatex("{x}^{2}")).toBe("x^{2}");
  });

  it("곱셈 기호를 통일한다", () => {
    expect(normalizeLatex("2*3")).toBe("2 \\times 3");
  });
});
```

```typescript
// 통합 테스트 — 문항 CRUD
// tests/integration/item.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createCaller } from "~/server/trpc/root";
import { createTestContext, cleanupTestDb } from "../helpers/db.helper";

describe("item.router 통합 테스트", () => {
  let caller: ReturnType<typeof createCaller>;

  beforeAll(async () => {
    const ctx = await createTestContext({ role: "teacher" });
    caller = createCaller(ctx);
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  it("문항을 생성하고 조회할 수 있다", async () => {
    const created = await caller.item.create({
      title: "일차방정식 기초",
      stem: "$2x + 3 = 7$에서 $x$의 값을 구하시오.",
      answer: "2",
      itemType: "short_answer",
      gradeLevel: 1,
      difficulty: 2,
    });

    expect(created.id).toBeDefined();
    expect(created.version).toBe(1);

    const fetched = await caller.item.getById({ id: created.id });
    expect(fetched.title).toBe("일차방정식 기초");
    expect(fetched.versions).toHaveLength(1);
  });
});
```

### 11.4 E2E 테스트 (Playwright)

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

### 11.5 CI 파이프라인

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  test-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:unit -- --coverage

  test-integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg17
        env:
          POSTGRES_DB: test_math_item_os
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: test
        ports: ["5432:5432"]
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
      meilisearch:
        image: getmeili/meilisearch:v1.12
        env:
          MEILI_MASTER_KEY: test-key
        ports: ["7700:7700"]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:push   # Prisma 스키마 적용
      - run: pnpm test:integration
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test_math_item_os
          REDIS_URL: redis://localhost:6379
          MEILISEARCH_HOST: http://localhost:7700
          MEILISEARCH_MASTER_KEY: test-key
```

---

## 12. 모니터링 및 로깅

### 12.1 구조화 로깅

```typescript
// apps/web/src/server/lib/logger.ts
import pino from "pino";

// 구조화 로거 — JSON 형식 출력
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",

  // 프로덕션: JSON, 개발: pretty-print
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,

  // 기본 필드
  base: {
    service: "math-item-os",
    env: process.env.NODE_ENV,
  },

  // 민감 정보 제거
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.hashedPassword",
      "*.token",
    ],
    remove: true,
  },

  // 직렬화 설정
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

// 요청별 자식 로거 생성
export function createRequestLogger(requestId: string, userId?: string) {
  return logger.child({ requestId, userId });
}
```

### 12.2 로그 레벨 가이드라인

| 레벨 | 사용 상황 | 예시 |
|------|----------|------|
| `error` | 시스템 장애, 복구 불가 오류 | DB 연결 실패, 인증 서비스 다운 |
| `warn` | 비정상이지만 복구 가능 | Meilisearch 동기화 지연, 캐시 미스 |
| `info` | 비즈니스 이벤트 | 문항 생성, 업로드 완료, 로그인 |
| `debug` | 개발/디버깅용 상세 정보 | SQL 쿼리, 요청/응답 본문 |

### 12.3 감사 로깅

```typescript
// 감사 로그는 DB에 영구 저장 (삭제 불가)
// Prisma 모델:
//   AuditLog {
//     id          String
//     action      String      // "item.create", "item.update", "upload.start"
//     entityType  String      // "item", "upload", "user"
//     entityId    String
//     userId      String
//     orgId       String
//     changes     Json?       // 변경 전/후 diff
//     metadata    Json?       // IP, User-Agent 등
//     createdAt   DateTime
//   }

// tRPC auditMiddleware에서 자동 기록
// 별도 삭제 API 없음 — 규정 준수용 영구 보관
```

### 12.4 에러 추적 (Sentry)

```typescript
// apps/web/src/app/global-error.tsx
// Sentry 에러 바운더리 — 클라이언트 오류 자동 수집

// apps/web/src/server/trpc/trpc.ts
// tRPC errorFormatter에서 서버 오류 Sentry 전송

// 알림 규칙:
// - ERROR 레벨: Slack #alerts 채널 즉시 알림
// - 동일 에러 10건/분: P1 알림 (당직 담당)
// - 업로드 실패율 > 5%: 관리자 이메일
```

### 12.5 성능 모니터링

```
Vercel Analytics (내장):
  - Web Vitals (LCP, FID, CLS)
  - 서버리스 함수 실행 시간
  - 콜드 스타트 빈도

커스텀 메트릭 (pino + 대시보드):
  - 검색 응답 시간 (p50, p95, p99)
  - Meilisearch 동기화 지연 시간
  - 업로드 처리 시간 (건당)
  - DB 쿼리 시간 (느린 쿼리 > 1초 경고)
  - 캐시 히트율

헬스체크 엔드포인트:
  GET /api/health
  → { status, db, redis, meilisearch, uptime }
```

---

## 13. Phase 1 -> Phase 2 마이그레이션 경로

### 13.1 Phase 1에서 미리 준비할 것

| 영역 | Phase 1 구현 | Phase 2 대비 설계 |
|------|-------------|------------------|
| **DB 스키마** | Item, Skill, Standard, Solution 테이블 | `embedding` 벡터 열 예약 (nullable), misconception 테이블 스키마만 정의 |
| **유사 문항** | 스킬 기반 단순 매칭 | pgvector 확장 설치 + 인덱스 생성 준비, embedding 생성 배치 스크립트 골격 |
| **AI 서비스** | Python 마이크로서비스 골격 (FastAPI + SymPy) | Claude API 연동 인터페이스 정의, 프롬프트 템플릿 구조 |
| **검색** | Meilisearch 키워드 검색 | 시맨틱 검색용 벡터 인덱스 설계 문서, hybrid search 전환 계획 |
| **피처 플래그** | FEATURE_AI_SIMILARITY=false, FEATURE_ITEM_GENERATION=false | Phase 2 기능을 피처 플래그로 숨긴 채 코드 진입점만 준비 |
| **데이터 모델** | Item에 source, version 포함 | Assignment, Response, StudentProfile 스키마 초안 |
| **인프라** | Supabase + Vercel | AWS 전환용 Terraform 모듈 초안, Docker Compose → ECS 매핑 문서 |

### 13.2 Phase 2 범위 (예정)

```
Phase 2 (4-6개월, Phase 1 완료 후):
  ├── pgvector 유사 문항 검색
  │   - 문항 임베딩 생성 (Claude API / sentence-transformers)
  │   - 벡터 유사도 + 스킬 유사도 하이브리드 랭킹
  │
  ├── AI 문항 생성 (Claude API)
  │   - 템플릿 기반 변형 생성
  │   - 난이도 조절 생성
  │   - POST /items/{id}/generate-easier
  │
  ├── 오개념 그래프
  │   - Misconception 모델
  │   - 문항 ↔ 오개념 연결
  │   - 오개념 경로 시각화
  │
  ├── SymPy/Z3 정답 검증
  │   - 수식 동치성 검사
  │   - 다양한 정답 형태 자동 인식
  │
  ├── Assignment 서비스
  │   - 학습지/숙제 생성
  │   - PDF 출력
  │   - 학생 응답 수집
  │
  └── 인프라 전환
      - Supabase → AWS RDS
      - Vercel → AWS (ECS + CloudFront)
      - 모니터링: Datadog 또는 Grafana
```

### 13.3 마이그레이션 안전 규칙

```
1. DB 스키마 변경:
   - 항상 additive migration (열 추가는 OK, 삭제/이름변경은 2단계)
   - Phase 2 열은 nullable로 추가
   - 기존 데이터 무결성 검증 스크립트 필수

2. API 변경:
   - tRPC 라우터 추가는 자유
   - 기존 입력 스키마 변경 시 .optional() 또는 .default() 사용
   - Breaking change 시 새 프로시저 생성 후 deprecation 기간

3. 인프라 전환:
   - Blue-Green 배포로 무중단 전환
   - DNS 전환 전 양쪽 환경 동시 운영 (최소 1주)
   - 데이터 마이그레이션 스크립트 dry-run 필수

4. 피처 플래그:
   - Phase 2 기능은 반드시 피처 플래그로 감싼다
   - 플래그 OFF 상태에서 기존 기능 영향 없음을 테스트
   - 점진적 롤아웃: 내부 → 베타 → 전체
```

---

## Prisma 스키마 (참고)

```prisma
// packages/db/prisma/schema.prisma

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearch", "postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  directUrl  = env("DIRECT_URL")
  extensions = [pgvector, ltree]
}

// ─── 인증 ───

model User {
  id              String    @id @default(cuid())
  email           String    @unique
  name            String?
  hashedPassword  String?
  image           String?
  role            String    @default("teacher") // admin, content-ops, teacher, student
  organizationId  String?
  emailVerified   DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  organization    Organization? @relation(fields: [organizationId], references: [id])
  accounts        Account[]
  sessions        Session[]
  createdItems    Item[]        @relation("ItemCreatedBy")
  updatedItems    Item[]        @relation("ItemUpdatedBy")
  itemVersions    ItemVersion[]
  uploadJobs      UploadJob[]
  auditLogs       AuditLog[]

  @@index([organizationId])
  @@index([email])
}

model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users     User[]
  items     Item[]
  uploadJobs UploadJob[]

  @@index([slug])
}

// Auth.js 필수 모델
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ─── 문항 ───

model Item {
  id                   String    @id @default(cuid())
  title                String
  stem                 String    @db.Text    // 문항 본문 (LaTeX 인라인 마크업 포함)
  stemLatex            String?   @db.Text    // 순수 LaTeX 수식
  stemHtml             String?   @db.Text    // KaTeX SSR HTML
  stemPlainText        String?   @db.Text    // 검색용 순수 텍스트 (LaTeX 제거)

  itemType             String                // multiple_choice, short_answer, essay, etc.
  answer               String    @db.Text    // 정답
  answerLatex          String?   @db.Text

  gradeLevel           Int                   // 학년 (1-3)
  difficulty           Int                   // 난이도 (1-5)
  estimatedTimeSeconds Int?                  // 예상 풀이 시간 (초)

  status               String    @default("draft") // draft, review, published, archived
  version              Int       @default(1)
  archivedAt           DateTime?

  // Phase 2 대비 예약 필드
  // embedding         Unsupported("vector(1536)")?

  // 출처
  sourceType           String?               // textbook, exam, original, modified, external
  sourceName           String?
  sourceYear           Int?
  sourcePage           Int?
  sourcePublisher      String?

  // 소유자
  organizationId       String
  createdById          String
  updatedById          String?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  // 관계
  organization Organization @relation(fields: [organizationId], references: [id])
  createdBy    User          @relation("ItemCreatedBy", fields: [createdById], references: [id])
  updatedBy    User?         @relation("ItemUpdatedBy", fields: [updatedById], references: [id])
  choices      Choice[]
  solution     Solution?
  versions     ItemVersion[]
  skills       Skill[]       @relation("ItemSkills")
  standards    Standard[]    @relation("ItemStandards")
  tags         Tag[]         @relation("ItemTags")
  reviewTasks  ReviewTask[]

  @@index([organizationId, status])
  @@index([organizationId, gradeLevel])
  @@index([organizationId, createdById])
  @@index([createdAt])
  @@index([updatedAt])
}

model Choice {
  id           String  @id @default(cuid())
  itemId       String
  label        String              // "1", "2", "3", "4", "5"
  content      String  @db.Text
  contentLatex String? @db.Text
  contentHtml  String? @db.Text
  isCorrect    Boolean
  order        Int

  item Item @relation(fields: [itemId], references: [id], onDelete: Cascade)

  @@index([itemId])
}

model Solution {
  id           String  @id @default(cuid())
  itemId       String  @unique
  content      String  @db.Text
  contentLatex String? @db.Text
  contentHtml  String? @db.Text

  item  Item           @relation(fields: [itemId], references: [id], onDelete: Cascade)
  steps SolutionStep[]
}

model SolutionStep {
  id          String  @id @default(cuid())
  solutionId  String
  order       Int
  description String @db.Text
  latex       String? @db.Text
  html        String? @db.Text

  solution Solution @relation(fields: [solutionId], references: [id], onDelete: Cascade)

  @@index([solutionId])
}

// ─── 버전 관리 ───

model ItemVersion {
  id          String   @id @default(cuid())
  itemId      String
  version     Int
  snapshot    Json                 // 해당 시점의 전체 문항 스냅샷
  changeNote  String?  @db.Text
  createdById String
  createdAt   DateTime @default(now())

  item      Item @relation(fields: [itemId], references: [id], onDelete: Cascade)
  createdBy User @relation(fields: [createdById], references: [id])

  @@unique([itemId, version])
  @@index([itemId])
}

// ─── 스킬/교육과정 ───

model Skill {
  id          String  @id @default(cuid())
  name        String
  code        String  @unique      // "ALG.EQ.LINEAR.001"
  path        String               // ltree: "algebra.equations.linear"
  description String? @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  items         Item[]              @relation("ItemSkills")
  prerequisites SkillPrerequisite[] @relation("SkillPrereqs")
  dependents    SkillPrerequisite[] @relation("SkillDependents")

  @@index([code])
  @@index([path])
}

model SkillPrerequisite {
  id              String @id @default(cuid())
  skillId         String
  prerequisiteId  String
  strength        String @default("required") // required, recommended
  order           Int    @default(0)

  skill        Skill @relation("SkillPrereqs", fields: [skillId], references: [id])
  prerequisite Skill @relation("SkillDependents", fields: [prerequisiteId], references: [id])

  @@unique([skillId, prerequisiteId])
  @@index([skillId])
}

model Standard {
  id          String  @id @default(cuid())
  name        String
  code        String  @unique      // "M-8-A-01"
  curriculum  String               // "2022 개정 교육과정"
  subject     String               // "수학"
  gradeLevel  Int
  domain      String               // "대수"
  description String? @db.Text
  createdAt   DateTime @default(now())

  items Item[] @relation("ItemStandards")

  @@index([code])
  @@index([curriculum, gradeLevel])
}

model Tag {
  id        String   @id @default(cuid())
  name      String   @unique
  category  String?              // "topic", "concept", "skill-type"
  createdAt DateTime @default(now())

  items Item[] @relation("ItemTags")

  @@index([name])
}

// ─── 업로드 ───

model UploadJob {
  id              String    @id @default(cuid())
  fileName        String
  fileType        String               // csv, json, qti, hwp
  fileSizeBytes   Int
  columnMapping   Json?
  status          String    @default("pending") // pending, processing, completed, failed
  totalItems      Int?
  processedItems  Int       @default(0)
  successCount    Int       @default(0)
  errorCount      Int       @default(0)
  errors          Json?                // [{ row, field, message }]
  organizationId  String
  createdById     String
  createdAt       DateTime  @default(now())
  completedAt     DateTime?

  organization Organization @relation(fields: [organizationId], references: [id])
  createdBy    User          @relation(fields: [createdById], references: [id])

  @@index([organizationId, status])
}

// ─── 검수 ───

model ReviewTask {
  id          String    @id @default(cuid())
  itemId      String
  type        String               // "new_upload", "content_edit", "quality_check"
  status      String    @default("pending") // pending, approved, rejected
  assigneeId  String?
  comment     String?   @db.Text
  resolvedAt  DateTime?
  createdAt   DateTime  @default(now())

  item Item @relation(fields: [itemId], references: [id])

  @@index([status])
  @@index([itemId])
}

// ─── 동기화 큐 ───

model SyncQueue {
  id          String    @id @default(cuid())
  entityType  String               // "item", "skill", "standard"
  entityId    String
  operation   String               // "create", "update", "delete"
  status      String    @default("pending") // pending, processing, done, failed
  attempts    Int       @default(0)
  error       String?   @db.Text
  createdAt   DateTime  @default(now())
  processedAt DateTime?

  @@index([status, createdAt])
}

// ─── 감사 로그 ───

model AuditLog {
  id         String   @id @default(cuid())
  action     String               // "item.create", "item.update", "upload.start"
  entityType String
  entityId   String
  userId     String
  orgId      String?
  changes    Json?                // { before, after } diff
  metadata   Json?                // { ip, userAgent }
  createdAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([entityType, entityId])
  @@index([userId])
  @@index([createdAt])
}
```

---

> **문서 끝** | 이 아키텍처는 Phase 1 MVP 범위에 초점을 맞추되, Phase 2 확장을 위한 진입점을 미리 준비합니다.
> 구현 시작 전 이 문서를 팀과 리뷰하고, 각 섹션별 구현 순서는 별도 태스크 목록에서 관리합니다.
