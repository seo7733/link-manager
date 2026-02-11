-- 링크 메인 표출 여부 (즐겨찾기 메인 화면 노출)
ALTER TABLE links
ADD COLUMN IF NOT EXISTS show_on_main boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN links.show_on_main IS '메인 화면 즐겨찾기 그리드에 표시 여부';
