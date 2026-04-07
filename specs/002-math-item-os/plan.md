# Implementation Plan: Math Knowledge Graph + Item OS

**Branch**: `002-math-item-os` | **Date**: 2026-04-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-math-item-os/spec.md`

## Summary

LaTeX 수식 기반 수학 문항을 저장/분류/검색/추천/생성하는 교사 전용 플랫폼.
문항을 LaTeX + MathML + SymPy AST 3중 표현으로 관리하고, 스킬 선수학습 DAG,
오개념 교정 경로, 구조적 유사문항 검색을 통해 교사가 "목적에 맞는 문항 세트"를
30초 이내에 완성할 수 있도록 한다.

기술적으로 TypeScript 모노레포(Next.js 15 + tRPC 11 + Prisma 6)를 메인으로,
수학 연산은 Python FastAPI + SymPy 마이크로서비스로 분리.
PostgreSQL 17(pgvector + ltree) + Meilisearch + Redis 인프라 구성.

## Technical Context

**Language/Version**: TypeScript 5.7.x (primary), Python 3.11+ (AI microservice)
**Primary Dependencies**: Next.js 15, tRPC 11, Prisma 6, KaTeX 0.16, SymPy 1.13, Auth.js v5
**Storage**: PostgreSQL 17 (pgvector, ltree, pg_trgm) + Meilisearch 1.12 + Redis 7.x
**Testing**: Vitest 2.x (unit/integration) + Playwright 1.49 (E2E) + MSW 2.x (API mock)
**Target Platform**: Web (Vercel + Supabase hosted)
**Project Type**: Web service (Turborepo monorepo)
**Performance Goals**: Search p95 < 1.5s @ 80K items, CAS generation < 10s/item
**Constraints**: CAS verification 95%+ pass rate, MVP = middle school algebra only
**Scale/Scope**: 80K+ items, 1-2 person team, $75-135/month infrastructure

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Gate

| # | Principle | Status | Evidence |
|---|-----------|--------|----------|
| I | Math Representation Integrity | PASS | 3중 표현(LaTeX+MathML+SymPy) 설계 완료. KaTeX(렌더링) + SymPy(검증) 파이프라인 정의. 변환 실패 시 `conversion_failed` 상태로 격리 (Constitution I 준수) |
| II | Explainable Knowledge Structure | PASS | 유사문항 랭킹 6개 신호 + 가중치 정의. 추천 이벤트에 reasoning JSONB 필수 저장. DAG 순환 감지 CHECK 제약 (Constitution II 준수) |
| III | Automated Correctness Verification | PASS | SymPy 기반 정답 동치성/유일해 검증. 10초 타임아웃. 실패 시 배포 금지. AI 생성 라벨 불변. 배치 95%+ 통과율 요구 (Constitution III 준수) |
| IV | Curriculum-Aligned Data Integrity | PASS | 2022 개정 교육과정 CASE 포맷. ltree 계층 분류. 메타데이터 완전성 95%+. quality_status 상태 머신 + 감사 로그 (Constitution IV 준수) |

**Gate Result**: ALL PASS. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/002-math-item-os/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: Technology decisions
├── data-model.md        # Phase 1: Entity definitions
├── quickstart.md        # Phase 1: Development setup
├── contracts/           # Phase 1: API contracts
│   ├── item-router.md
│   ├── search-router.md
│   ├── skill-router.md
│   └── admin-router.md
└── tasks.md             # Phase 2: Task breakdown (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── db/                    # Prisma schema + migrations + seed
│   ├── prisma/schema.prisma
│   ├── client.ts
│   └── seed.ts
├── shared/                # Validators, types, constants
│   ├── validators/
│   ├── types/
│   └── constants/
└── math-parser/           # LaTeX/KaTeX/MathML parsing
    └── src/

apps/
└── web/                   # Next.js 15 main application
    ├── src/
    │   ├── app/           # App Router pages + API routes
    │   │   ├── api/trpc/[trpc]/route.ts
    │   │   ├── api/auth/[...nextauth]/route.ts
    │   │   └── (dashboard)/
    │   ├── server/        # tRPC routers + services
    │   │   ├── routers/   # item, search, skill, admin, upload
    │   │   ├── services/  # business logic
    │   │   └── middleware/ # auth, rbac, audit
    │   ├── components/    # React components
    │   │   ├── ui/        # shadcn/ui
    │   │   ├── math/      # KaTeX renderer, formula editor
    │   │   ├── items/     # item list, detail, editor
    │   │   └── search/    # search bar, filters, results
    │   └── lib/           # tRPC client, utilities
    └── public/

services/
└── math-ai/               # Python FastAPI microservice
    ├── app/
    │   ├── main.py
    │   ├── routers/       # validate, similarity, generate
    │   ├── services/      # sympy_solver, embedding
    │   └── models/        # pydantic schemas
    ├── Dockerfile
    └── requirements.txt

tests/
├── unit/
├── integration/
├── e2e/                   # Playwright
├── fixtures/
│   ├── items/             # Reference math items
│   └── curriculum/        # 2022 curriculum CASE data
└── helpers/
```

