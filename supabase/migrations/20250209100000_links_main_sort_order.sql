-- 메인 패널(즐겨찾기 그리드) 표시 순서
ALTER TABLE links
ADD COLUMN IF NOT EXISTS main_sort_order integer;

COMMENT ON COLUMN links.main_sort_order IS '메인 화면 즐겨찾기 그리드 내 순서 (작을수록 앞)';
