# Ultraplan 완료 + DeepTutor Feature 평가

> 작성일: 2026-04-12 | 상태: 대기 (실행 전)

## Context

ultraplan (품질 게이트 8단계) 구현이 **93.75% 완료**. 남은 갭:
1. `auto-tag-suggestions.test.tsx` 컴포넌트 테스트 미작성 (6단계 중 1/4)
2. `guard-check.ts` 미커밋 (untracked)

추가로 [cskwork/DeepTutor](https://github.com/cskwork/DeepTutor)의 Manim 등 기능을 hwp-to-html에 통합할 가능성 평가.

---

## Part A: Ultraplan 잔여 작업

### A1. `auto-tag-suggestions.test.tsx` 작성

**생성 파일**: `apps/web/src/components/items/__tests__/auto-tag-suggestions.test.tsx`

코드베이스 **최초의 React 컴포넌트 테스트**. 기존 인프라:
- `@testing-library/react` 16.3.2 설치됨 (미사용 상태)
- vitest.config.ts: `environment: "node"` → 파일 최상단 `// @vitest-environment jsdom` pragma 필수
- tRPC mock 패턴: `vi.mock("@/lib/trpc", ...)` (라우터 테스트에서 사용 중)

**대상 컴포넌트**: `apps/web/src/components/items/auto-tag-suggestions.tsx` (255 LOC)
- Props 12개: bodyLatex, schoolLevel, grade, itemType?, formulaType?, solutionSteps?, selectedSkillIds[], selectedStandardIds[], selectedMisconceptionIds[], onSkillSelect, onStandardSelect, onMisconceptionSelect
- tRPC 훅: `trpc.item.suggestMetadata.useQuery(input, { enabled: debouncedBody.length > 0 })`
- 내부 디바운스: `useDebouncedValue(bodyLatex, 500)` — `useState(value)`로 초기값 = bodyLatex이므로 첫 렌더에서 타이머 불필요
- 하위 컴포넌트: BloomBadge, SuggestionSection, Chip, SkeletonBlock

#### 테스트 케이스 5개

| # | 테스트 | 검증 방법 |
|---|--------|----------|
| 1 | bodyLatex 빈 문자열 → null 렌더링 | `container.innerHTML === ""` |
| 2 | isLoading → 스켈레톤 표시 | `animate-pulse` 클래스 존재 확인 |
| 3 | data 반환 → 칩 렌더링 | skill/standard/misconception 텍스트 존재 |
| 4 | 칩 클릭 → onSkillSelect 콜백 호출 | `fireEvent.click` → vi.fn() 호출 확인 |
| 5 | 선택된 항목 → 체크마크(✓) 표시 | `\u2713` 문자 존재 확인 |

#### Mock 구조

```typescript
// tRPC 모듈 mock
vi.mock("@/lib/trpc", () => ({
  trpc: {
    item: {
      suggestMetadata: {
        useQuery: vi.fn(),
      },
    },
  },
}));

// 응답 데이터
const mockData = {
  skills: [{ id: "sk1", title: "일차방정식", similarity: 0.92 }],
  standards: [{ id: "std1", code: "M8-01", title: "표준1" }],
  misconceptions: [{ id: "mc1", title: "부호 오류", typicalError: "부호 반전" }],
  bloomLevel: 3,
};
```

#### 참고 파일
- 컴포넌트: `apps/web/src/components/items/auto-tag-suggestions.tsx:47-179`
- tRPC mock 선례: `apps/web/src/server/routers/__tests__/item.router.test.ts:19-64`
- BLOOM_LEVEL 상수: `packages/shared/constants/index.ts`
- vitest 설정: `apps/web/vitest.config.ts` (jsdom pragma, path alias `@`)

---

### A2. `guard-check.ts` 커밋

**파일**: `apps/web/e2e/guard-check.ts` (14줄, 이미 완성됨)

DB 가드 검증 스크립트 — `helpers/db.ts` import 시 `_test` suffix 가드가 정상 작동하는지 확인.

```bash
git add apps/web/e2e/guard-check.ts
# A1 테스트 파일과 함께 커밋
git commit -m "test: add auto-tag-suggestions component test and track guard-check script"
```

---

### A3. 커버리지 임계선 (참고)

현재 (`apps/web/vitest.config.ts:34-39`):
- lines: 21, statements: 20, functions: 13, branches: 17

ultraplan 목표: services 60%, routers 80%, 전체 45%

**권장**: A1 완료 후 커버리지 실행하여 수치 변화 확인. 의미 있는 상승 시 +1~2 bump 고려. 목표치(45%)는 추가 테스트 작성 후에 적용.

---

## Part B: DeepTutor Feature 평가

### DeepTutor 개요

[HKUDS/DeepTutor](https://github.com/HKUDS/DeepTutor) (v1.0.2, Apache-2.0) — Agent-Native 개인화 튜터링 플랫폼.
- Python 3.11+ / Next.js 16
- Two-layer 플러그인 모델: Tools + Capabilities
- ~200k LOC 아키텍처 재작성 (v1.0.0)

### Capability 분석

| Capability | 설명 | hwp-to-html 관련성 | 구현 난이도 |
|-----------|------|-------------------|-----------|
| **Math Animator** | Manim 기반 5-agent 파이프라인 (분석→설계→코드생성→렌더→요약). 비디오/이미지 출력 | **높음** — `SolutionMethod.visual` 활용 | 높음 (Docker+ffmpeg+LaTeX) |
| **Visualize** | SVG/Chart.js 3단계 파이프라인 (분석→생성→리뷰) | **높음** — 경량, 즉시 적용 가능 | 낮음-중간 |
| **Deep Solve** | 멀티에이전트 문제풀이 (Plan→ReAct→Write), RAG/웹검색/코드실행 | **중간** — generation.service 보완 | 중간 |
| **Deep Question** | 퀴즈 생성 | 낮음 — 이미 generation.service 존재 | 중간 |
| **Guided Learning** | 구조화 학습 여정 | 중간 — 학생 경험 개선용 | 높음 |
| **Knowledge Hub** | RAG 지식 베이스 | 낮음 — pgvector+Meilisearch 구축됨 | 낮음 |
| **Co-Writer** | AI 협업 마크다운 에디터 | 낮음 | 중간 |

### Effort/Impact 매트릭스

```
         High Impact
              |
   Visualize  |  Math Animator
   (Low Eff.) |  (High Eff.)
              |
 ─────────────┼─────────────
              |
   Deep Solve |  Guided Learning
   (Med Eff.) |  (High Eff.)
              |
         Low Impact
```

### Top 3 통합 후보 상세

#### 1. Visualize (SVG/Chart.js) — 추천: 1순위

**이유**: 인프라 추가 불필요, 스키마 변경 없이 시작 가능, 즉각적 가치.

**통합 경로**:
- `services/math-ai/app/routers/visualize.py` 추가 — 3단계 파이프라인
- 입력: LaTeX 본문 → LLM이 SVG/Chart.js 코드 생성 → 리뷰/최적화
- 출력: SVG 문자열 또는 Chart.js spec JSON
- 저장: `Solution.steps` JSON에 `{ type: "svg", content: "..." }` 추가
- 프론트엔드: `apps/web/src/components/items/visual-solution.tsx` — SVG inline 렌더 + Chart.js 초기화
- tRPC: `item.generateVisualization` mutation → math-ai `/visualize` 호출

**예상 기간**: 1주 (기본), 2주 (Chart.js 인터랙션 포함)

**기존 자산 활용**:
- `anthropic-generation.service.ts` — LLM 호출 패턴
- `services/math-ai/app/services/sympy_solver.py` — 수식 파싱 재사용
- DeepTutor `deeptutor/capabilities/visualize.py` — 파이프라인 설계 참조

#### 2. Math Animator (Manim) — 추천: 2순위

**이유**: 높은 시각적 영향력. `SolutionMethod.visual` enum이 이미 존재.

**통합 경로**:
- `services/math-ai/app/routers/animate.py` — 5-agent 파이프라인
  - ConceptAnalysis → ConceptDesign → CodeGenerator → ManimRender → Summary
- DB 마이그레이션: `Solution` 모델에 `videoUrl String?` 추가
- 인프라 옵션:
  - (a) Docker sidecar (Manim + LaTeX + ffmpeg 프리인스톨) — 추천
  - (b) 전용 렌더 워커 (BullMQ 비동기 패턴, bulk upload과 동일)
- 객체 스토리지: S3/R2에 비디오 저장, `videoUrl`에 URL 기록
- 프론트엔드: `visual-solution-video.tsx` — lazy-load 비디오 플레이어
- 핵심 포인트: DeepTutor의 `RetryManager` 패턴 필수 (Manim 코드 생성은 불안정)

**예상 기간**: 2-4주

**DeepTutor 참조 코드**:
- `deeptutor/capabilities/math_animator.py` — capability 진입점
- `deeptutor/agents/math_animator/pipeline.py` — 5-agent 오케스트레이션
- `deeptutor/agents/math_animator/renderer.py` — Manim 렌더 서비스
- `deeptutor/agents/math_animator/retry_manager.py` — 코드 재생성 로직

**리스크**: Manim 시스템 의존성(LaTeX 배포판, ffmpeg, Cairo), 코드 생성 불안정성

#### 3. Deep Solve (멀티에이전트 풀이) — 추천: 3순위

**이유**: 기존 generation.service의 SymPy/LLM 전략을 보완하는 고급 풀이 모드.

**통합 경로**:
- `generation.service.ts`에 `"deep-solve"` 전략 추가 (기존 `"sympy"`, `"llm"` 옆)
- `services/math-ai/app/routers/solve.py` — Plan→ReAct→Write 파이프라인
  - Plan: 문제 구조 분석
  - ReAct: SymPy CAS + 웹 검색을 도구로 사용하여 풀이
  - Write: 풀이 단계 포맷팅
- 기존 `sympy_solver.py`의 `verify_answer()`, `solve_equation()`을 ReAct 루프 내 도구로 활용
- 스키마 변경 없음 — `Solution.steps` JSON 동일 포맷 사용

**예상 기간**: 1-2주

**DeepTutor 참조 코드**:
- `deeptutor/capabilities/deep_solve.py` — capability 진입점
- `deeptutor/agents/solve/main_solver.py` — 멀티에이전트 오케스트레이터

---

### 의존성 결정 사항 (구현 전 확정 필요)

1. **객체 스토리지**: Math Animator 비디오 저장용 — S3, R2, 또는 로컬(dev)
2. **LLM 프로바이더**: agent 파이프라인용 — 현재 Z.ai/GLM-4.7 또는 Claude 직접 호출
3. **Manim 렌더링 방식**: 동기 vs 비동기 (BullMQ 큐 패턴 이미 존재)
4. **라이선스**: DeepTutor는 Apache-2.0 — 코드 참조/포팅 가능

---

## 실행 순서

```
[즉시] A1 → auto-tag-suggestions.test.tsx 작성 + 테스트 통과
[즉시] A2 → guard-check.ts 커밋 (A1과 함께)
[즉시] B  → docs/deeptutor-feature-assessment.md 작성
[다음 스프린트] Visualize SVG/Chart.js 프로토타입
[2-4주] Math Animator Docker 설정 + 기본 파이프라인
[2-4주] Deep Solve 전략 추가
```

## 검증

```bash
# A1 테스트 통과
pnpm --filter @hwp/web vitest run src/components/items/__tests__/auto-tag-suggestions.test.tsx

# 전체 테스트 회귀 확인
pnpm --filter @hwp/web vitest run

# 커버리지 변화 확인
pnpm --filter @hwp/web test:coverage
```
