-- =============================================================================
-- Math Knowledge Graph + Item OS  --  PostgreSQL 17 DDL
-- 수학 문제 은행 플랫폼 스키마 (교사용)
-- 생성일: 2026-04-07
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. 확장 모듈 (Extensions)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID v4 생성
CREATE EXTENSION IF NOT EXISTS "pgcrypto";        -- 암호화 유틸리티
CREATE EXTENSION IF NOT EXISTS "ltree";           -- 계층 구조 (교육과정 분류)
CREATE EXTENSION IF NOT EXISTS "vector";          -- pgvector (유사도 검색)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";         -- 트라이그램 (텍스트 유사도)

-- ---------------------------------------------------------------------------
-- 1. ENUM 타입 정의
-- ---------------------------------------------------------------------------

-- 학교급
CREATE TYPE school_level AS ENUM ('elementary', 'middle', 'high');

-- 학기
CREATE TYPE semester_type AS ENUM ('1', '2');

-- 문항 유형
CREATE TYPE item_type AS ENUM (
    'multiple_choice',   -- 객관식
    'short_answer',      -- 단답형
    'essay',             -- 서술형
    'true_false',        -- 참/거짓
    'fill_in_blank',     -- 빈칸 채우기
    'drag_drop',         -- 드래그 앤 드롭
    'matching'           -- 짝짓기
);

-- 수식 표현 유형
CREATE TYPE formula_type AS ENUM (
    'none',              -- 수식 없음
    'inline',            -- 인라인 수식
    'block',             -- 블록 수식
    'mixed'              -- 혼합
);

-- 답안 형식
CREATE TYPE answer_format AS ENUM (
    'exact_value',       -- 정확한 값
    'expression',        -- 수식
    'multiple_select',   -- 다중 선택
    'range',             -- 범위
    'ordered_list',      -- 순서 리스트
    'free_text'          -- 자유 서술
);

-- 활용 목적
CREATE TYPE usage_purpose AS ENUM (
    'diagnosis',         -- 진단
    'concept_learning',  -- 개념 학습
    'remediation',       -- 보정 학습
    'homework',          -- 숙제
    'pre_exam',          -- 시험 대비
    'advanced'           -- 심화
);

-- 품질 상태
CREATE TYPE quality_status AS ENUM (
    'draft',             -- 초안
    'reviewed',          -- 검토 완료
    'approved',          -- 승인
    'retired'            -- 폐기
);

-- 선수 학습 관계 강도
CREATE TYPE prerequisite_strength AS ENUM (
    'strong',            -- 필수 선수
    'weak'               -- 권장 선수
);

-- 유사도 측정 방법
CREATE TYPE similarity_method AS ENUM (
    'vector_cosine',     -- 벡터 코사인 유사도
    'structural',        -- 구조적 유사도
    'semantic',          -- 의미적 유사도
    'sympy_equiv'        -- SymPy 동치 판별
);

-- 풀이 방법 유형
CREATE TYPE solution_method AS ENUM (
    'standard',          -- 표준 풀이
    'alternative',       -- 대안 풀이
    'visual',            -- 시각적 풀이
    'shortcut'           -- 지름길 풀이
);

-- 리뷰 태스크 유형
CREATE TYPE review_task_type AS ENUM (
    'tag_review',            -- 태그 검토
    'generation_review',     -- 생성 검토
    'duplicate_review',      -- 중복 검토
    'explanation_error'      -- 풀이 오류
);

-- 리뷰 상태
CREATE TYPE review_status AS ENUM (
    'pending',           -- 대기
    'in_progress',       -- 진행 중
    'completed',         -- 완료
    'rejected'           -- 반려
);

-- 감사 로그 동작 유형
CREATE TYPE audit_action AS ENUM (
    'create',
    'update',
    'delete',
    'approve',
    'retire',
    'generate',
    'assign'
);

-- 추천 유형
CREATE TYPE recommendation_type AS ENUM (
    'remediation',       -- 보정 학습 추천
    'advancement',       -- 심화 추천
    'practice',          -- 연습 추천
    'review'             -- 복습 추천
);

-- 학생 응답 결과
CREATE TYPE response_result AS ENUM (
    'correct',           -- 정답
    'incorrect',         -- 오답
    'partial',           -- 부분 정답
    'skipped',           -- 건너뜀
    'timed_out'          -- 시간 초과
);

