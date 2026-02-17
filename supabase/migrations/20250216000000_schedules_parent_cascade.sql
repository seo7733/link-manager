-- 부모글 삭제 시 답글(자식글)도 함께 삭제
ALTER TABLE schedules
  DROP CONSTRAINT IF EXISTS schedules_parent_id_fkey;

ALTER TABLE schedules
  ADD CONSTRAINT schedules_parent_id_fkey
  FOREIGN KEY (parent_id) REFERENCES schedules(id) ON DELETE CASCADE;
