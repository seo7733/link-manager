-- 일자별 게시판 (일기/게시판 연동)
CREATE TABLE IF NOT EXISTS board_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_date date NOT NULL,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_posts_user_date ON board_posts(user_id, post_date DESC);
ALTER TABLE board_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own board posts"
  ON board_posts FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 게시글 댓글 (다중 답글: parent_id로 계층)
CREATE TABLE IF NOT EXISTS board_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES board_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES board_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_comments_post ON board_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_board_comments_parent ON board_comments(parent_id);
ALTER TABLE board_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage board comments"
  ON board_comments FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read comments on own posts"
  ON board_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM board_posts p
      WHERE p.id = board_comments.post_id AND p.user_id = auth.uid()
    )
  );

COMMENT ON TABLE board_posts IS '일자별 게시판/일기 게시물';
COMMENT ON TABLE board_comments IS '게시글 댓글 및 다중 답글';