-- ---------------------------------------------------------------------------
-- 2. 공통 함수: updated_at 자동 갱신 트리거
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 3. 감사 로그 트리거 함수
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_action audit_action;
    v_old_data jsonb;
    v_new_data jsonb;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action := 'create';
        v_old_data := NULL;
        v_new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'update';
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'delete';
        v_old_data := to_jsonb(OLD);
        v_new_data := NULL;
    END IF;

    INSERT INTO audit_log (
        table_name, record_id, action,
        old_data, new_data,
        performed_by, org_id
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        v_action,
        v_old_data,
        v_new_data,
        COALESCE(current_setting('app.current_user_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(current_setting('app.current_org_id', true)::uuid, NULL)
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 4. 조직 (멀티 테넌트)
-- ---------------------------------------------------------------------------
CREATE TABLE organization (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        text NOT NULL,                          -- 조직명
    slug        text NOT NULL UNIQUE,                   -- URL용 슬러그
    settings    jsonb NOT NULL DEFAULT '{}',            -- 조직 설정
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE organization IS '조직 (멀티 테넌트 격리 단위)';

CREATE TRIGGER trg_organization_updated_at
    BEFORE UPDATE ON organization
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. 성취 기준 (Standard) - CASE 프레임워크 호환
-- ---------------------------------------------------------------------------
CREATE TABLE standard (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          uuid NOT NULL REFERENCES organization(id),
    code            text NOT NULL,                      -- 예: KR2022-M2-ALG-1
    title           text NOT NULL,                      -- 성취 기준 제목
    description     text,                               -- 상세 설명
    school_level    school_level NOT NULL,               -- 학교급
    grade           smallint NOT NULL CHECK (grade BETWEEN 1 AND 12),  -- 학년
    semester        semester_type,                       -- 학기
    curriculum_ver  text NOT NULL DEFAULT '2022',        -- 교육과정 버전
    subject         text NOT NULL DEFAULT '수학',        -- 교과
    topic_path      ltree NOT NULL,                     -- 계층 분류 (대단원.중단원.소단원)
    case_uri        text,                               -- CASE 프레임워크 URI
    metadata        jsonb NOT NULL DEFAULT '{}',        -- 추가 메타데이터
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (org_id, code)
);
COMMENT ON TABLE standard IS '성취 기준 (교육과정 기반, CASE 프레임워크 호환)';
COMMENT ON COLUMN standard.topic_path IS '계층 분류 경로 (ltree): 예) math.algebra.linear_eq';

CREATE INDEX idx_standard_org ON standard(org_id);
CREATE INDEX idx_standard_code ON standard(code);
CREATE INDEX idx_standard_topic_path ON standard USING gist(topic_path);
CREATE INDEX idx_standard_level_grade ON standard(school_level, grade);

CREATE TRIGGER trg_standard_updated_at
    BEFORE UPDATE ON standard
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. 스킬 (Skill) - 지식 그래프 노드
-- ---------------------------------------------------------------------------
CREATE TABLE skill (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          uuid NOT NULL REFERENCES organization(id),
    code            text NOT NULL,                      -- 예: solve_linear_eq_distributive
    title           text NOT NULL,                      -- 스킬명
    description     text,                               -- 상세 설명
    topic_path      ltree NOT NULL,                     -- 계층 분류
    bloom_level     smallint CHECK (bloom_level BETWEEN 1 AND 6),  -- 블룸 분류 수준
    estimated_time_min  smallint,                       -- 예상 소요 시간(분)
    metadata        jsonb NOT NULL DEFAULT '{}',        -- 추가 메타데이터
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (org_id, code)
);
COMMENT ON TABLE skill IS '스킬 노드 (지식 그래프의 정점)';

CREATE INDEX idx_skill_org ON skill(org_id);
CREATE INDEX idx_skill_code ON skill(code);
CREATE INDEX idx_skill_topic_path ON skill USING gist(topic_path);

CREATE TRIGGER trg_skill_updated_at
    BEFORE UPDATE ON skill
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. 선수 학습 관계 (PrerequisiteEdge) - 스킬 DAG
-- ---------------------------------------------------------------------------
CREATE TABLE prerequisite_edge (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          uuid NOT NULL REFERENCES organization(id),
    from_skill_id   uuid NOT NULL REFERENCES skill(id) ON DELETE CASCADE,   -- 선수 스킬
    to_skill_id     uuid NOT NULL REFERENCES skill(id) ON DELETE CASCADE,   -- 후속 스킬
    strength        prerequisite_strength NOT NULL DEFAULT 'strong',        -- 관계 강도
    weight          numeric(3,2) NOT NULL DEFAULT 1.00 CHECK (weight BETWEEN 0 AND 1),  -- 가중치
    metadata        jsonb NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (org_id, from_skill_id, to_skill_id),
    CHECK (from_skill_id <> to_skill_id)    -- 자기 참조 방지
);
COMMENT ON TABLE prerequisite_edge IS '선수 학습 관계 (스킬 간 방향 그래프 간선)';
COMMENT ON COLUMN prerequisite_edge.from_skill_id IS '선수 스킬 (이 스킬을 먼저 학습해야 함)';
COMMENT ON COLUMN prerequisite_edge.to_skill_id IS '후속 스킬 (이 스킬을 학습하려면 선수 스킬이 필요)';

CREATE INDEX idx_prereq_from ON prerequisite_edge(from_skill_id);
CREATE INDEX idx_prereq_to ON prerequisite_edge(to_skill_id);
CREATE INDEX idx_prereq_org ON prerequisite_edge(org_id);

-- ---------------------------------------------------------------------------
-- 8. 오개념 (Misconception)
-- ---------------------------------------------------------------------------
CREATE TABLE misconception (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          uuid NOT NULL REFERENCES organization(id),
    code            text NOT NULL,                      -- 예: sign_error_transposition
    title           text NOT NULL,                      -- 오개념명
    description     text,                               -- 상세 설명
    typical_error   text,                               -- 대표적 오류 예시
    remediation     text,                               -- 교정 방법
    severity        smallint NOT NULL DEFAULT 3 CHECK (severity BETWEEN 1 AND 5),  -- 심각도 (1=경미, 5=심각)
    related_skills  uuid[] DEFAULT '{}',                -- 관련 스킬 ID 목록 (비정규화 캐시)
    metadata        jsonb NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (org_id, code)
);
COMMENT ON TABLE misconception IS '학생 오개념 (자주 발생하는 수학적 오류 유형)';

CREATE INDEX idx_misconception_org ON misconception(org_id);
CREATE INDEX idx_misconception_code ON misconception(code);

CREATE TRIGGER trg_misconception_updated_at
    BEFORE UPDATE ON misconception
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. 지문/자극 (Passage / Stimulus) - 공유 지문
-- ---------------------------------------------------------------------------
CREATE TABLE passage (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          uuid NOT NULL REFERENCES organization(id),
    title           text NOT NULL,                      -- 지문 제목
    body_latex      text NOT NULL,                      -- LaTeX 본문
    body_mathml     text,                               -- MathML 본문
    body_html       text,                               -- 렌더링된 HTML
    media_urls      jsonb NOT NULL DEFAULT '[]',        -- 이미지/동영상 URL 목록
    metadata        jsonb NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE passage IS '공유 지문/자극 (여러 문항이 참조하는 공통 지문)';

CREATE INDEX idx_passage_org ON passage(org_id);

CREATE TRIGGER trg_passage_updated_at
    BEFORE UPDATE ON passage
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- 10. 문항 (Item) - 핵심 엔티티
-- ---------------------------------------------------------------------------
CREATE TABLE item (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          uuid NOT NULL REFERENCES organization(id),
    passage_id      uuid REFERENCES passage(id),        -- 공유 지문 참조 (NULL 가능)

    -- 문항 본문 (삼중 표현)
    body_latex      text NOT NULL,                      -- LaTeX 원문
    body_mathml     text,                               -- MathML 변환
    body_sympy      text,                               -- SymPy AST 문자열
    body_html       text,                               -- 렌더링된 HTML

    -- 선택지 (객관식 등)
    choices         jsonb,                              -- [{label, latex, mathml, is_correct}]

    -- 정답
    answer          jsonb NOT NULL,                     -- {value, format, tolerance, alternatives}

    -- 분류 메타데이터
    school_level    school_level NOT NULL,
    grade           smallint NOT NULL CHECK (grade BETWEEN 1 AND 12),
    semester        semester_type,
    curriculum_ver  text NOT NULL DEFAULT '2022',
    subject         text NOT NULL DEFAULT '수학',
    major_unit      text,                               -- 대단원
    medium_unit     text,                               -- 중단원
    minor_unit      text,                               -- 소단원
    topic_path      ltree,                              -- 계층 분류

    -- 문항 속성
    item_type       item_type NOT NULL DEFAULT 'short_answer',
    formula_type    formula_type NOT NULL DEFAULT 'inline',
    answer_format   answer_format NOT NULL DEFAULT 'exact_value',
    solution_steps  smallint NOT NULL DEFAULT 1 CHECK (solution_steps >= 1),  -- 풀이 단계 수
    usage_purposes  usage_purpose[] NOT NULL DEFAULT '{}',                    -- 활용 목적 (복수)

    -- 난이도 (4중 난이도 프로필은 difficulty_profile 테이블에 저장)
    difficulty_author    smallint CHECK (difficulty_author BETWEEN 1 AND 5),  -- 출제자 체감 난이도

    -- 품질 상태
    status          quality_status NOT NULL DEFAULT 'draft',

    -- 생성 관련
    is_generated    boolean NOT NULL DEFAULT false,     -- AI 생성 여부
    template_id     uuid,                               -- 생성 원본 템플릿 (NULL이면 직접 출제)

    -- 저작권/출처
    source          text,                               -- 출처 (예: 2024 중2 기출)
    copyright       text,                               -- 저작권 정보
    permissions     jsonb NOT NULL DEFAULT '{}',        -- 사용 허가 정보

    -- 벡터 임베딩 (유사도 검색용)
    embedding       vector(768),                        -- 문항 벡터 임베딩

    -- 현재 버전
    current_version smallint NOT NULL DEFAULT 1,

    -- 추가 메타데이터 (JSONB 유연 확장)
    metadata        jsonb NOT NULL DEFAULT '{}',

    created_by      uuid,                               -- 출제자 ID
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE item IS '문항 (수학 문제 본문 및 메타데이터)';
COMMENT ON COLUMN item.body_latex IS '문항 본문 LaTeX 원문';
COMMENT ON COLUMN item.body_mathml IS '문항 본문 MathML (브라우저 렌더링용)';
COMMENT ON COLUMN item.body_sympy IS '문항 본문 SymPy AST (수식 검증용)';
COMMENT ON COLUMN item.embedding IS '문항 벡터 임베딩 (768차원, 유사도 검색용)';
COMMENT ON COLUMN item.topic_path IS '계층 분류 경로: 예) math.algebra.linear_eq.distributive';

-- B-tree 인덱스 (필터링)
CREATE INDEX idx_item_org ON item(org_id);
CREATE INDEX idx_item_status ON item(status);
CREATE INDEX idx_item_school_grade ON item(school_level, grade);
CREATE INDEX idx_item_type ON item(item_type);
CREATE INDEX idx_item_difficulty ON item(difficulty_author);
CREATE INDEX idx_item_template ON item(template_id);
CREATE INDEX idx_item_passage ON item(passage_id);
CREATE INDEX idx_item_created_by ON item(created_by);
CREATE INDEX idx_item_created_at ON item(created_at DESC);

-- ltree 인덱스 (계층 검색)
CREATE INDEX idx_item_topic_path ON item USING gist(topic_path);

-- GIN 인덱스 (JSONB 검색, 전문 검색)
CREATE INDEX idx_item_metadata ON item USING gin(metadata jsonb_path_ops);
CREATE INDEX idx_item_choices ON item USING gin(choices jsonb_path_ops);
CREATE INDEX idx_item_usage ON item USING gin(usage_purposes);

-- HNSW 인덱스 (벡터 유사도 검색)
CREATE INDEX idx_item_embedding ON item USING hnsw(embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- 전문 검색 인덱스 (한국어)
CREATE INDEX idx_item_body_trgm ON item USING gin(body_latex gin_trgm_ops);

CREATE TRIGGER trg_item_updated_at
    BEFORE UPDATE ON item
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_item_audit
    AFTER INSERT OR UPDATE OR DELETE ON item
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ---------------------------------------------------------------------------
-- 11. 문항 버전 (ItemVersion) - 불변 버전 이력
-- ---------------------------------------------------------------------------
CREATE TABLE item_version (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id         uuid NOT NULL REFERENCES item(id) ON DELETE CASCADE,
    version         smallint NOT NULL,
    body_latex      text NOT NULL,
    body_mathml     text,
    body_sympy      text,
    body_html       text,
    choices         jsonb,
    answer          jsonb NOT NULL,
    metadata        jsonb NOT NULL DEFAULT '{}',
    change_summary  text,                               -- 변경 사항 요약
    created_by      uuid,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (item_id, version)
);
COMMENT ON TABLE item_version IS '문항 버전 이력 (불변 스냅샷)';

CREATE INDEX idx_item_version_item ON item_version(item_id);

-- 버전 자동 증가 트리거
CREATE OR REPLACE FUNCTION fn_item_version_increment()
RETURNS TRIGGER AS $$
BEGIN
    -- 해당 item의 current_version 증가
    UPDATE item
    SET current_version = NEW.version
    WHERE id = NEW.item_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_item_version_increment
    AFTER INSERT ON item_version
    FOR EACH ROW EXECUTE FUNCTION fn_item_version_increment();

-- ---------------------------------------------------------------------------
-- 12. 난이도 프로필 (DifficultyProfile) - 4중 난이도
-- ---------------------------------------------------------------------------
CREATE TABLE difficulty_profile (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id             uuid NOT NULL REFERENCES item(id) ON DELETE CASCADE,
    -- 출제자 체감 난이도
    author_difficulty   smallint CHECK (author_difficulty BETWEEN 1 AND 5),
    -- 행동 기반 난이도 (학생 응답 데이터 기반)
    behavioral_difficulty numeric(4,3),                 -- 0.000 ~ 1.000 (정답률 역수)
    behavioral_sample_n   integer DEFAULT 0,            -- 표본 크기
    -- IRT 파라미터
    irt_difficulty      numeric(5,3),                   -- IRT b 파라미터 (난이도)
    irt_discrimination  numeric(5,3),                   -- IRT a 파라미터 (변별도)
    irt_guessing        numeric(4,3),                   -- IRT c 파라미터 (추측)
    irt_model           text DEFAULT '2PL',             -- IRT 모형 (1PL/2PL/3PL)
    -- 교사 체감 난이도
    teacher_perceived   numeric(3,1),                   -- 교사 체감 (1.0 ~ 5.0)
    teacher_sample_n    integer DEFAULT 0,              -- 교사 표본 크기
    -- 메타
    last_calibrated_at  timestamptz,                    -- 마지막 보정 시각
    metadata            jsonb NOT NULL DEFAULT '{}',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (item_id)
);
COMMENT ON TABLE difficulty_profile IS '난이도 프로필 (출제자/행동/IRT/교사 체감 4중 난이도)';
COMMENT ON COLUMN difficulty_profile.irt_difficulty IS 'IRT b 파라미터: 난이도 (-3 ~ +3 범위)';
COMMENT ON COLUMN difficulty_profile.irt_discrimination IS 'IRT a 파라미터: 변별도 (0 ~ 3 범위)';

CREATE INDEX idx_diff_profile_item ON difficulty_profile(item_id);

CREATE TRIGGER trg_diff_profile_updated_at
    BEFORE UPDATE ON difficulty_profile
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- 13. 풀이 (Solution) - 단계별 풀이 및 해설
-- ---------------------------------------------------------------------------
CREATE TABLE solution (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id         uuid NOT NULL REFERENCES item(id) ON DELETE CASCADE,
    method          solution_method NOT NULL DEFAULT 'standard',
    title           text,                               -- 풀이 제목 (예: "분배법칙 활용")
    steps           jsonb NOT NULL,                     -- [{step_num, latex, explanation, hint}]
    final_answer    text NOT NULL,                      -- 최종 답
    explanation     text,                               -- 종합 해설
    video_url       text,                               -- 풀이 영상 URL
    version         smallint NOT NULL DEFAULT 1,
    created_by      uuid,
    metadata        jsonb NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE solution IS '풀이 (문항별 단계별 풀이, 복수 풀이 방법 지원)';

CREATE INDEX idx_solution_item ON solution(item_id);
CREATE INDEX idx_solution_method ON solution(method);

CREATE TRIGGER trg_solution_updated_at
    BEFORE UPDATE ON solution
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- 14. 템플릿 (Template) - 매개변수화된 문항 생성 템플릿
-- ---------------------------------------------------------------------------
CREATE TABLE template (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          uuid NOT NULL REFERENCES organization(id),
    title           text NOT NULL,                      -- 템플릿 제목
    description     text,                               -- 설명
    body_template   text NOT NULL,                      -- 본문 템플릿 (변수 포함 LaTeX)
    parameters      jsonb NOT NULL,                     -- 매개변수 정의 [{name, type, range, constraints}]
    answer_template text NOT NULL,                      -- 답안 생성 규칙
    constraints     jsonb NOT NULL DEFAULT '{}',        -- 제약 조건 (정수 해 보장 등)
    skill_ids       uuid[] DEFAULT '{}',                -- 관련 스킬 (비정규화 캐시)
    school_level    school_level,
    grade           smallint,
    topic_path      ltree,
    variant_count   integer NOT NULL DEFAULT 0,         -- 생성된 변형 수
    metadata        jsonb NOT NULL DEFAULT '{}',
    created_by      uuid,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE template IS '문항 생성 템플릿 (매개변수화된 문제 틀)';

CREATE INDEX idx_template_org ON template(org_id);
CREATE INDEX idx_template_topic ON template USING gist(topic_path);

CREATE TRIGGER trg_template_updated_at
    BEFORE UPDATE ON template
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- 15. 변형 (Variant) - 템플릿에서 생성된 문항 인스턴스
-- ---------------------------------------------------------------------------
CREATE TABLE variant (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id     uuid NOT NULL REFERENCES template(id) ON DELETE CASCADE,
    item_id         uuid NOT NULL REFERENCES item(id) ON DELETE CASCADE,     -- 생성된 문항
    param_values    jsonb NOT NULL,                     -- 실제 매개변수 값
    seed            bigint,                             -- 랜덤 시드 (재현성)
    generation_log  jsonb NOT NULL DEFAULT '{}',        -- 생성 과정 로그
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (template_id, item_id)
);
COMMENT ON TABLE variant IS '변형 문항 (템플릿에서 생성된 구체적 인스턴스)';

CREATE INDEX idx_variant_template ON variant(template_id);
CREATE INDEX idx_variant_item ON variant(item_id);

-- ---------------------------------------------------------------------------
-- 16. 연결 테이블: 문항-스킬 (M:N)
-- ---------------------------------------------------------------------------
CREATE TABLE item_skill (
    item_id         uuid NOT NULL REFERENCES item(id) ON DELETE CASCADE,
    skill_id        uuid NOT NULL REFERENCES skill(id) ON DELETE CASCADE,
    is_primary      boolean NOT NULL DEFAULT false,     -- 주 스킬 여부
    weight          numeric(3,2) NOT NULL DEFAULT 1.00, -- 관련도 가중치
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (item_id, skill_id)
);
COMMENT ON TABLE item_skill IS '문항-스킬 연결 (M:N)';

CREATE INDEX idx_item_skill_skill ON item_skill(skill_id);

-- ---------------------------------------------------------------------------
-- 17. 연결 테이블: 문항-성취기준 (M:N)
-- ---------------------------------------------------------------------------
CREATE TABLE item_standard (
    item_id         uuid NOT NULL REFERENCES item(id) ON DELETE CASCADE,
    standard_id     uuid NOT NULL REFERENCES standard(id) ON DELETE CASCADE,
    alignment       text,                               -- 정렬 수준 (예: primary, secondary)
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (item_id, standard_id)
);
COMMENT ON TABLE item_standard IS '문항-성취기준 연결 (M:N)';

CREATE INDEX idx_item_standard_standard ON item_standard(standard_id);

-- ---------------------------------------------------------------------------
-- 18. 연결 테이블: 문항-오개념 (M:N)
-- ---------------------------------------------------------------------------
CREATE TABLE item_misconception (
    item_id             uuid NOT NULL REFERENCES item(id) ON DELETE CASCADE,
    misconception_id    uuid NOT NULL REFERENCES misconception(id) ON DELETE CASCADE,
    frequency           numeric(4,3) DEFAULT 0.000,     -- 발생 빈도 (0~1)
    sample_n            integer DEFAULT 0,              -- 표본 크기
    created_at          timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (item_id, misconception_id)
);
COMMENT ON TABLE item_misconception IS '문항-오개념 연결 (M:N, 빈도 추적)';

CREATE INDEX idx_item_misconception_misc ON item_misconception(misconception_id);

-- ---------------------------------------------------------------------------
-- 19. 문항 유사도 (Item Similarity) - 자기 참조 M:N
-- ---------------------------------------------------------------------------
CREATE TABLE item_similarity (
    item_a_id       uuid NOT NULL REFERENCES item(id) ON DELETE CASCADE,
    item_b_id       uuid NOT NULL REFERENCES item(id) ON DELETE CASCADE,
    score           numeric(4,3) NOT NULL CHECK (score BETWEEN 0 AND 1),   -- 유사도 점수
    method          similarity_method NOT NULL,
    metadata        jsonb NOT NULL DEFAULT '{}',        -- 상세 비교 결과
    computed_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (item_a_id, item_b_id, method),
    CHECK (item_a_id < item_b_id)                       -- 중복 방지 (정규화)
);
COMMENT ON TABLE item_similarity IS '문항 간 유사도 (방법별 유사도 점수)';
COMMENT ON COLUMN item_similarity.score IS '유사도 점수 (0=완전 다름, 1=동일)';

CREATE INDEX idx_item_sim_b ON item_similarity(item_b_id);
CREATE INDEX idx_item_sim_score ON item_similarity(score DESC);

-- ---------------------------------------------------------------------------
-- 20. 스킬-성취기준 연결 (M:N)
-- ---------------------------------------------------------------------------
CREATE TABLE skill_standard (
    skill_id        uuid NOT NULL REFERENCES skill(id) ON DELETE CASCADE,
    standard_id     uuid NOT NULL REFERENCES standard(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (skill_id, standard_id)
);
COMMENT ON TABLE skill_standard IS '스킬-성취기준 연결 (M:N)';

-- ---------------------------------------------------------------------------
-- 21. 과제 (Assignment) - 학습지/숙제
-- ---------------------------------------------------------------------------
CREATE TABLE assignment (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          uuid NOT NULL REFERENCES organization(id),
    title           text NOT NULL,                      -- 과제 제목
    description     text,                               -- 과제 설명
    purpose         usage_purpose,                      -- 과제 목적
    school_level    school_level,
    grade           smallint,
    target_skills   uuid[] DEFAULT '{}',                -- 대상 스킬 (비정규화 캐시)
    time_limit_min  smallint,                           -- 제한 시간(분)
    is_published    boolean NOT NULL DEFAULT false,     -- 공개 여부
    published_at    timestamptz,                        -- 공개 시각
    due_at          timestamptz,                        -- 마감 시각
    settings        jsonb NOT NULL DEFAULT '{}',        -- 과제 설정 (순서 섞기 등)
    created_by      uuid,
    metadata        jsonb NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE assignment IS '과제 (학습지, 숙제, 시험지)';

CREATE INDEX idx_assignment_org ON assignment(org_id);
CREATE INDEX idx_assignment_published ON assignment(is_published, published_at DESC);

CREATE TRIGGER trg_assignment_updated_at
    BEFORE UPDATE ON assignment
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- 22. 과제-문항 연결 (M:N, 순서 보존)
-- ---------------------------------------------------------------------------
CREATE TABLE assignment_item (
    assignment_id   uuid NOT NULL REFERENCES assignment(id) ON DELETE CASCADE,
    item_id         uuid NOT NULL REFERENCES item(id) ON DELETE CASCADE,
    position        smallint NOT NULL,                  -- 문항 순서
    points          numeric(5,1) NOT NULL DEFAULT 1.0,  -- 배점
    is_required     boolean NOT NULL DEFAULT true,      -- 필수 여부
    metadata        jsonb NOT NULL DEFAULT '{}',
    PRIMARY KEY (assignment_id, item_id),
    UNIQUE (assignment_id, position)
);
COMMENT ON TABLE assignment_item IS '과제-문항 연결 (순서 및 배점 포함)';

CREATE INDEX idx_assign_item_item ON assignment_item(item_id);

-- ---------------------------------------------------------------------------
-- 23. 학생 응답 (StudentResponse)
-- ---------------------------------------------------------------------------
CREATE TABLE student_response (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          uuid NOT NULL REFERENCES organization(id),
    assignment_id   uuid REFERENCES assignment(id),     -- NULL이면 독립 풀이
    item_id         uuid NOT NULL REFERENCES item(id),
    student_id      uuid NOT NULL,                      -- 학생 ID (외부 시스템)

    -- 응답 데이터
    answer_given    jsonb NOT NULL,                     -- 학생 제출 답안
    result          response_result NOT NULL,           -- 결과
    score           numeric(5,1),                       -- 획득 점수
    max_score       numeric(5,1),                       -- 만점

    -- 행동 데이터
    time_spent_sec  integer,                            -- 소요 시간(초)
    attempt_number  smallint NOT NULL DEFAULT 1,        -- 시도 횟수
    hints_used      smallint NOT NULL DEFAULT 0,        -- 힌트 사용 횟수

    -- 오개념 태깅
    misconception_ids uuid[] DEFAULT '{}',              -- 감지된 오개념

    -- 메타
    device_info     jsonb NOT NULL DEFAULT '{}',        -- 디바이스 정보
    metadata        jsonb NOT NULL DEFAULT '{}',
    submitted_at    timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE student_response IS '학생 응답 (정오답, 소요 시간, 오개념 추적)';

CREATE INDEX idx_response_org ON student_response(org_id);
CREATE INDEX idx_response_student ON student_response(student_id);
CREATE INDEX idx_response_item ON student_response(item_id);
CREATE INDEX idx_response_assignment ON student_response(assignment_id);
CREATE INDEX idx_response_result ON student_response(result);
CREATE INDEX idx_response_submitted ON student_response(submitted_at DESC);
CREATE INDEX idx_response_misconceptions ON student_response USING gin(misconception_ids);

-- ---------------------------------------------------------------------------
-- 24. 추천 이벤트 (RecommendationEvent)
-- ---------------------------------------------------------------------------
CREATE TABLE recommendation_event (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          uuid NOT NULL REFERENCES organization(id),
    student_id      uuid NOT NULL,                      -- 추천 대상 학생
    rec_type        recommendation_type NOT NULL,       -- 추천 유형
    item_ids        uuid[] NOT NULL,                    -- 추천된 문항 목록
    skill_ids       uuid[] DEFAULT '{}',                -- 관련 스킬
    reasoning       jsonb NOT NULL,                     -- 추천 근거 (AI 설명)
    model_version   text,                               -- 추천 모델 버전
    accepted        boolean,                            -- 수락 여부 (NULL=미확인)
    feedback        text,                               -- 교사 피드백
    metadata        jsonb NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE recommendation_event IS '추천 이벤트 (AI 기반 문항 추천 기록 및 근거)';

CREATE INDEX idx_rec_event_org ON recommendation_event(org_id);
CREATE INDEX idx_rec_event_student ON recommendation_event(student_id);
CREATE INDEX idx_rec_event_type ON recommendation_event(rec_type);
CREATE INDEX idx_rec_event_created ON recommendation_event(created_at DESC);

-- ---------------------------------------------------------------------------
-- 25. 리뷰 태스크 (ReviewTask)
-- ---------------------------------------------------------------------------
CREATE TABLE review_task (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          uuid NOT NULL REFERENCES organization(id),
    task_type       review_task_type NOT NULL,           -- 리뷰 유형
    status          review_status NOT NULL DEFAULT 'pending',
    target_item_id  uuid REFERENCES item(id),           -- 대상 문항
    target_ids      uuid[] DEFAULT '{}',                -- 복수 대상 (중복 검토 등)
    assignee_id     uuid,                               -- 담당자
    priority        smallint NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),  -- 우선순위
    title           text NOT NULL,                      -- 태스크 제목
    description     text,                               -- 상세 설명
    resolution      text,                               -- 해결 내용
    resolved_at     timestamptz,                        -- 해결 시각
    due_at          timestamptz,                        -- 마감 시각
    metadata        jsonb NOT NULL DEFAULT '{}',
    created_by      uuid,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE review_task IS '리뷰 태스크 (태그 검토, 중복 검토, 풀이 오류 등)';

CREATE INDEX idx_review_org ON review_task(org_id);
CREATE INDEX idx_review_status ON review_task(status);
CREATE INDEX idx_review_type ON review_task(task_type);
CREATE INDEX idx_review_assignee ON review_task(assignee_id);
CREATE INDEX idx_review_target_item ON review_task(target_item_id);

CREATE TRIGGER trg_review_task_updated_at
    BEFORE UPDATE ON review_task
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- 26. 감사 로그 (AuditLog) - 불변 기록
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          uuid,
    table_name      text NOT NULL,                      -- 대상 테이블명
    record_id       uuid NOT NULL,                      -- 대상 레코드 ID
    action          audit_action NOT NULL,              -- 동작 유형
    old_data        jsonb,                              -- 변경 전 데이터
    new_data        jsonb,                              -- 변경 후 데이터
    performed_by    uuid NOT NULL,                      -- 수행자 ID
    ip_address      inet,                               -- IP 주소
    user_agent      text,                               -- 사용자 에이전트
    created_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE audit_log IS '감사 로그 (모든 데이터 변경 불변 기록)';

-- 감사 로그는 불변이므로 UPDATE/DELETE 방지
CREATE RULE audit_log_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;

CREATE INDEX idx_audit_table ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_performer ON audit_log(performed_by);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_org ON audit_log(org_id);

-- ---------------------------------------------------------------------------
-- 27. 추가 감사 트리거 (주요 테이블에 적용)
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_solution_audit
    AFTER INSERT OR UPDATE OR DELETE ON solution
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_assignment_audit
    AFTER INSERT OR UPDATE OR DELETE ON assignment
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_template_audit
    AFTER INSERT OR UPDATE OR DELETE ON template
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- =============================================================================
-- 예시: PRD 샘플 문항이 테이블에 매핑되는 방식
-- =============================================================================
/*
다음 문항을 예시로 데이터 매핑을 보여줍니다:
  "2(x-3) = 10 을 풀어라"

-- (1) item 테이블
INSERT INTO item (
    org_id, body_latex, body_mathml, body_sympy,
    school_level, grade, semester, curriculum_ver,
    subject, major_unit, medium_unit, minor_unit,
    topic_path,
    item_type, formula_type, answer_format, solution_steps,
    usage_purposes, difficulty_author, status
) VALUES (
    '11111111-...',
    '2(x-3)=10 \text{을 풀어라}',
    '<math><mn>2</mn><mo>(</mo><mi>x</mi><mo>-</mo><mn>3</mn><mo>)</mo><mo>=</mo><mn>10</mn></math>',
    'Eq(2*(x-3),10)',
    'middle', 8, '1', '2022',
    '수학', '문자와 식', '일차방정식', '분배법칙이 있는 일차방정식',
    'math.algebra.linear_eq.distributive',
    'short_answer', 'block', 'exact_value', 3,
    ARRAY['concept_learning','homework']::usage_purpose[],
    2, 'approved'
);

-- (2) item_skill 연결
INSERT INTO item_skill (item_id, skill_id, is_primary, weight)
VALUES ('item-uuid', 'skill-uuid-for-solve_linear_eq_distributive', true, 1.00);

-- (3) item_standard 연결
INSERT INTO item_standard (item_id, standard_id, alignment)
VALUES ('item-uuid', 'std-uuid-for-KR2022-M2-ALG-1', 'primary');

-- (4) item_misconception 연결
INSERT INTO item_misconception (item_id, misconception_id, frequency)
VALUES ('item-uuid', 'misc-uuid-for-sign_error_transposition', 0.32);

-- (5) difficulty_profile
INSERT INTO difficulty_profile (
    item_id, author_difficulty,
    behavioral_difficulty, behavioral_sample_n,
    irt_difficulty, irt_discrimination, irt_model
) VALUES (
    'item-uuid', 2,
    0.720, 1500,
    -0.850, 1.200, '2PL'
);

-- (6) solution
INSERT INTO solution (item_id, method, steps, final_answer, explanation)
VALUES (
    'item-uuid', 'standard',
    '[
        {"step_num":1, "latex":"2(x-3)=10",      "explanation":"주어진 방정식"},
        {"step_num":2, "latex":"2x-6=10",         "explanation":"분배법칙 적용"},
        {"step_num":3, "latex":"2x=16",           "explanation":"양변에 6을 더함"},
        {"step_num":4, "latex":"x=8",             "explanation":"양변을 2로 나눔"}
    ]'::jsonb,
    'x=8',
    '분배법칙을 사용하여 괄호를 풀고, 이항하여 x의 값을 구합니다.'
);

-- 삼중 표현 JSON (representations) 구조:
-- {
--   "latex": "2(x-3)=10",
--   "mathml": "<math>...</math>",
--   "sympy": "Eq(2*(x-3),10)"
-- }
-- → item 테이블의 body_latex, body_mathml, body_sympy 컬럼에 각각 매핑
*/

-- =============================================================================
-- 핵심 쿼리 예시
-- =============================================================================

/*
-- ─────────────────────────────────────────────────────────────
-- [쿼리 1] 선수 학습 체인 조회 (WITH RECURSIVE CTE)
-- 특정 스킬의 모든 선수 스킬을 재귀적으로 탐색
-- ─────────────────────────────────────────────────────────────
WITH RECURSIVE prereq_chain AS (
    -- 기본: 시작 스킬
    SELECT
        pe.from_skill_id,
        pe.to_skill_id,
        pe.strength,
        pe.weight,
        1 AS depth,
        ARRAY[pe.to_skill_id] AS path
    FROM prerequisite_edge pe
    WHERE pe.to_skill_id = :target_skill_id
      AND pe.org_id = :org_id

    UNION ALL

    -- 재귀: 선수 스킬의 선수 스킬
    SELECT
        pe.from_skill_id,
        pe.to_skill_id,
        pe.strength,
        pe.weight,
        pc.depth + 1,
        pc.path || pe.to_skill_id
    FROM prerequisite_edge pe
    JOIN prereq_chain pc ON pe.to_skill_id = pc.from_skill_id
    WHERE pe.org_id = :org_id
      AND pe.to_skill_id <> ALL(pc.path)  -- 순환 방지
      AND pc.depth < 10                    -- 깊이 제한
)
SELECT
    s.code AS skill_code,
    s.title AS skill_title,
    pc.strength,
    pc.weight,
    pc.depth
FROM prereq_chain pc
JOIN skill s ON s.id = pc.from_skill_id
ORDER BY pc.depth, pc.weight DESC;
*/

/*
-- ─────────────────────────────────────────────────────────────
-- [쿼리 2] 벡터 유사도 검색 (pgvector HNSW)
-- 주어진 문항과 가장 유사한 문항 K개 검색
-- ─────────────────────────────────────────────────────────────
SELECT
    i.id,
    i.body_latex,
    i.school_level,
    i.grade,
    i.status,
    1 - (i.embedding <=> :query_embedding) AS cosine_similarity
FROM item i
WHERE i.org_id = :org_id
  AND i.status = 'approved'
  AND i.id <> :source_item_id
ORDER BY i.embedding <=> :query_embedding
LIMIT 20;
*/

/*
-- ─────────────────────────────────────────────────────────────
-- [쿼리 3] 다면 검색 (Faceted Search)
-- 학교급, 학년, 난이도, 스킬, 문항 유형 등 복합 필터
-- ─────────────────────────────────────────────────────────────
SELECT
    i.id,
    i.body_latex,
    i.school_level,
    i.grade,
    i.item_type,
    i.difficulty_author,
    i.status,
    dp.behavioral_difficulty,
    dp.irt_difficulty,
    array_agg(DISTINCT s.code) AS skill_codes,
    array_agg(DISTINCT st.code) AS standard_codes
FROM item i
LEFT JOIN difficulty_profile dp ON dp.item_id = i.id
LEFT JOIN item_skill isk ON isk.item_id = i.id
LEFT JOIN skill s ON s.id = isk.skill_id
LEFT JOIN item_standard ist ON ist.item_id = i.id
LEFT JOIN standard st ON st.id = ist.standard_id
WHERE i.org_id = :org_id
  AND i.status = 'approved'
  AND i.school_level = 'middle'
  AND i.grade = 8
  AND i.item_type = 'short_answer'
  AND i.difficulty_author BETWEEN 2 AND 4
  AND i.topic_path <@ 'math.algebra.linear_eq'::ltree
  AND (:skill_id IS NULL OR isk.skill_id = :skill_id)
  AND (:usage_purpose IS NULL OR :usage_purpose = ANY(i.usage_purposes))
GROUP BY i.id, dp.behavioral_difficulty, dp.irt_difficulty
ORDER BY i.created_at DESC
LIMIT 50 OFFSET 0;
*/

/*
-- ─────────────────────────────────────────────────────────────
-- [쿼리 4] 학생 오개념 분석
-- 특정 학생의 오개념 빈도를 집계하여 보정 학습 대상 식별
-- ─────────────────────────────────────────────────────────────
SELECT
    m.code AS misconception_code,
    m.title AS misconception_title,
    m.severity,
    count(*) AS occurrence_count,
    count(*) FILTER (WHERE sr.submitted_at > now() - interval '30 days') AS recent_count
FROM student_response sr,
     unnest(sr.misconception_ids) AS mid(misconception_id)
JOIN misconception m ON m.id = mid.misconception_id
WHERE sr.student_id = :student_id
  AND sr.org_id = :org_id
  AND sr.result = 'incorrect'
GROUP BY m.id, m.code, m.title, m.severity
ORDER BY recent_count DESC, m.severity DESC;
*/

/*
-- ─────────────────────────────────────────────────────────────
-- [쿼리 5] 계층 구조 검색 (ltree)
-- 특정 단원 하위의 모든 문항 조회
-- ─────────────────────────────────────────────────────────────
SELECT i.id, i.body_latex, i.topic_path, i.difficulty_author
FROM item i
WHERE i.org_id = :org_id
  AND i.topic_path <@ 'math.algebra'::ltree     -- 대수 하위 전체
  AND i.status = 'approved'
ORDER BY i.topic_path, i.difficulty_author;
*/

/*
-- ─────────────────────────────────────────────────────────────
-- [쿼리 6] 과제 결과 대시보드
-- 특정 과제의 문항별 정답률 및 평균 소요 시간
-- ─────────────────────────────────────────────────────────────
SELECT
    ai.position,
    i.body_latex,
    i.item_type,
    count(sr.id) AS total_responses,
    count(*) FILTER (WHERE sr.result = 'correct') AS correct_count,
    round(
        count(*) FILTER (WHERE sr.result = 'correct')::numeric
        / NULLIF(count(sr.id), 0) * 100, 1
    ) AS correct_rate_pct,
    round(avg(sr.time_spent_sec)::numeric, 1) AS avg_time_sec
FROM assignment_item ai
JOIN item i ON i.id = ai.item_id
LEFT JOIN student_response sr ON sr.item_id = ai.item_id
    AND sr.assignment_id = ai.assignment_id
WHERE ai.assignment_id = :assignment_id
GROUP BY ai.position, i.id, i.body_latex, i.item_type
ORDER BY ai.position;
*/

-- =============================================================================
-- 끝. 스키마 버전: 1.0.0
-- =============================================================================
