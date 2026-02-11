-- 할일 목록 순서 변경을 위한 sort_order 컬럼 추가
ALTER TABLE todos
ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- 기존 행에 순서 부여 (created_at 기준)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) - 1 AS rn
  FROM todos
)
UPDATE todos SET sort_order = ordered.rn FROM ordered WHERE todos.id = ordered.id;

CREATE INDEX IF NOT EXISTS idx_todos_sort_order ON todos(user_id, sort_order);

COMMENT ON COLUMN todos.sort_order IS '할일 목록 표시 순서 (작을수록 앞, 0부터 시작)';
