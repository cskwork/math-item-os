# Data Model: Math Knowledge Graph + Item OS

**Date**: 2026-04-07 | **Source**: `docs/schema.sql`, `docs/erd.md`

## Core Entities

### Item (문항)

핵심 엔티티. LaTeX + MathML + SymPy AST 3중 표현으로 수학 문항을 저장.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK | |
| org_id | uuid | FK -> organization, NOT NULL | 멀티테넌트 격리 |
| passage_id | uuid | FK -> passage, NULL | 공유 지문 참조 |
| body_latex | text | NOT NULL | LaTeX 원문 |
| body_mathml | text | NULL | MathML (렌더링) |
| body_sympy | text | NULL | SymPy AST (검증). NULL이면 변환 실패 |
| body_html | text | NULL | 렌더링된 HTML |
| choices | jsonb | NULL | [{label, latex, mathml, is_correct}] |
| answer | jsonb | NOT NULL | {value, format, tolerance, alternatives} |
| school_level | enum | NOT NULL | elementary/middle/high |
| grade | smallint | 1-12 | 학년 |
| semester | enum | NULL | 1/2 |
| topic_path | ltree | NULL | 계층 분류 (math.algebra.linear_eq) |
| item_type | enum | NOT NULL, default short_answer | 문항 유형 |
| formula_type | enum | NOT NULL, default inline | 수식 유형 |
| answer_format | enum | NOT NULL, default exact_value | 답안 형식 |
| solution_steps | smallint | >= 1 | 풀이 단계 수 |
| usage_purposes | enum[] | NOT NULL, default {} | 활용 목적 (복수) |
| difficulty_author | smallint | 1-5 | 검수자 설정 난이도 (5단계) |
| status | enum | NOT NULL, default draft | 품질 상태 |
| is_generated | boolean | NOT NULL, default false | AI 생성 여부 |
| template_id | uuid | FK -> template, NULL | 생성 원본 |
| embedding | vector(768) | NULL | 유사도 검색용 벡터 |
| current_version | smallint | NOT NULL, default 1 | 현재 버전 |
| created_by | uuid | NULL | 출제자 |

**Indexes**: B-tree(org_id, status, school_level, grade), GiST(topic_path), GIN(metadata, choices, usage_purposes), HNSW(embedding), GIN trgm(body_latex)

### ItemVersion (문항 버전)

불변 버전 이력. 수정 시 새 행 삽입, 기존 행 변경 불가.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK | |
| item_id | uuid | FK -> item, NOT NULL | 원본 문항 |
| version | smallint | UNIQUE(item_id, version) | 버전 번호 |
| body_latex | text | NOT NULL | 시점의 LaTeX |
| answer | jsonb | NOT NULL | 시점의 정답 |
| change_summary | text | NULL | 변경 요약 |

**Trigger**: INSERT 시 `item.current_version` 자동 증가

### Skill (스킬)

지식 그래프 노드. 선수학습 관계로 DAG 형성.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK | |
| org_id | uuid | FK, NOT NULL | |
| code | text | UNIQUE(org_id, code) | 예: solve_linear_eq_distributive |
| title | text | NOT NULL | 스킬명 |
| topic_path | ltree | NOT NULL | 계층 분류 |
| bloom_level | smallint | 1-6 | Bloom 분류 수준 |
| estimated_time_min | smallint | NULL | 예상 소요 시간(분) |

### PrerequisiteEdge (선수학습 관계)

스킬 간 방향 그래프 간선. DAG 무결성 유지 필수.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK | |
| org_id | uuid | FK, NOT NULL | |
| from_skill_id | uuid | FK -> skill | 선수 스킬 |
| to_skill_id | uuid | FK -> skill | 후속 스킬 |
| strength | enum | NOT NULL, default strong | strong/weak |
| weight | numeric(3,2) | 0-1 | 가중치 |

**Constraints**: UNIQUE(org_id, from_skill_id, to_skill_id), CHECK(from != to)
**Validation**: 삽입 시 순환 감지 (recursive CTE) 필수 (Constitution II)

### Standard (성취기준)

2022 개정 교육과정 성취기준. CASE 프레임워크 호환.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK | |
| org_id | uuid | FK, NOT NULL | |
| code | text | UNIQUE(org_id, code) | 예: KR2022-M2-ALG-1 |
| title | text | NOT NULL | |
| school_level | enum | NOT NULL | |
| grade | smallint | 1-12 | |
| topic_path | ltree | NOT NULL | 계층 분류 |
| case_uri | text | NULL | CASE URI |

### Misconception (오개념)

수학교육 연구 기반 사전 정의 목록 + 검수자 확장 가능.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK | |
| org_id | uuid | FK, NOT NULL | |
| code | text | UNIQUE(org_id, code) | 예: sign_error_transposition |
| title | text | NOT NULL | 오개념명 |
| typical_error | text | NULL | 대표 오류 예시 |
| remediation | text | NULL | 교정 방법 |
| severity | smallint | 1-5, default 3 | 심각도 |
| related_skills | uuid[] | default {} | 관련 스킬 ID (비정규화) |

### DifficultyProfile (난이도 프로필)

