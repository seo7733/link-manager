-- 스티커 메모 (메인 화면 메모 패널, 파일 첨부 가능)
CREATE TABLE IF NOT EXISTS sticker_memos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sticker_memos_user_id ON sticker_memos(user_id);
CREATE INDEX IF NOT EXISTS idx_sticker_memos_created_at ON sticker_memos(created_at DESC);

ALTER TABLE sticker_memos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sticker memos"
  ON sticker_memos FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 스티커 메모 첨부파일 메타
CREATE TABLE IF NOT EXISTS sticker_memo_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sticker_memo_id uuid NOT NULL REFERENCES sticker_memos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sticker_memo_files_memo_id ON sticker_memo_files(sticker_memo_id);

ALTER TABLE sticker_memo_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sticker memo files"
  ON sticker_memo_files FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE sticker_memos IS '메인 화면 스티커 메모 (링크 미선택 시 메모 패널)';
COMMENT ON TABLE sticker_memo_files IS '스티커 메모 첨부파일 메타 (실제 파일은 Storage에 저장)';
