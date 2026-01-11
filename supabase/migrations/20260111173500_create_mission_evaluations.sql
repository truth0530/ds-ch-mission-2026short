-- 1. 설문 응답 테이블 생성 (JSONB 방식)
CREATE TABLE IF NOT EXISTS public.mission_evaluations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    role TEXT, -- '선교사', '인솔자', '단기선교 팀원'
    team_dept TEXT,
    team_country TEXT,
    team_missionary TEXT,
    team_leader TEXT,
    respondent_email TEXT, -- 응답자 이메일 (익명 또는 로그인 사용자)
    respondent_name TEXT, -- 응답자 이름 (선택적)
    submission_date DATE DEFAULT CURRENT_DATE, -- 제출 날짜
    response_status TEXT DEFAULT 'completed', -- 응답 상태: 'completed', 'partial'
    answers JSONB, -- 설문 응답을 유연하게 저장 (예: {"q1": 5, "c1": "내용..."})
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. RLS 활성화
ALTER TABLE public.mission_evaluations ENABLE ROW LEVEL SECURITY;

-- 3. 정책 설정: 누구나 작성(INSERT) 가능
CREATE POLICY "누구나 설문을 제출할 수 있습니다." 
ON public.mission_evaluations FOR INSERT 
WITH CHECK (true);

-- 4. 정책 설정: 관리자만 조회(SELECT) 가능
CREATE POLICY "관리자만 설문 결과를 볼 수 있습니다." 
ON public.mission_evaluations FOR SELECT 
USING (auth.jwt() ->> 'email' IN (SELECT email FROM public.admin_users));