**Structure Decision**: Turborepo 모노레포 (Option 2: Web application 변형).
TypeScript 앱 + Python 마이크로서비스 분리. `packages/` 공유 코드,
`apps/web/` Next.js 앱, `services/math-ai/` SymPy 서비스.

## Complexity Tracking

> Constitution Check ALL PASS - No violations to justify.

## Implementation Phases

### Phase 1: Core Item Bank (MVP, 3-4개월)

목표: 문항 등록/검색/분류가 가능한 기본 시스템

1. T3 Stack 프로젝트 초기화 (Turborepo + pnpm)
2. PostgreSQL 17 스키마 + Prisma 마이그레이션
3. Auth.js v5 + RBAC (시스템 관리자, 콘텐츠 검수자)
4. Item CRUD + 3중 표현 변환 파이프라인
5. KaTeX + MathML 렌더러
6. Meilisearch 한국어 검색 + 구조 필터
7. CSV/JSON/QTI 일괄 업로드 (1만건/회)
8. 문항 버전 관리 + 품질 상태 머신
9. 감사 로그

### Phase 2: Knowledge Graph (2-3개월)

10. 선수학습 DAG (recursive CTE)
11. 유사문항 검색 (pgvector + skill 랭킹)
12. 오개념 태깅 + 교정 경로
13. React Flow 그래프 시각화
14. 2022 개정 교육과정 CASE 데이터

### Phase 3: Generation + Validation (3-4개월)

15. Python FastAPI + SymPy 마이크로서비스
16. 템플릿 기반 변형 생성
17. CAS 자동 검증 (정답 동치, 유일해)
18. 해설 자동 생성 (Claude API)

### Phase 4: Dashboard + Operations (2-3개월)

19. 학습지 제작 (PDF 출력)
20. 검수 큐 + 품질 대시보드
21. 난이도 보정 배치

## Post-Design Constitution Re-Check

| # | Principle | Status | Design Evidence |
|---|-----------|--------|-----------------|
| I | Math Representation Integrity | PASS | `item` 테이블에 body_latex/body_mathml/body_sympy 3열. `item_version`으로 불변 이력. 변환 실패 시 body_sympy NULL + metadata에 에러 기록 |
| II | Explainable Knowledge Structure | PASS | `recommendation_event.reasoning` JSONB. `item_similarity` 테이블에 method별 점수. `prerequisite_edge` 테이블에 DAG 간선 + self-reference CHECK |
| III | Automated Correctness Verification | PASS | `services/math-ai/` SymPy 서비스. `item.is_generated` + `quality_status` 상태 머신. `variant.generation_log` 검증 이력 |
| IV | Curriculum-Aligned Data Integrity | PASS | `standard` + `skill` 테이블에 ltree. `item_skill`/`item_standard` M:N. `audit_log` 트리거. `difficulty_profile` 4중 난이도 |

**Post-Design Gate Result**: ALL PASS.
