-- 스티커 메모에 sort_order 컬럼 추가
ALTER TABLE sticker_memos ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- 기존 데이터에 sort_order 값 부여 (created_at 기준 역순)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) - 1 AS rn
  FROM sticker_memos
)
UPDATE sticker_memos SET sort_order = ordered.rn FROM ordered WHERE sticker_memos.id = ordered.id;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_sticker_memos_sort_order ON sticker_memos(user_id, sort_order);
