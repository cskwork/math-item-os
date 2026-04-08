# Tasks: Math Knowledge Graph + Item OS

**Input**: Design documents from `/specs/002-math-item-os/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested. Test tasks are omitted. Use TDD workflow during implementation.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Exact file paths included in descriptions

## Path Conventions

Turborepo monorepo:

- `packages/db/` - Prisma schema, migrations, seed
- `packages/shared/` - Validators, types, constants
- `packages/math-parser/` - LaTeX/KaTeX/MathML parsing
- `apps/web/` - Next.js 15 app
- `services/math-ai/` - Python FastAPI microservice
- `tests/` - unit, integration, e2e

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Turborepo monorepo 초기화 및 개발 환경 구성

- [x] T001 Create Turborepo monorepo with pnpm workspace config in turbo.json and pnpm-workspace.yaml
- [x] T002 [P] Create Docker Compose config (PostgreSQL 17 + pgvector/ltree/pg_trgm, Redis 7, Meilisearch 1.12) in docker-compose.yml
- [x] T003 [P] Create environment config template with validation in .env.example
- [x] T004 [P] Configure ESLint, Prettier, and TypeScript base config in root and per-package tsconfig
- [x] T005 [P] Initialize apps/web as Next.js 15 App Router project with Tailwind CSS
- [x] T006 [P] Initialize services/math-ai Python FastAPI scaffold with app/main.py, Dockerfile, and requirements.txt

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 User Story가 의존하는 핵심 인프라. 이 단계 완료 전 US 작업 불가.

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Define Prisma schema with all entities (Item, ItemVersion, Skill, PrerequisiteEdge, Standard, Misconception, DifficultyProfile, Solution, Template, Variant, Assignment, RecommendationEvent, AuditLog) and enums in packages/db/prisma/schema.prisma
- [x] T008 Run initial Prisma migration and export typed client in packages/db/client.ts
- [x] T009 [P] Create Zod input validators for item, search, skill, admin contracts in packages/shared/validators/
- [x] T010 [P] Create TypeScript type definitions (Item, Skill, Standard, Misconception, etc.) in packages/shared/types/
- [x] T011 [P] Create enum constants (SchoolLevel, ItemType, FormulaType, AnswerFormat, QualityStatus, UsagePurpose, etc.) in packages/shared/constants/
- [x] T012 Configure Auth.js v5 with Prisma adapter and Google OAuth in apps/web/src/app/api/auth/[...nextauth]/route.ts
- [x] T013 Implement RBAC middleware (admin, reviewer, teacher roles) in apps/web/src/server/middleware/rbac.ts
- [x] T014 Setup tRPC v11 server with appRouter, context, and auth middleware in apps/web/src/server/trpc.ts and apps/web/src/app/api/trpc/[trpc]/route.ts
- [x] T015 [P] Setup tRPC client with React Query in apps/web/src/lib/trpc.ts
- [x] T016 [P] Create audit log service (immutable INSERT, UPDATE/DELETE blocked) in apps/web/src/server/services/audit.service.ts
- [x] T017 [P] Install shadcn/ui and create dashboard layout with sidebar navigation in apps/web/src/components/ui/ and apps/web/src/app/(dashboard)/layout.tsx
- [x] T018 [P] Create KaTeX renderer component (server + client dual rendering, MathML output) in packages/math-parser/src/renderer.ts and apps/web/src/components/math/katex-renderer.tsx
- [x] T019 Create seed data script (50 skills, 30 standards, 20 misconceptions, 80 prerequisite edges, 100 sample items) in packages/db/seed.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 수학 문항 등록 및 수식 렌더링 (Priority: P1) MVP

**Goal**: LaTeX 수식 포함 문항을 등록하면 KaTeX 렌더링 + LaTeX/MathML/SymPy AST 3중 변환 저장. 버전 관리 + 품질 상태 머신 + CSV/JSON/QTI 일괄 업로드.

**Independent Test**: LaTeX 수식 포함 문항 10건 등록 후 브라우저 렌더링 + CAS 트리 생성 확인. 수정 시 버전 이력 보존 확인.

**Contracts**: item.create, item.update, item.updateStatus, item.getById, item.list, item.bulkUpload, item.getBulkUploadStatus

### Implementation for User Story 1

- [x] T020 [P] [US1] Implement LaTeX-to-MathML converter (KaTeX renderToMathMLTree) in packages/math-parser/src/latex-to-mathml.ts
- [x] T021 [P] [US1] Create /convert/latex-to-sympy endpoint in services/math-ai/app/routers/validate.py with SymPy parse_latex
- [x] T022 [US1] Implement 3중 변환 pipeline (LaTeX -> MathML + SymPy AST, 실패 시 body_sympy NULL) in apps/web/src/server/services/conversion.service.ts
- [x] T023 [US1] Implement item service (create with 3중 변환, update with version, getById, list with pagination) in apps/web/src/server/services/item.service.ts
- [x] T024 [P] [US1] Implement quality status state machine (draft->reviewed->approved->retired, approved->draft 역전이) in apps/web/src/server/services/quality-status.service.ts
- [x] T025 [US1] Create item tRPC router (create, update, updateStatus, getById, list) in apps/web/src/server/routers/item.router.ts
- [x] T026 [P] [US1] Create formula editor component with live KaTeX preview in apps/web/src/components/math/formula-editor.tsx
- [x] T027 [P] [US1] Create item card component (수식 미리보기, 메타 태그 표시) in apps/web/src/components/items/item-card.tsx
- [x] T028 [US1] Create item creation/edit page with formula editor in apps/web/src/app/(dashboard)/items/new/page.tsx
- [x] T029 [P] [US1] Create item list page with pagination and status filter in apps/web/src/app/(dashboard)/items/page.tsx
- [x] T030 [P] [US1] Create item detail page with version history and rendered math in apps/web/src/app/(dashboard)/items/[id]/page.tsx
- [x] T031 [US1] Implement bulk upload service (CSV/JSON/QTI parsing, BullMQ job, 1만건 제한) in apps/web/src/server/services/upload.service.ts
- [x] T032 [US1] Add bulkUpload and getBulkUploadStatus to item router in apps/web/src/server/routers/item.router.ts
- [x] T033 [US1] Create bulk upload page with progress tracking and error report in apps/web/src/app/(dashboard)/items/upload/page.tsx

**Checkpoint**: 문항 등록/조회/수정/상태관리/일괄업로드 독립 동작 확인

---

## Phase 4: User Story 2 - 교육과정 기반 문항 분류 및 검색 (Priority: P1)

**Goal**: 학제/학년/단원/스킬/난이도/유형 메타데이터로 분류하고, 한국어 자연어 + 구조 필터 하이브리드 검색으로 1.5초 내 결과 반환.

**Independent Test**: 1,000건+ 문항에서 "중2 일차방정식 분배법칙 중급 난이도" 검색 시 1.5초 이내 결과 확인.

**Contracts**: search.items

### Implementation for User Story 2

- [x] T034 [P] [US2] Implement Meilisearch sync service (item CRUD 시 인덱스 동기화, CJK 토크나이저 설정) in apps/web/src/server/services/meilisearch.service.ts
- [x] T035 [P] [US2] Implement metadata tagging service (스킬/성취기준/오개념 연결, ltree 분류) in apps/web/src/server/services/metadata.service.ts
- [x] T036 [US2] Create search tRPC router (search.items with hybrid Meilisearch + PostgreSQL filter) in apps/web/src/server/routers/search.router.ts
- [x] T037 [P] [US2] Create search bar component with Korean autocomplete in apps/web/src/components/search/search-bar.tsx
- [x] T038 [P] [US2] Create search filter panel (학제, 학년, 스킬, 난이도, 유형, 목적) in apps/web/src/components/search/filter-panel.tsx
- [x] T039 [P] [US2] Create search results component with faceted counts and KaTeX preview in apps/web/src/components/search/search-results.tsx
- [x] T040 [US2] Create search page combining search bar, filters, and results in apps/web/src/app/(dashboard)/search/page.tsx
- [x] T041 [US2] Hook Meilisearch sync into item create/update/delete workflows in apps/web/src/server/services/item.service.ts

**Checkpoint**: 문항 분류 + 한국어 검색 + 구조 필터 독립 동작 확인. p95 < 1.5s 성능 검증.

---

## Phase 5: User Story 3 - 선수학습 그래프 탐색 (Priority: P2)

**Goal**: 스킬 간 선수학습 DAG를 시각적 그래프로 탐색. 각 노드에서 문항 목록 이동 가능.

**Independent Test**: "일차방정식 풀기" 스킬 선택 시 선수 스킬 DAG 시각화 + 노드 클릭으로 문항 목록 이동 확인.

**Contracts**: skill.create, skill.createPrerequisite, skill.getPrerequisiteGraph, skill.list, skill.getItems

### Implementation for User Story 3

- [x] T042 [P] [US3] Implement skill service (CRUD, ltree path management) in apps/web/src/server/services/skill.service.ts
- [x] T043 [P] [US3] Implement prerequisite edge service (DAG cycle detection via recursive CTE, self-reference check) in apps/web/src/server/services/prerequisite.service.ts
- [x] T044 [US3] Create skill tRPC router (create, list, getItems, createPrerequisite, getPrerequisiteGraph) in apps/web/src/server/routers/skill.router.ts
- [x] T045 [US3] Implement graph traversal query (recursive CTE for ancestor/descendant DAG, item count per node) in apps/web/src/server/services/prerequisite.service.ts
- [x] T046 [US3] Create React Flow DAG visualization component (nodes with item count + difficulty distribution) in apps/web/src/components/skills/skill-graph.tsx
- [x] T047 [P] [US3] Create skill-to-items drill-down component in apps/web/src/components/skills/skill-items-panel.tsx
- [x] T048 [US3] Create skill graph exploration page in apps/web/src/app/(dashboard)/skills/graph/page.tsx
- [x] T049 [P] [US3] Create skill management CRUD page in apps/web/src/app/(dashboard)/skills/page.tsx

**Checkpoint**: 스킬 DAG 시각화 + 노드별 문항 조회 독립 동작 확인

---

## Phase 6: User Story 4 - 구조적 유사문항 검색 (Priority: P2)

**Goal**: 수식 구조/스킬/난이도/오개념 기반 6개 신호 결합 유사문항 랭킹. 각 결과에 유사 근거 설명 포함.

**Independent Test**: `2(x-3)=10` 문항 유사문항 검색 시 구조적 유사 문항이 상위 랭킹되고 근거 설명 표시 확인.

**Contracts**: search.similar, search.similarFeedback

### Implementation for User Story 4

- [x] T050 [P] [US4] Implement embedding generation endpoint (sentence-transformers) in services/math-ai/app/routers/similarity.py
- [x] T051 [P] [US4] Implement embedding sync service (item 생성 시 pgvector 저장) in apps/web/src/server/services/embedding.service.ts
- [x] T052 [US4] Implement 6-signal similarity ranking service (skill 0.30, formula 0.20, prerequisite 0.15, text 0.15, difficulty 0.10, misconception 0.10) in apps/web/src/server/services/similarity.service.ts
- [x] T053 [US4] Add search.similar and search.similarFeedback to search router in apps/web/src/server/routers/search.router.ts
- [x] T054 [P] [US4] Create similar items panel component with signal breakdown and explanation in apps/web/src/components/search/similar-items-panel.tsx
- [x] T055 [US4] Integrate similar items panel into item detail page in apps/web/src/app/(dashboard)/items/[id]/page.tsx
- [x] T056 [US4] Implement similarity feedback UI (relevant/not relevant) with RecommendationEvent logging in apps/web/src/components/search/similarity-feedback.tsx

**Checkpoint**: 유사문항 검색 + 6신호 랭킹 + 피드백 기록 독립 동작 확인

---

## Phase 7: User Story 5 - 오개념 기반 교정 문항 추천 (Priority: P3)

**Goal**: 오개념 선택 시 진단 문항 + 단계별 교정 경로(선수 복습 -> 기초 연습 -> 확인) 추천. 추천 근거 포함.

**Independent Test**: "sign_error_transposition" 오개념 선택 시 교정 경로 3단계 문항 추천 + 근거 표시 확인.

**Contracts**: skill.listMisconceptions, skill.createMisconception, skill.getRemediationPath

### Implementation for User Story 5

- [ ] T057 [P] [US5] Implement misconception service (CRUD, related skills mapping) in apps/web/src/server/services/misconception.service.ts
- [ ] T058 [P] [US5] Implement remediation path algorithm (prerequisite_review -> basic_practice -> confirmation 3단계) in apps/web/src/server/services/remediation.service.ts
- [ ] T059 [US5] Add listMisconceptions, createMisconception, getRemediationPath to skill router in apps/web/src/server/routers/skill.router.ts
- [ ] T060 [P] [US5] Create misconception selector component in apps/web/src/components/skills/misconception-selector.tsx
- [ ] T061 [US5] Create remediation path display component (3-phase stepped view with explanations) in apps/web/src/components/skills/remediation-path.tsx
- [ ] T062 [US5] Create misconception exploration page with remediation recommendations in apps/web/src/app/(dashboard)/misconceptions/page.tsx
- [ ] T063 [US5] Implement RecommendationEvent logging for remediation recommendations in apps/web/src/server/services/recommendation.service.ts

**Checkpoint**: 오개념 선택 -> 교정 경로 추천 -> 추천 근거 표시 독립 동작 확인

---

## Phase 8: User Story 6 - 템플릿 기반 유사문항 자동 생성 (Priority: P3)

**Goal**: 기존 문항 기반 변형 생성 (풀이 단계/계수 범위/표현형 제어). CAS 자동 검증 (정답 동치성, 유일해). 실패 시 배포 금지. AI 생성 라벨 자동 부착.

**Independent Test**: `2(x-3)=10` 기반 변형 5건 생성, 정답 CAS 검증 통과, AI 생성 라벨 확인.

**Contracts**: admin.listTemplates, admin.generateVariants, admin.getGenerationResult

### Implementation for User Story 6

- [ ] T064 [P] [US6] Implement SymPy solver service (solve, simplify, equals check) in services/math-ai/app/services/sympy_solver.py
- [ ] T065 [P] [US6] Implement variant generation service (template parameter substitution, constraint validation) in services/math-ai/app/services/generator.py
- [ ] T066 [US6] Create /generate and /verify CAS endpoints in services/math-ai/app/routers/generate.py
- [ ] T067 [US6] Implement template service (CRUD, variant count tracking) in apps/web/src/server/services/template.service.ts
- [ ] T068 [US6] Implement variant generation orchestrator (math-ai call, CAS verification, BullMQ async, is_generated=true) in apps/web/src/server/services/generation.service.ts
- [ ] T069 [US6] Add listTemplates, generateVariants, getGenerationResult to admin router in apps/web/src/server/routers/admin.router.ts
- [ ] T070 [P] [US6] Create template editor component (parameter definition, constraint config) in apps/web/src/components/admin/template-editor.tsx
- [ ] T071 [US6] Create variant generation page with parameter controls and CAS result display in apps/web/src/app/(dashboard)/admin/generate/page.tsx

**Checkpoint**: 템플릿 변형 생성 + CAS 검증 + AI 라벨 독립 동작 확인. 1건 < 10초, 통과율 95%+.

---

## Phase 9: User Story 7 - 목적별 학습지 제작 (Priority: P4)

**Goal**: 진단/보충/시험직전/심화 목적 선택 + 학생 수준 지정 -> 추천 문항 세트 -> 교사 조정 -> PDF/링크 출력. 30초 이내 완성.

**Independent Test**: "중2 일차방정식 보충용 쉬운 난이도 5문항" 학습지 30초 내 완성 + PDF 출력 확인.

**Contracts**: admin.createAssignment, admin.exportAssignment

### Implementation for User Story 7

- [ ] T072 [US7] Implement assignment service (create, item ordering, purpose-based recommendation) in apps/web/src/server/services/assignment.service.ts
- [ ] T073 [US7] Implement item recommendation engine for assignments (목적/난이도/스킬 조합 추천 + 근거) in apps/web/src/server/services/assignment-recommend.service.ts
- [ ] T074 [US7] Add createAssignment and exportAssignment to admin router in apps/web/src/server/routers/admin.router.ts
- [ ] T075 [US7] Implement PDF generation service (KaTeX-rendered math, layout) in apps/web/src/server/services/pdf.service.ts
- [ ] T076 [P] [US7] Create assignment builder component (drag-drop item ordering, point assignment) in apps/web/src/components/admin/assignment-builder.tsx
- [ ] T077 [US7] Create assignment creation page with recommendation + manual adjustment in apps/web/src/app/(dashboard)/admin/assignments/new/page.tsx
- [ ] T078 [US7] Create assignment export page with PDF preview and share link generation in apps/web/src/app/(dashboard)/admin/assignments/[id]/page.tsx

**Checkpoint**: 목적별 학습지 생성 + 문항 추천 + PDF 출력 독립 동작 확인. 30초 이내 완성.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: 관리 기능 및 다수 User Story에 걸친 개선사항

- [ ] T079 [P] Create admin quality metrics dashboard (totalItems, byStatus, metadataCompleteness, CAS passRate) in apps/web/src/app/(dashboard)/admin/dashboard/page.tsx
- [ ] T080 [P] Create review queue page (listReviewTasks, updateReviewTask) in apps/web/src/app/(dashboard)/admin/reviews/page.tsx
- [ ] T081 [P] Create user management page (listUsers, updateUserRole) in apps/web/src/app/(dashboard)/admin/users/page.tsx
- [ ] T082 [P] Create audit log viewer page (listAuditLogs with date/table/action filters) in apps/web/src/app/(dashboard)/admin/audit/page.tsx
- [ ] T083 Performance optimization (Meilisearch query tuning, pgvector HNSW params, Redis caching for frequent queries)
- [ ] T084 Security hardening (rate limiting middleware, CSRF protection, input sanitization, RLS verification)
- [ ] T085 Run quickstart.md validation (Docker Compose up, migration, seed, dev server, all endpoints reachable)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - 즉시 시작 가능
- **Foundational (Phase 2)**: Setup 완료 후 - **모든 User Story 차단**
- **US1 (Phase 3)**: Foundational 완료 후 시작 가능 - 다른 US 의존 없음
- **US2 (Phase 4)**: Foundational 완료 후. US1의 item service와 통합 필요
- **US3 (Phase 5)**: Foundational 완료 후 - US1/US2와 독립적으로 시작 가능
- **US4 (Phase 6)**: US1(item 데이터) + US3(skill 데이터) 필요
- **US5 (Phase 7)**: US3(skill/misconception 데이터) 필요
- **US6 (Phase 8)**: US1(item 데이터) 필요. math-ai 서비스 확장
- **US7 (Phase 9)**: US1(item) + US2(search) + US4(similarity) 권장
- **Polish (Phase 10)**: 원하는 US 완료 후

### User Story Dependencies

```
Foundational
    |
    +---> US1 (P1) --+---> US2 (P1) --+
    |                 |                 |
    +---> US3 (P2) --+---> US4 (P2)   +---> US7 (P4)
    |                 |                 |
    |                 +---> US5 (P3)   |
    |                                   |
    +---> US6 (P3) --------------------+
