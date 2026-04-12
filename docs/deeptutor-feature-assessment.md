# DeepTutor Feature 통합 평가

> 작성일: 2026-04-12 | 대상: [HKUDS/DeepTutor](https://github.com/HKUDS/DeepTutor) v1.0.2 (Apache-2.0)

## 개요

DeepTutor는 Agent-Native 개인화 튜터링 플랫폼(Python 3.11+ / Next.js 16)으로,
Two-layer 플러그인 모델(Tools + Capabilities)을 기반으로 한다.

hwp-to-html(math-item-os)에 통합할 가치가 있는 Capability를 평가한다.

## Capability 분석

| Capability | 설명 | 관련성 | 난이도 |
|-----------|------|--------|--------|
| **Visualize** | SVG/Chart.js 3단계 파이프라인 (분석→생성→리뷰) | **높음** | 낮음-중간 |
| **Math Animator** | Manim 5-agent 파이프라인, 비디오/이미지 출력 | **높음** | 높음 |
| **Deep Solve** | 멀티에이전트 문제풀이 (Plan→ReAct→Write) | **중간** | 중간 |
| Deep Question | 퀴즈 생성 | 낮음 | 중간 |
| Guided Learning | 구조화 학습 여정 | 중간 | 높음 |
| Knowledge Hub | RAG 지식 베이스 | 낮음 | 낮음 |
| Co-Writer | AI 협업 에디터 | 낮음 | 중간 |

## Effort/Impact 매트릭스

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

## Top 3 통합 후보

### 1순위: Visualize (SVG/Chart.js)

**선택 이유**: 인프라 추가 불필요, 스키마 변경 없이 시작 가능, 즉각적 가치.

**통합 경로**:
- `services/math-ai/app/routers/visualize.py` — 3단계 파이프라인 (분석→생성→리뷰)
- 입력: LaTeX 본문 → LLM SVG/Chart.js 코드 생성
- 출력: SVG 문자열 또는 Chart.js spec JSON
- 저장: `Solution.steps` JSON에 `{ type: "svg", content: "..." }` 추가
- 프론트: `apps/web/src/components/items/visual-solution.tsx`
- tRPC: `item.generateVisualization` mutation

**기존 자산 활용**:
- `anthropic-generation.service.ts` — LLM 호출 패턴
- `services/math-ai/app/services/sympy_solver.py` — 수식 파싱 재사용
- DeepTutor `deeptutor/capabilities/visualize.py` — 파이프라인 설계 참조

**예상 기간**: 1주 (기본), 2주 (Chart.js 인터랙션 포함)

### 2순위: Math Animator (Manim)

**선택 이유**: 높은 시각적 영향력. `SolutionMethod.visual` enum이 이미 존재.

**통합 경로**:
- `services/math-ai/app/routers/animate.py` — 5-agent 파이프라인
- DB: `Solution` 모델에 `videoUrl String?` 추가
- 인프라: Docker sidecar (Manim + LaTeX + ffmpeg) 또는 BullMQ 비동기 워커
- 객체 스토리지: S3/R2에 비디오 저장

**리스크**: Manim 시스템 의존성(LaTeX, ffmpeg, Cairo), 코드 생성 불안정성 (RetryManager 필수)

**DeepTutor 참조**: `math_animator.py`, `pipeline.py`, `renderer.py`, `retry_manager.py`

**예상 기간**: 2-4주

### 3순위: Deep Solve (멀티에이전트 풀이)

**선택 이유**: `generation.service`의 SymPy/LLM 전략을 보완하는 고급 모드.

**통합 경로**:
- `generation.service.ts`에 `"deep-solve"` 전략 추가
- `services/math-ai/app/routers/solve.py` — Plan→ReAct→Write 파이프라인
- 기존 `sympy_solver.py`의 `verify_answer()`, `solve_equation()`을 ReAct 도구로 활용
- 스키마 변경 없음

**예상 기간**: 1-2주

## 의존성 결정 사항 (구현 전 확정 필요)

| 항목 | 선택지 | 영향 범위 |
|------|--------|----------|
| 객체 스토리지 | S3, R2, 로컬(dev) | Math Animator 비디오 저장 |
| LLM 프로바이더 | Z.ai/GLM-4.7, Claude 직접 | agent 파이프라인 |
| Manim 렌더링 | 동기, 비동기(BullMQ) | Math Animator 아키텍처 |
| 라이선스 | Apache-2.0 | 코드 참조/포팅 가능 확인됨 |

## 실행 로드맵

```
[다음 스프린트]  Visualize SVG/Chart.js 프로토타입
[2-4주]         Math Animator Docker + 기본 파이프라인
[2-4주]         Deep Solve 전략 추가
```
