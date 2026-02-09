-- 접속 로그 테이블 (관리자 접속 현황/로그용)
CREATE TABLE IF NOT EXISTS access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text,
  accessed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_logs_accessed_at ON access_logs(accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON access_logs(user_id);

ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

-- 로그인한 사용자는 자신의 접속만 기록 가능
CREATE POLICY "Users can insert own access log"
  ON access_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 관리자(jkseo1974@gmail.com)만 전체 접속 로그 조회 가능
CREATE POLICY "Admin can select all access logs"
  ON access_logs FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jkseo1974@gmail.com');

-- categories: 관리자 전체 조회 및 타인 데이터 삭제 (회원 삭제용)
CREATE POLICY "Admin can select all categories"
  ON categories FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jkseo1974@gmail.com');

CREATE POLICY "Admin can delete any category"
  ON categories FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jkseo1974@gmail.com');

-- links: 관리자 전체 조회 및 삭제
CREATE POLICY "Admin can select all links"
  ON links FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jkseo1974@gmail.com');

CREATE POLICY "Admin can delete any link"
  ON links FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jkseo1974@gmail.com');

-- memos: 관리자 전체 조회 및 삭제
CREATE POLICY "Admin can select all memos"
  ON memos FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jkseo1974@gmail.com');

CREATE POLICY "Admin can delete any memo"
  ON memos FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'jkseo1974@gmail.com');

COMMENT ON TABLE access_logs IS '대시보드 접속 로그 (관리자 통계/접속로그용)';
