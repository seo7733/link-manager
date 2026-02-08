-- 링크 순서 변경을 위한 sort_order 컬럼 추가
-- Supabase 대시보드 SQL Editor에서 실행하거나, Supabase CLI로 마이그레이션 적용

ALTER TABLE links
ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- 기존 행에 순서 부여 (created_at 기준)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY created_at DESC) - 1 AS rn
  FROM links
)
UPDATE links SET sort_order = ordered.rn FROM ordered WHERE links.id = ordered.id;

COMMENT ON COLUMN links.sort_order IS '카테고리 내 링크 표시 순서 (0부터 시작)';
