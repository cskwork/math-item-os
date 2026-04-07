# Math Knowledge Graph + Item OS - 구현 계획

## Context

초/중/고 수학 문항을 대규모로 저장/분류/검색/추천/생성하는 교사용 문제 운영 플랫폼.
"문항 자체가 아니라 문항-개념-선수학습-오개념-난이도-해설-생성 규칙까지 구조화"하여,
교사가 "지금 이 학생에게 왜 이 문제를 써야 하는지"까지 판단할 수 있게 한다.

**경쟁 포지셔닝**: 매쓰플랫(문제은행/교체) + EBS AI 단추(대규모 추천) + DeltaMath(standards/remediation) + ALEKS(Knowledge Space Theory) 4축을 하나의 지식 구조 위에 통합 + "통제 가능한 유사문항 생성"

**북극성 지표**: 교사가 "목적에 맞는 문항 세트"를 만드는 데 걸리는 시간

---

## 1. 시장 분석 요약

### 기존 서비스의 Gap (어디에도 없는 것)
1. 한국 교육과정 + 선행학습 그래프 + API 통합 = **없음**
2. 구조적 유사문제 자동 생성 (숫자만 바꾸는 게 아닌) = **미구현**
3. 오개념(Misconception) 기반 교정 문제 추천 = **ALEKS만 부분 지원**
4. 추천 근거가 설명 가능한 시스템 = **없음**
5. 8만+ 문항에 IRT + Bloom + 선행학습 DAG + 벡터 유사도 + 오개념 통합 = **없음**

### 한국 플랫폼 현황
| 플랫폼 | 문항수 | 선행학습 그래프 | 유사문제 | API |
|--------|--------|----------------|---------|-----|
| 매쓰플랫 | 82만 | X | 6배수(숫자변형) | X |
| T셀파 | 18만 | X | 제한적 | X |
| 비바샘 | 12만 | X | 쌍둥이문제 | X |
| EBS AI단추 | 비공개 | X | AI추천 | X |

### 해외 참고 모델
| 플랫폼 | 핵심 강점 | 참고할 점 |
|--------|---------|----------|
| Math Academy | Knowledge Graph (업계 최고) | encompassing_weight 모델 |
| ALEKS | Knowledge Space Theory | 학습 준비도 추정 |
| DeltaMath | Standards 기반 remediation | skill 탐색 흐름 |
| Knewton Alta | Enterprise API + prerequisite | cross-domain 관계 |

---

## 2. 내부 표준 채택

| 역할 | 표준 | 이유 |
|------|------|------|
| 외부 문항 교환 | **QTI 3** | LMS 호환성, 문항 이동 표준 |
| 교육과정/스킬 그래프 | **CASE** | 학습기준/역량 기계판독 표준 |
| 저작 포맷 | **LaTeX** | 교사/출판 표준 |
| 브라우저 표현 | **MathML Core** | 웹 접근성, 스크린리더 |
| 수식 정규화/검증 | **SymPy AST** | 동치 검증, 구조 비교, 자동 풀이 |
| 내부 저장 | **JSONB + relational** | 유연성 + 무결성 |

**이중 구조 원칙**: 외부 표준(QTI/CASE)으로 호환성 확보 + 내부 실행 모델(SymPy AST)로 운영 유연성 확보

---

## 3. 핵심 도메인 모델 (PRD 기준)

### 3.1 엔티티 목록

| 엔티티 | 역할 |
|--------|------|
| **Item** | 문항 본체 (LaTeX + MathML + SymPy AST) |
| **ItemVersion** | 문항 버전 이력 |
| **Skill** | 스킬 노드 (solve_linear_eq_distributive 등) |
| **Standard** | 성취기준 (KR2022-M2-ALG-1 등) |
| **PrerequisiteEdge** | 스킬 간 선수학습 관계 (강한/약한) |
| **Misconception** | 오개념 (sign_error_transposition 등) |
| **DifficultyProfile** | 난이도 (저자/행동/IRT/교사체감) |
| **Solution** | 단계형 풀이 + 해설 |
| **Template** | 생성 템플릿 (파라미터화된 문제 구조) |
| **Variant** | 템플릿에서 생성된 변형 문항 |
| **Passage/Stimulus** | 공유 지문/자극 (여러 문항이 참조) |
| **Assignment** | 학습지/과제 |
| **StudentResponse** | 학생 응답 (정오, 풀이시간, 재시도 등) |
| **RecommendationEvent** | 추천 이벤트 (근거 포함) |
| **ReviewTask** | 검수 작업 (태그/생성/중복/해설오류) |
| **AuditLog** | 감사 로그 (영구 보존) |

