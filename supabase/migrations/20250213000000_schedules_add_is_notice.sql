-- 게시판 공지 여부: true면 목록 상단(첫 페이지부터) 우선 정렬
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS is_notice boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN schedules.is_notice IS '공지 여부. true면 목록 상단 우선 정렬';