```

### Within Each User Story

- Service layer before router layer before UI layer
- Models/parsers (packages/) before services (apps/web/src/server/)
- Python endpoints before TypeScript orchestration (when math-ai involved)
- [P] tasks within same story = different files, safe to parallelize

### Parallel Opportunities

- Phase 1: T002-T006 모두 병렬 가능
- Phase 2: T009-T011 병렬, T015-T018 병렬
- Phase 3: T020+T021 병렬, T026+T027 병렬, T029+T030 병렬
- Phase 5: T042+T043 병렬, T047+T049 병렬
- Phase 6: T050+T051 병렬
- Phase 7: T057+T058 병렬
- Phase 8: T064+T065 병렬
- Phase 10: T079-T082 모두 병렬

---

## Parallel Example: User Story 1

```bash
# Launch converters in parallel (different files/services):
Task: "T020 LaTeX-to-MathML converter in packages/math-parser/src/latex-to-mathml.ts"
Task: "T021 LaTeX-to-SymPy endpoint in services/math-ai/app/routers/validate.py"

# Launch UI components in parallel (different files):
Task: "T026 Formula editor in apps/web/src/components/math/formula-editor.tsx"
Task: "T027 Item card in apps/web/src/components/items/item-card.tsx"

# Launch pages in parallel (different files):
Task: "T029 Item list page in apps/web/src/app/(dashboard)/items/page.tsx"
Task: "T030 Item detail page in apps/web/src/app/(dashboard)/items/[id]/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (문항 등록/렌더링)
4. **STOP and VALIDATE**: 문항 10건 등록, 수식 렌더링, 3중 변환 확인
5. Complete Phase 4: User Story 2 (검색/분류)
6. **STOP and VALIDATE**: 1,000건 검색 p95 < 1.5s 확인
7. Deploy/Demo MVP

### Incremental Delivery

1. Setup + Foundational -> Foundation ready
2. US1 -> 문항 CRUD MVP -> Deploy
3. US2 -> 검색 추가 -> Deploy
4. US3 + US4 -> Knowledge Graph + 유사문항 -> Deploy
5. US5 + US6 -> 교정 추천 + 자동 생성 -> Deploy
6. US7 -> 학습지 제작 -> Deploy
7. Polish -> 관리 대시보드 -> Deploy

### Plan Phase Mapping

| Plan Phase | Duration | User Stories |
|-----------|----------|-------------|
| Phase 1: Core Item Bank (MVP) | 3-4개월 | US1, US2 |
| Phase 2: Knowledge Graph | 2-3개월 | US3, US4, US5 |
| Phase 3: Generation + Validation | 3-4개월 | US6 |
| Phase 4: Dashboard + Operations | 2-3개월 | US7, Polish |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Constitution checks: I (3중 표현), II (설명 가능 추천), III (CAS 검증), IV (교육과정 정합)
