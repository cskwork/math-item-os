-- Phase 10: 보안 강화 마이그레이션
-- Row-Level Security (RLS) 정책 + 감사 로그 불변성 강화

-- 1. RLS 활성화 (멀티테넌트 격리)
-- 핵심 테이블에 RLS를 활성화하고 org_id 기반 정책을 설정한다.
-- app.current_org_id 세션 변수로 현재 조직 컨텍스트를 주입한다.

-- items 테이블 RLS
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY items_org_isolation ON items
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));

-- skills 테이블 RLS
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY skills_org_isolation ON skills
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));

-- standards 테이블 RLS
ALTER TABLE standards ENABLE ROW LEVEL SECURITY;

CREATE POLICY standards_org_isolation ON standards
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));

-- misconceptions 테이블 RLS
ALTER TABLE misconceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY misconceptions_org_isolation ON misconceptions
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));

-- templates 테이블 RLS
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY templates_org_isolation ON templates
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));

-- assignments 테이블 RLS
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY assignments_org_isolation ON assignments
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));

-- audit_logs 테이블 RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_org_isolation ON audit_logs
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));

-- recommendation_events 테이블 RLS
ALTER TABLE recommendation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY rec_events_org_isolation ON recommendation_events
  USING (org_id = current_setting('app.current_org_id', true))
  WITH CHECK (org_id = current_setting('app.current_org_id', true));

-- 2. Prisma 서비스 계정은 RLS bypass 허용 (BYPASSRLS 권한)
-- 운영 환경에서 별도 설정 필요:
-- ALTER USER prisma_service SET app.current_org_id = 'default-org';
-- 또는 세션 시작 시 SET LOCAL app.current_org_id = '<org_id>';

-- 3. item_version 불변성 강화 (UPDATE 차단)
CREATE OR REPLACE RULE item_version_no_update AS
  ON UPDATE TO item_versions DO INSTEAD NOTHING;

CREATE OR REPLACE RULE item_version_no_delete AS
  ON DELETE TO item_versions DO INSTEAD NOTHING;