### 3.2 문항 메타태그 필수 필드

```
학제(초/중/고), 학년/학기, 교육과정 버전
과목/대단원/중단원/소단원, skill_id, 성취기준 id
선수지식 목록, 오개념 태그
난이도(저자), 난이도(행동 데이터), IRT 파라미터
문항유형, 수식유형, 풀이 단계 수, 정답형식
사용 목적: 진단/개념학습/보충/숙제/시험직전/심화
생성 가능 여부, 저작권/출처/사용권한
품질상태: draft/reviewed/approved/retired
```

### 3.3 수식 3중 표현 (PRD 핵심 설계)

```json
"representations": {
  "latex": "2(x-3)=10",         // 저작/저장
  "mathml": "<math>...</math>",  // 브라우저 렌더링
  "sympy": "Eq(2*(x-3),10)"     // 검증/정규화/비교
}
```

---

## 4. 기술 스택 (3가지 대안)

### AS-IS: 현재 상태
- hwp-to-html 프로젝트만 존재 (초기 상태)

### TO-BE 대안

#### **대안 A: Full-stack TypeScript + Python AI (권장)**
```
Frontend: Next.js 15 + KaTeX + MathML + TailwindCSS + Shadcn UI
API: tRPC (end-to-end 타입 안전)
ORM: Prisma 6.x
DB: PostgreSQL 17 + pgvector + ltree
Search: Meilisearch (한국어 CJK)
Cache: Redis 7.x
AI/Math: FastAPI + SymPy + Claude API (별도 Python 마이크로서비스)
Auth: Auth.js v5
HWP: hwpjs (Rust core, MIT)
Infra: Supabase + Vercel (초기) -> AWS (성장기)
```
- 장점: 1-2명 팀 최적, T3 Stack(28.5K stars) 검증, 초기 $75-135/월
- 단점: Node.js 배치 처리 제약 (AI 서비스 분리로 해결)

#### **대안 B: Python 중심 (FastAPI + Neo4j)**
- FastAPI + SQLAlchemy + PostgreSQL + Neo4j + SymPy + LangChain
- 장점: SymPy 생태계 최적, 그래프 DB 네이티브
- 단점: 2개 언어, pyhwp AGPL, Neo4j GPL, FE/BE 타입 공유 불편

#### **대안 C: Enterprise (Spring Boot + Kotlin)**
- Spring Boot + PostgreSQL + Elasticsearch + Redis
- 장점: 대규모 확장성, hwplib(Java) 자연 통합
- 단점: 최소 3-5명, 초기 비용 최고

### 제안: **대안 A**
이유: MVP 범위(중학교 수학)에 집중, 1-2명으로 빠르게 검증. 수학 연산만 Python 서비스로 분리.

---

## 5. 서비스 아키텍처 (PRD 17절 기준)

