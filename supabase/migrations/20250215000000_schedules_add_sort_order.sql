-- 게시물/답변 목록 순서 변경용 (작을수록 위)
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS sort_order integer;

COMMENT ON COLUMN schedules.sort_order IS '목록 정렬 순서(작을수록 위). null이면 등록일 기준';

CREATE INDEX IF NOT EXISTS idx_schedules_sort_order ON schedules(sort_order);
