-- 접속 로그에 접속 IP 컬럼 추가
ALTER TABLE access_logs
ADD COLUMN IF NOT EXISTS ip text;

COMMENT ON COLUMN access_logs.ip IS '접속 시 클라이언트 공인 IP (브라우저에서 조회)';
