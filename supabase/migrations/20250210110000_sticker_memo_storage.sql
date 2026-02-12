-- 스티커 메모 첨부파일용 Storage 버킷 정책
-- 버킷 'sticker-memo-attachments'는 Supabase 대시보드 Storage에서 수동 생성 (private 권장) 후 적용하세요.
-- 경로 형식: {user_id}/{sticker_memo_id}/{file_name}

CREATE POLICY "Users can upload own sticker memo files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sticker-memo-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own sticker memo files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'sticker-memo-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own sticker memo files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'sticker-memo-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
