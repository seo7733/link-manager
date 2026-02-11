-- 일정 관리를 위한 schedules 테이블
CREATE TABLE IF NOT EXISTS schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  event_date date NOT NULL,
  event_time text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own schedules"
  ON schedules
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE schedules IS '대시보드 메인 화면 일정 관리용 테이블';
COMMENT ON COLUMN schedules.event_date IS '일정 날짜';
COMMENT ON COLUMN schedules.event_time IS '일정 시각 (텍스트, 예: 09:30)';