문항당 1:1. MVP에서는 author_difficulty(5단계)만 사용, IRT는 데이터 축적 후.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK | |
| item_id | uuid | FK -> item, UNIQUE | 1:1 |
| author_difficulty | smallint | 1-5 | 검수자 설정 (MVP primary) |
| behavioral_difficulty | numeric(4,3) | 0-1 | 행동 기반 (향후) |
| irt_difficulty | numeric(5,3) | | IRT b (향후) |
| irt_discrimination | numeric(5,3) | | IRT a (향후) |
| irt_guessing | numeric(4,3) | | IRT c (향후) |
| teacher_perceived | numeric(3,1) | 1.0-5.0 | 교사 체감 (향후) |

### Solution (풀이)

문항별 복수 풀이 방법 지원.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK | |
| item_id | uuid | FK -> item | |
| method | enum | NOT NULL | standard/alternative/visual/shortcut |
| steps | jsonb | NOT NULL | [{step_num, latex, explanation, hint}] |
| final_answer | text | NOT NULL | |
| explanation | text | NULL | 종합 해설 |

### Template (생성 템플릿)

파라미터화된 문제 구조. 변형 문항 생성의 기반.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK | |
| org_id | uuid | FK, NOT NULL | |
| title | text | NOT NULL | |
| body_template | text | NOT NULL | 변수 포함 LaTeX |
| parameters | jsonb | NOT NULL | [{name, type, range, constraints}] |
| answer_template | text | NOT NULL | 답안 생성 규칙 |
| constraints | jsonb | default {} | 정수 해 보장 등 |
| variant_count | integer | default 0 | 생성된 변형 수 |

### Variant (변형)

템플릿에서 생성된 문항 인스턴스. 원본 추적 가능.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK | |
| template_id | uuid | FK -> template | |
| item_id | uuid | FK -> item | 생성된 문항 |
| param_values | jsonb | NOT NULL | 실제 매개변수 값 |
| seed | bigint | NULL | 재현용 랜덤 시드 |
| generation_log | jsonb | default {} | 생성 과정 로그 |

### Assignment (과제/학습지)

교사가 목적별로 구성하는 문항 세트. PDF/링크로 외부 배포.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK | |
| org_id | uuid | FK, NOT NULL | |
| title | text | NOT NULL | |
| purpose | enum | NOT NULL | 목적 (diagnosis/remediation/pre_exam/advanced) |
| is_published | boolean | default false | 공개 여부 |

### RecommendationEvent (추천 이벤트)

추천 근거 + 교사 피드백 기록. 설명 가능한 추천 (Constitution II).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK | |
| org_id | uuid | FK, NOT NULL | |
| rec_type | enum | NOT NULL | remediation/advancement/practice/review |
| item_ids | uuid[] | NOT NULL | 추천 문항 목록 |
| reasoning | jsonb | NOT NULL | 추천 근거 (Constitution II 필수) |
| accepted | boolean | NULL | 교사 수락 여부 |

### AuditLog (감사 로그)

불변. UPDATE/DELETE 차단 (RULE). 모든 변경 이력 영구 보존.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PK | |
| org_id | uuid | NOT NULL | |
| table_name | text | NOT NULL | 대상 테이블 |
| record_id | uuid | NOT NULL | 대상 레코드 |
| action | enum | NOT NULL | create/update/delete/approve/retire/generate/assign |
| old_data | jsonb | NULL | 변경 전 |
| new_data | jsonb | NULL | 변경 후 |
| performed_by | uuid | NOT NULL | 수행자 |

---

## Junction Tables (M:N)

| Table | Keys | Extra Fields |
|-------|------|-------------|
| item_skill | item_id + skill_id | is_primary, weight |
| item_standard | item_id + standard_id | alignment |
| item_misconception | item_id + misconception_id | frequency, sample_n |
| item_similarity | item_a_id + item_b_id + method | score (0-1) |
| skill_standard | skill_id + standard_id | |
| assignment_item | assignment_id + item_id | position, points |

---

## State Machine: quality_status

```
         [검수자]         [검수자]          [관리자]
draft ──────────> reviewed ──────────> approved ──────────> retired
  ^                                      |
  |___________ [관리자 승인] ____________|
```

**전이 규칙** (Clarification Q4):
- 순방향: draft -> reviewed -> approved -> retired
- 역전이: approved -> draft (관리자 승인 하에 수정 필요 시)
- 검수자: draft <-> reviewed <-> approved
- 관리자: -> retired, approved -> draft 승인
- 모든 전이는 `audit_log`에 기록됨

**검색 노출**: `approved` 상태 문항만 교사 검색/추천에 노출 (Constitution IV)

---

## Immutability Patterns

- **item_version**: INSERT only. 기존 행 수정 불가.
- **audit_log**: INSERT only. UPDATE/DELETE RULE로 차단.
- **recommendation_event**: 생성 후 `accepted`/`feedback`만 갱신.

---

## Index Strategy

| Type | Target | Purpose |
|------|--------|---------|
| B-tree | item(org_id, status, school_level, grade) | 필터링 |
| GiST | item(topic_path), skill(topic_path), standard(topic_path) | ltree 계층 검색 |
| GIN | item(metadata), item(usage_purposes) | JSONB + 배열 |
| GIN trgm | item(body_latex) | 텍스트 유사도 (fallback) |
| HNSW | item(embedding) vector_cosine_ops, m=16, ef=64 | 벡터 유사도 |

---

## Multi-tenancy

모든 엔티티에 `org_id` FK. Row-level security(RLS)로 테넌트 격리.
`app.current_org_id` session variable로 현재 조직 컨텍스트 주입.

---

## Full DDL Reference

완전한 DDL은 `docs/schema.sql` (1104줄) 참조.
ERD 다이어그램은 `docs/erd.md` (Mermaid) 참조.
