-- 1. 관리자 권한을 가진 이메일 리스트 테이블 생성
CREATE TABLE IF NOT EXISTS public.admin_users (
    email TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    added_by TEXT -- 추가한 관리자의 이메일
);

-- 2. RLS 활성화
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 3. 정책 설정: 인증된 사용자(관리자 로그인 시도자)는 자신의 권한 확인을 위해 읽기 가능
CREATE POLICY "누구나 관리자 이메일 리스트를 읽을 수 있습니다." 
ON public.admin_users FOR SELECT 
USING (true);

-- 4. 정책 설정: 관리자만 리스트 수정 가능 (실제 운영시에는 구글 로그인 후 확인 로직 필요)
CREATE POLICY "인증된 관리자만 리스트를 관리할 수 있습니다." 
ON public.admin_users FOR ALL 
USING (auth.jwt() ->> 'email' IN (SELECT email FROM public.admin_users))
WITH CHECK (auth.jwt() ->> 'email' IN (SELECT email FROM public.admin_users));

-- 5. 초기 관리자 등록 (본인의 구글 이메일로 수정하여 실행하세요)
-- INSERT INTO public.admin_users (email) VALUES ('your-email@gmail.com');
