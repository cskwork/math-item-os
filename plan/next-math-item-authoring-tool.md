# 수학 문항 저작 도구 모듈 구현

## 프롬프트

유명한 국내/해외 수학 저작 도구를 조사해서 **문항 등록(/items/new)용 그리드 기반 수학 문항 저작 도구 모듈**을 구현해줘. 별도 모듈로 만들어야 함.

두 가지 모두 구현:
- (A) **시각적 수식 편집기**: LaTeX 타이핑 없이 클릭으로 분수, 루트, 적분, 행렬 등 입력 (MathType/Mathcha 스타일)
- (B) **그리드 기반 문제 구성**: 문제 본문, 보기, 그래프, 표, 이미지를 그리드에 배치하여 시각적으로 문제 구성

오픈소스 참고 필수. 시장 친화적 UX로.

## 컨텍스트

### 이전 세션에서 완료된 것
- 학습지 빌더(`/admin/assignments/new`)에 @dnd-kit/react DnD + 캔버스 블록 시스템 구현 완료 (`cb2d599`)
- 캔버스 모듈: `apps/web/src/components/admin/canvas/` (types, use-canvas-state, canvas-builder, blocks/, toolbar, palette)
- 이것은 **학습지 구성 도구**이고, 지금 만들 것은 **문항 저작 도구** (다른 것)

### 현재 문항 등록 UI (개선 대상)
- `apps/web/src/app/(dashboard)/items/new/page.tsx` — 폼 기반 문항 생성
- `apps/web/src/components/math/formula-editor.tsx` — LaTeX 텍스트 입력 + KaTeX 미리보기
- `apps/web/src/components/math/katex-renderer.tsx` — KaTeX 렌더링
- 현재는 LaTeX를 **직접 타이핑**해야 하고, 문제 구성 요소를 **시각적으로 배치**할 수 없음

### 기술 스택
- Next.js 15, React 19, TypeScript 5.7, tRPC 11, KaTeX 0.16
- @dnd-kit/react (이미 설치됨) — 드래그앤드롭용
- Tailwind CSS 4 + Radix UI (shadcn)

### 조사 대상 도구
**국제**: MathType, Mathcha, Desmos, GeoGebra, Mathigon/Polypad, Formative, Classkick
**국내**: 매쓰플랫, 천재교육 밀크T, 비상교육/비바샘, 아이스크림 AI, EBS AI단추
**오픈소스**: MathQuill, MathLive, mathlive (Cortex), react-mathquill, KaTeX 자체

### 사용자 선호
- 테스트보다 기능 완성도 우선
- 서브에이전트 병렬 분산 선호
- 실행 대기 계획은 프로젝트 plan/ 디렉토리에 저장
