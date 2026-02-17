-- 게시글 덧글(간단 코멘트)
CREATE TABLE IF NOT EXISTS schedule_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_comments_schedule_id ON schedule_comments(schedule_id);

ALTER TABLE schedule_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage comments on own schedules"
  ON schedule_comments FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM schedules s WHERE s.id = schedule_id AND s.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM schedules s WHERE s.id = schedule_id AND s.user_id = auth.uid())
  );

COMMENT ON TABLE schedule_comments IS '게시판 게시글 덧글(메모형 코멘트)';