```
┌───────────────────────────────────────────────────┐
│              Client (Browser)                     │
│  Next.js 15 + KaTeX/MathML + Shadcn UI            │
└────────────────────┬──────────────────────────────┘
                     │ tRPC
┌────────────────────▼──────────────────────────────┐
│             Next.js API Routes                    │
│          tRPC Router + Auth.js                    │
└──┬───────┬───────┬───────┬───────┬────────────────┘
   │       │       │       │       │
   ▼       ▼       ▼       ▼       ▼
┌──────┐┌──────┐┌──────┐┌──────┐┌─────────────────┐
│Item  ││Meta  ││Graph ││Assign││ AI Service (Py) │
│Svc   ││data  ││Svc   ││ment  ││ FastAPI + SymPy │
│      ││Svc   ││      ││Svc   ││ + Claude API    │
└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬──────────────┘
   │       │       │       │       │
   ▼       ▼       ▼       ▼       ▼
┌──────────────────────────────────────────────────┐
│  PostgreSQL 17 + pgvector + ltree                │
│  + Meilisearch + Redis + S3/Supabase Storage     │
└──────────────────────────────────────────────────┘

내부 서비스 분류:
├── Item Service: 문항 CRUD, 버전관리, QTI import/export
├── Metadata Service: 자동태깅, 태그검수, 난이도관리
├── Graph Service: 선수학습 그래프, 오개념 경로
├── Similarity Service: 유사문항 검색 (pgvector + skill 랭킹)
├── Generation Service: 템플릿 기반 + AI 생성
├── Validation Service: SymPy/Z3 정답검증, 품질규칙
├── Assignment Service: 학습지/과제 제작, PDF 출력
├── Analytics Service: 학생응답, 난이도보정, KPI
└── Admin Review Service: 검수큐, 감사로그, 품질대시보드
```

**MVP에서는 모노레포 + 논리적 서비스 분리**로 시작. 마이크로서비스 물리 분리는 Phase 4 이후.

---

## 6. 유사문항 검색 랭킹 설계 (PRD 13.3절)

### 유사도 결합 신호 (텍스트 < skill/graph)

| 신호 | 가중치(초기) | 소스 |
|------|-------------|------|
| skill/성취기준 일치도 | 0.30 | Metadata DB |
| 수식 구조 유사도 | 0.20 | SymPy AST 비교 |
| 선수지식 그래프 거리 | 0.15 | Graph Service |
| 텍스트/서술 의미 유사도 | 0.15 | pgvector 임베딩 |
| 난이도 근접도 | 0.10 | DifficultyProfile |
| 오개념 프로파일 유사도 | 0.10 | Misconception 매칭 |

**수용 기준**: 상위 20개, p95 1.5초 이하, 결과별 "왜 추천되었는지" 설명, 교사 피드백 rerank

---

## 7. 생성 파이프라인 (PRD 13.4절)

```
[1] 원문항 분석
[2] 템플릿 추출/매핑
[3] 난이도 완화 규칙 적용
[4] 새 문항 생성 (SymPy 파라미터 변형 + LLM 서술 변환)
[5] SymPy 기반 정답/동치/유일해 검증
[6] 해설 생성 (Claude API)
[7] 금지 패턴/품질 규칙 검사
[8] 검수 또는 자동 승인
```

**제어 변수**: 풀이 단계 수, 계수 범위, 분수/음수 포함 여부, 보기 수, 표현형(순수식/서술형/실생활형)

**수용 기준**: 1건당 10초 이내, 자동 검증 실패 = 배포 금지, 원문항 관계 추적 가능

---

## 8. 추천 시스템 (PRD 14절)

### 추천 6가지 타입
1. 진단용 / 2. 보충용 / 3. 선수학습 복구 / 4. 시험 직전 압축 / 5. 오개념 교정 / 6. 유사문항 대체

### 설명 가능한 추천 (필수)
- "같은 skill이지만 분수 계산이 제거되어 난이도가 낮습니다."
- "부호 이동 오류를 교정하는 패턴이 포함됩니다."
- "현재 선수 skill 'distributive_property' 복습이 먼저 필요합니다."

---

## 9. 구현 단계 (PRD 23절 기준)

### Phase 1: Core Item Bank (3-4개월) - 중학교 대수/방정식
- T3 Stack 셋업
- Item/Skill/Standard/Solution 데이터 모델
- KaTeX + MathML 에디터/렌더러
- Meilisearch 한국어 검색
- QTI/CSV/JSON/HWP 일괄 업로드 (1만건/회)
- Auth.js 교사 인증 + RBAC
- 문항 버전 관리

### Phase 2: Similarity + Graph + Misconception (2-3개월)
- 유사문항 검색 (pgvector + skill 랭킹)
- 선수학습 DAG (PostgreSQL recursive CTE)
- 오개념 태깅 및 교정 경로
- 그래프 시각화 (React Flow)
- 2022 개정 교육과정 CASE 데이터화

