-- 1. survey_questions 테이블 생성
CREATE TABLE IF NOT EXISTS public.survey_questions (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL, -- 'missionary', 'leader', 'team_member', 'common'
    type TEXT NOT NULL, -- 'scale', 'text', 'multi_select'
    question_text TEXT NOT NULL,
    options JSONB,
    sort_order INT NOT NULL,
    is_hidden BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. RLS 활성화
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;

-- 3. 정책 설정: 누구나 읽기 가능
CREATE POLICY "누구나 설문 문항을 읽을 수 있습니다." 
ON public.survey_questions FOR SELECT 
USING (true);

-- 4. 정책 설정: 누구나 수정 가능 (관리자 UI용, 실제 운영시에는 auth.role() 등으로 제한 권장)
CREATE POLICY "누구나 설문 문항을 관리할 수 있습니다." 
ON public.survey_questions FOR ALL 
USING (true)
WITH CHECK (true);

-- 5. 기본 데이터 (Seeding용) - 이 내용은 아래 JSON을 참고하여 대량 업로드하거나 관리자 페이지에서 추가할 수 있습니다.
