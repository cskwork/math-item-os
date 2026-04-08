-- Phase 10: 성능 최적화 마이그레이션
-- pgvector HNSW 인덱스 + pg_trgm 인덱스 + 감사 로그 불변성 규칙
-- 주의: Prisma 스키마에 @map 없으므로 컬럼명은 camelCase

-- 1. 임베딩 컬럼 추가 (없을 경우)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'items' AND column_name = 'embedding'
  ) THEN
    ALTER TABLE items ADD COLUMN embedding vector(768);
  END IF;
END $$;

-- 2. pgvector HNSW 인덱스 (코사인 유사도)
CREATE INDEX IF NOT EXISTS idx_items_embedding_hnsw
  ON items
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 3. pg_trgm GIN 인덱스 (LaTeX 텍스트 유사 검색 폴백)
CREATE INDEX IF NOT EXISTS idx_items_body_latex_trgm
  ON items
  USING gin ("bodyLatex" gin_trgm_ops);

-- 4. 복합 인덱스: 상태 + 생성일 (대시보드/목록 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_items_org_status_created
  ON items ("orgId", status, "createdAt" DESC);

-- 5. 감사 로그 불변성 규칙 (UPDATE/DELETE 차단)
CREATE OR REPLACE RULE audit_log_no_update AS
  ON UPDATE TO audit_logs DO INSTEAD NOTHING;

CREATE OR REPLACE RULE audit_log_no_delete AS
  ON DELETE TO audit_logs DO INSTEAD NOTHING;

-- 6. 감사 로그 조회 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by
  ON audit_logs ("orgId", "performedBy", "createdAt" DESC);

-- 7. 문항-스킬 조인 최적화 (유사문항 검색에서 빈번히 사용)
CREATE INDEX IF NOT EXISTS idx_item_skills_skill_id
  ON item_skills ("skillId");

-- 8. HNSW 검색 시 ef_search 파라미터 설정 (세션 단위)
-- 운영 환경에서는 postgresql.conf로 설정 권장
-- SET hnsw.ef_search = 40;