### Phase 3: Generation + Validation (3-4개월)
- Python AI 마이크로서비스 (FastAPI + SymPy)
- 템플릿 기반 + LLM 생성 파이프라인
- SymPy/Z3 자동 검증 (정답 동치, 유일해, 난이도 범위)
- 해설 자동 생성 (Claude API)
- 생성 문항 검수 워크플로우

### Phase 4: Dashboard + Operations (2-3개월)
- 학습지/과제 제작 (PDF + 온라인)
- 태그/생성/중복/해설오류 검수 큐
- 품질 KPI 대시보드
- 난이도 행동 데이터 보정 배치
- 감사 로그

### Phase 5: Adaptive + Scale (3-4개월)
- 학생 응답 수집 + mastery 추정
- 6가지 추천 타입 구현
- 설명 가능한 추천
- 초등/고등 확장
- LMS/LTI 연동
- B2B API

**총 타임라인: 13-18개월 (1-2명), 8-9개월 (3-5명)**

---

## 10. 비용 추정

### 인프라 (초기 MVP)
| 항목 | 월 비용 |
|------|---------|
| Supabase Pro | $25 |
| Meilisearch Cloud | $30 |
| Vercel Pro | $20 |
| Redis (Upstash) | $0-10 |
| **합계** | **$75-135/월** |

### AI API (80K 문제 생성)
- Batch API + Prompt Cache 적용: **$12-40**
- 임베딩 (text-embedding-3): **$1.6-10**

---

## 11. 법적 주의사항

| 항목 | 리스크 | 대응 |
|------|--------|------|
| 수능 기출 | 공공누리 제4유형 (상업 금지) | 유형/패턴 분석 후 AI 유사문제 생성 |
| 교과서 문제 | 출판사 저작권 | 직접 저장 금지, 매핑만 |
| AI 생성 문제 | 2026 AI기본법 표시 의무 | "AI 생성" 라벨 필수 |
| AI 생성물 저작권 | AI 단독 = 보호 불가 | 교사 검수로 창작적 기여 확보 |
| pyhwp | AGPL v3 | hwpjs(MIT) 사용 |

---

## 12. 참고 리소스

### 포크/참고 오픈소스
| 프로젝트 | 용도 |
|---------|------|
| create-t3-app | 풀스택 스타터 (28.5K stars) |
| OATutor (CAHLR) | 적응형 튜터링 (MIT) |
| examgen | SymPy+LaTeX 시험 생성 |
| GSM-Symbolic (Apple) | 템플릿 기반 변형 생성 |
| mathgenerator | Python 수학 문제 생성 |
| STACK | Moodle CAS 기반 평가 |
| WeBWorK OPL | 35K 대학 수학 문제 |

### 핵심 논문
- GSM-Symbolic (Apple, ICLR 2025) - 기호 템플릿 변형
- MathSmith (2025) - RL 기반 고난도 합성
- AI-Assisted Generation (2024-2025) - 스킬쌍 기반 생성
- From Recall to Reasoning (2025) - 인지 수준별 자동 생성

### 데이터 소스
- AI Hub 수학문제 데이터 (240만건 구조화)
- KICE 수능/모의고사 기출 (공공누리 제4유형)
- WeBWorK OPL 35K 문제 (GPL)

---

## 13. 검증 방법

1. **DB 설계**: 80K 더미 데이터 PostgreSQL 쿼리 벤치마크
2. **검색**: Meilisearch + pgvector 하이브리드 검색 p95 < 1.5초
3. **AI 생성**: SymPy 자동 검증 통과율 95%+
4. **유사도 랭킹**: skill+graph 기반 vs 텍스트 기반 A/B 비교
5. **E2E**: "중2 일차방정식 분배법칙 쉬운 보충 5개 + 유사문제 각 3개" 30초 내 완료

---

## 14. 다음 단계 결정 필요

PRD v1.0 기준으로 두 가지 방향 중 선택:
1. **ERD/DB 스키마 초안** - 도메인 모델을 PostgreSQL 테이블로 구체화
2. **MVP 기술 아키텍처 문서** - Phase 1 구현을 위한 상세 설계
