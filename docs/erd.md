# 수학 지식 그래프 + Item OS -- ERD

## 엔티티 관계 다이어그램 (Mermaid)

```mermaid
erDiagram
    %% ──────────────────────────────────────────────
    %% 조직 (멀티 테넌트)
    %% ──────────────────────────────────────────────
    organization {
        uuid id PK
        text name "조직명"
        text slug UK "URL 슬러그"
        jsonb settings "조직 설정"
        timestamptz created_at
        timestamptz updated_at
    }

    %% ──────────────────────────────────────────────
    %% 성취 기준 (CASE 프레임워크)
    %% ──────────────────────────────────────────────
    standard {
        uuid id PK
        uuid org_id FK "조직"
        text code UK "예: KR2022-M2-ALG-1"
        text title "성취 기준 제목"
        school_level school_level "학교급"
        smallint grade "학년"
        semester_type semester "학기"
        text curriculum_ver "교육과정 버전"
        ltree topic_path "계층 분류"
        text case_uri "CASE URI"
    }

    %% ──────────────────────────────────────────────
    %% 스킬 (지식 그래프 노드)
    %% ──────────────────────────────────────────────
    skill {
        uuid id PK
        uuid org_id FK "조직"
        text code UK "예: solve_linear_eq_distributive"
        text title "스킬명"
        ltree topic_path "계층 분류"
        smallint bloom_level "블룸 분류 (1-6)"
        smallint estimated_time_min "예상 소요 시간(분)"
    }

    %% ──────────────────────────────────────────────
    %% 선수 학습 관계 (스킬 DAG)
    %% ──────────────────────────────────────────────
    prerequisite_edge {
        uuid id PK
        uuid org_id FK "조직"
        uuid from_skill_id FK "선수 스킬"
        uuid to_skill_id FK "후속 스킬"
        prerequisite_strength strength "strong/weak"
        numeric weight "가중치 (0-1)"
    }

    %% ──────────────────────────────────────────────
    %% 오개념
    %% ──────────────────────────────────────────────
    misconception {
        uuid id PK
        uuid org_id FK "조직"
        text code UK "예: sign_error_transposition"
        text title "오개념명"
        text typical_error "대표 오류 예시"
        text remediation "교정 방법"
        smallint severity "심각도 (1-5)"
    }

    %% ──────────────────────────────────────────────
    %% 지문 / 자극 (공유)
    %% ──────────────────────────────────────────────
    passage {
        uuid id PK
        uuid org_id FK "조직"
        text title "지문 제목"
        text body_latex "LaTeX 본문"
        text body_mathml "MathML"
        text body_html "HTML"
        jsonb media_urls "미디어 URL 목록"
    }

    %% ──────────────────────────────────────────────
    %% 문항 (핵심 엔티티)
    %% ──────────────────────────────────────────────
    item {
        uuid id PK
        uuid org_id FK "조직"
        uuid passage_id FK "공유 지문"
        text body_latex "LaTeX 원문"
        text body_mathml "MathML"
        text body_sympy "SymPy AST"
        jsonb choices "선택지"
        jsonb answer "정답"
        school_level school_level "학교급"
        smallint grade "학년"
        item_type item_type "문항 유형"
        formula_type formula_type "수식 유형"
        answer_format answer_format "답안 형식"
        smallint solution_steps "풀이 단계 수"
        quality_status status "품질 상태"
        boolean is_generated "AI 생성 여부"
        uuid template_id FK "생성 원본 템플릿"
        vector embedding "벡터 임베딩 (768D)"
        smallint current_version "현재 버전"
    }

    %% ──────────────────────────────────────────────
    %% 문항 버전 (불변 이력)
    %% ──────────────────────────────────────────────
    item_version {
        uuid id PK
        uuid item_id FK "원본 문항"
        smallint version "버전 번호"
        text body_latex "LaTeX"
        jsonb answer "정답"
        text change_summary "변경 요약"
        timestamptz created_at
    }

    %% ──────────────────────────────────────────────
    %% 난이도 프로필 (4중 난이도)
    %% ──────────────────────────────────────────────
    difficulty_profile {
        uuid id PK
        uuid item_id FK UK "문항 (1:1)"
        smallint author_difficulty "출제자 난이도"
        numeric behavioral_difficulty "행동 난이도"
        numeric irt_difficulty "IRT b"
        numeric irt_discrimination "IRT a"
        numeric irt_guessing "IRT c"
        text irt_model "IRT 모형"
        numeric teacher_perceived "교사 체감"
    }

    %% ──────────────────────────────────────────────
    %% 풀이
    %% ──────────────────────────────────────────────
    solution {
        uuid id PK
        uuid item_id FK "문항"
        solution_method method "풀이 방법"
        text title "풀이 제목"
        jsonb steps "단계별 풀이"
        text final_answer "최종 답"
        text explanation "해설"
        smallint version "버전"
    }

    %% ──────────────────────────────────────────────
    %% 템플릿 (매개변수화 문제 생성)
    %% ──────────────────────────────────────────────
    template {
        uuid id PK
        uuid org_id FK "조직"
        text title "템플릿 제목"
        text body_template "본문 템플릿 (LaTeX)"
        jsonb parameters "매개변수 정의"
        text answer_template "답안 생성 규칙"
        jsonb constraints "제약 조건"
        integer variant_count "생성된 변형 수"
    }

    %% ──────────────────────────────────────────────
    %% 변형 (템플릿에서 생성된 인스턴스)
    %% ──────────────────────────────────────────────
    variant {
        uuid id PK
        uuid template_id FK "원본 템플릿"
        uuid item_id FK "생성된 문항"
        jsonb param_values "매개변수 값"
        bigint seed "랜덤 시드"
    }

    %% ──────────────────────────────────────────────
    %% 과제 (학습지, 숙제)
    %% ──────────────────────────────────────────────
    assignment {
        uuid id PK
        uuid org_id FK "조직"
        text title "과제 제목"
        usage_purpose purpose "목적"
        boolean is_published "공개 여부"
        timestamptz due_at "마감"
    }

    %% ──────────────────────────────────────────────
    %% 과제-문항 연결
    %% ──────────────────────────────────────────────
    assignment_item {
        uuid assignment_id FK "과제"
        uuid item_id FK "문항"
        smallint position "순서"
        numeric points "배점"
    }

    %% ──────────────────────────────────────────────
    %% 학생 응답
    %% ──────────────────────────────────────────────
    student_response {
        uuid id PK
        uuid org_id FK "조직"
        uuid assignment_id FK "과제"
        uuid item_id FK "문항"
        uuid student_id "학생 ID"
        jsonb answer_given "제출 답안"
        response_result result "결과"
        integer time_spent_sec "소요 시간(초)"
        smallint attempt_number "시도 횟수"
        smallint hints_used "힌트 사용"
    }

    %% ──────────────────────────────────────────────
    %% 추천 이벤트
    %% ──────────────────────────────────────────────
    recommendation_event {
        uuid id PK
        uuid org_id FK "조직"
        uuid student_id "학생 ID"
        recommendation_type rec_type "추천 유형"
        uuid_array item_ids "추천 문항"
        jsonb reasoning "추천 근거"
        boolean accepted "수락 여부"
    }

    %% ──────────────────────────────────────────────
    %% 리뷰 태스크
    %% ──────────────────────────────────────────────
    review_task {
        uuid id PK
        uuid org_id FK "조직"
        review_task_type task_type "리뷰 유형"
        review_status status "상태"
        uuid target_item_id FK "대상 문항"
        uuid assignee_id "담당자"
        smallint priority "우선순위 (1-5)"
        text title "태스크 제목"
    }

    %% ──────────────────────────────────────────────
    %% 감사 로그 (불변)
    %% ──────────────────────────────────────────────
    audit_log {
        uuid id PK
        uuid org_id "조직"
        text table_name "대상 테이블"
        uuid record_id "대상 레코드"
        audit_action action "동작"
        jsonb old_data "변경 전"
        jsonb new_data "변경 후"
        uuid performed_by "수행자"
        timestamptz created_at
    }

    %% ──────────────────────────────────────────────
    %% 연결 테이블
    %% ──────────────────────────────────────────────
    item_skill {
        uuid item_id FK PK
        uuid skill_id FK PK
        boolean is_primary "주 스킬"
        numeric weight "관련도"
    }

    item_standard {
        uuid item_id FK PK
        uuid standard_id FK PK
        text alignment "정렬 수준"
    }

    item_misconception {
        uuid item_id FK PK
        uuid misconception_id FK PK
        numeric frequency "발생 빈도"
        integer sample_n "표본 크기"
    }

    item_similarity {
        uuid item_a_id FK PK
        uuid item_b_id FK PK
        similarity_method method PK
        numeric score "유사도 (0-1)"
    }

    skill_standard {
        uuid skill_id FK PK
        uuid standard_id FK PK
    }

    %% ══════════════════════════════════════════════
    %% 관계 정의
    %% ══════════════════════════════════════════════

    %% 조직 -> 하위 엔티티 (멀티 테넌트)
    organization ||--o{ standard : "보유"
    organization ||--o{ skill : "보유"
    organization ||--o{ misconception : "보유"
    organization ||--o{ passage : "보유"
    organization ||--o{ item : "보유"
    organization ||--o{ template : "보유"
    organization ||--o{ assignment : "보유"
    organization ||--o{ student_response : "기록"
    organization ||--o{ recommendation_event : "기록"
    organization ||--o{ review_task : "보유"
    organization ||--o{ prerequisite_edge : "보유"

    %% 문항 핵심 관계
    item ||--o{ item_version : "버전 이력"
    item ||--|| difficulty_profile : "난이도"
    item ||--o{ solution : "풀이 (복수)"
    passage ||--o{ item : "지문 공유"

    %% 문항 M:N 연결
    item ||--o{ item_skill : "스킬 태그"
    skill ||--o{ item_skill : "관련 문항"
    item ||--o{ item_standard : "성취기준 태그"
    standard ||--o{ item_standard : "관련 문항"
    item ||--o{ item_misconception : "오개념 태그"
    misconception ||--o{ item_misconception : "관련 문항"

    %% 문항 유사도 (자기 참조)
    item ||--o{ item_similarity : "유사 문항 A"
    item ||--o{ item_similarity : "유사 문항 B"

    %% 스킬 DAG (선수 학습)
    skill ||--o{ prerequisite_edge : "선수 스킬(from)"
    skill ||--o{ prerequisite_edge : "후속 스킬(to)"

    %% 스킬-성취기준
    skill ||--o{ skill_standard : "관련 성취기준"
    standard ||--o{ skill_standard : "관련 스킬"

    %% 템플릿 -> 변형 -> 문항
    template ||--o{ variant : "생성"
    item ||--o{ variant : "변형 원본"

    %% 과제
    assignment ||--o{ assignment_item : "포함 문항"
    item ||--o{ assignment_item : "소속 과제"

    %% 학생 응답
    item ||--o{ student_response : "응답 대상"
    assignment ||--o{ student_response : "과제 응답"

    %% 추천
    %% (student_id는 외부 시스템이므로 ERD에서 FK 생략)

    %% 리뷰
    item ||--o{ review_task : "리뷰 대상"
```

