-- 게시글 답변(자식글)용 부모 참조
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES schedules(id) ON DELETE SET NULL;

COMMENT ON COLUMN schedules.parent_id IS '답변인 경우 원글(부모) id';

CREATE INDEX IF NOT EXISTS idx_schedules_parent_id ON schedules(parent_id);