## 핵심 관계 설명

| 관계 | 카디널리티 | 설명 |
|------|-----------|------|
| Item -- Skill | M:N | `item_skill` 연결 테이블. `is_primary`로 주 스킬 표시 |
| Item -- Standard | M:N | `item_standard` 연결 테이블. 성취기준 정렬 수준 포함 |
| Item -- Misconception | M:N | `item_misconception` 연결 테이블. 발생 빈도 추적 |
| Skill -- Skill | DAG | `prerequisite_edge` 방향 그래프. strong/weak 강도 구분 |
| Item -- Item | M:N | `item_similarity` 자기 참조. 방법별 유사도 점수 |
| Item -- Solution | 1:N | 하나의 문항에 복수 풀이 방법 |
| Item -- ItemVersion | 1:N | 불변 버전 이력 |
| Item -- DifficultyProfile | 1:1 | 4중 난이도 프로필 |
| Item -- Passage | N:1 | 여러 문항이 하나의 지문을 공유 |
| Template -- Variant -- Item | 1:N:1 | 템플릿에서 변형 생성, 각 변형은 문항 하나에 대응 |
| Assignment -- Item | M:N | `assignment_item` 연결 테이블. 순서/배점 포함 |
| StudentResponse -- Item | N:1 | 학생 응답은 특정 문항에 대한 기록 |
| Skill -- Standard | M:N | `skill_standard` 연결 테이블 |

## 인덱스 전략

| 인덱스 유형 | 대상 | 용도 |
|------------|------|------|
| B-tree | `item(org_id, status, school_level, grade)` | 필터링 |
| GiST | `item(topic_path)`, `skill(topic_path)`, `standard(topic_path)` | ltree 계층 검색 |
| GIN | `item(metadata)`, `item(usage_purposes)` | JSONB 및 배열 검색 |
| GIN (trgm) | `item(body_latex)` | 텍스트 유사도 검색 |
| HNSW | `item(embedding)` | 벡터 코사인 유사도 (pgvector) |

## 불변성 패턴

- **item_version**: 문항 변경 시 새 버전 행 삽입 (기존 행 불변)
- **audit_log**: UPDATE/DELETE 차단 (RULE). 모든 변경 이력 영구 보존
- **student_response**: 제출 후 수정 불가 (새 시도는 `attempt_number` 증가)
- **recommendation_event**: 생성 후 `accepted`/`feedback`만 갱신 가능
