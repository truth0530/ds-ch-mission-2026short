-- Fix survey_analysis view and strengthen RLS policies

-- 1. Drop and recreate survey_analysis view with corrected JSONB handling
DROP VIEW IF EXISTS public.survey_analysis;

CREATE OR REPLACE VIEW public.survey_analysis AS
SELECT 
    id,
    role,
    team_dept,
    team_country,
    team_missionary,
    team_leader,
    respondent_email,
    respondent_name,
    submission_date,
    response_status,
    created_at,
    
    -- 선교사 평가 질문 추출 (점수)
    CASE WHEN answers ? 'q1' THEN (answers->>'q1')::int ELSE NULL END as spiritual_preparation_score,
    CASE WHEN answers ? 'q2' THEN (answers->>'q2')::int ELSE NULL END as ministry_preparation_score,
    CASE WHEN answers ? 'q3' THEN (answers->>'q3')::int ELSE NULL END as communication_score,
    
    -- 팀원 평가 질문 추출 (점수)
    CASE WHEN answers ? 't_pre' THEN (answers->>'t_pre')::int ELSE NULL END as pre_meeting_score,
    CASE WHEN answers ? 't1' THEN (answers->>'t1')::int ELSE NULL END as local_church_preparation_score,
    CASE WHEN answers ? 't2' THEN (answers->>'t2')::int ELSE NULL END as schedule_score,
    CASE WHEN answers ? 't3' THEN (answers->>'t3')::int ELSE NULL END as revisit_intention_score,
    
    -- 공통 질문 (배열)
    CASE WHEN answers ? 'c1' THEN answers->'c1' ELSE NULL END as common_difficulties,
    CASE WHEN answers ? 'c2' THEN answers->'c2' ELSE NULL END as support_needs,
    
    -- 응답 메타데이터 (수정: jsonb_object_keys를 배열로 변환)
    (SELECT array_agg(key) FROM jsonb_object_keys(answers) AS key) as answered_question_ids,
    (SELECT count(*) FROM jsonb_object_keys(answers))::int as total_answers_count,
    LENGTH(answers::text) as response_text_length
    
FROM public.mission_evaluations;

COMMENT ON VIEW public.survey_analysis IS 
'설문 응답 분석을 위한 View. JSONB 필드의 주요 질문들을 별도 컬럼으로 추출하여 집계 쿼리 성능 향상.';

-- 2. Add unique constraint to prevent duplicate submissions
-- Note: This creates a partial unique index that only applies when respondent_email IS NOT NULL
-- Anonymous users (NULL email) can still submit multiple times, but authenticated users cannot
CREATE UNIQUE INDEX IF NOT EXISTS idx_mission_evaluations_unique_submission
ON public.mission_evaluations(role, team_missionary, respondent_email)
WHERE respondent_email IS NOT NULL;

COMMENT ON INDEX idx_mission_evaluations_unique_submission IS 
'동일 역할, 동일 팀, 동일 이메일로 중복 제출 방지 (이메일이 있는 경우만 적용)';

-- 3. Update RLS policy for better security
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "누구나 설문을 제출할 수 있습니다." ON public.mission_evaluations;

-- Create new policy with duplicate prevention hint
-- Note: RLS policies cannot directly enforce UNIQUE constraints, but the unique index above will
-- The policy remains permissive for INSERT, but the unique index provides the actual enforcement
CREATE POLICY "설문 제출 정책 (중복 방지 포함)" 
ON public.mission_evaluations FOR INSERT 
WITH CHECK (
    -- Allow all inserts, but unique index will prevent duplicates for authenticated users
    true
);

COMMENT ON POLICY "설문 제출 정책 (중복 방지 포함)" ON public.mission_evaluations IS 
'누구나 설문을 제출할 수 있지만, 이메일이 있는 경우 (role, team_missionary, respondent_email) 조합의 유니크 인덱스가 중복을 방지합니다.';

-- 4. Add helpful function to check if user has already submitted
CREATE OR REPLACE FUNCTION public.has_submitted_evaluation(
    p_role TEXT,
    p_team_missionary TEXT,
    p_respondent_email TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.mission_evaluations
        WHERE role = p_role
          AND team_missionary = p_team_missionary
          AND respondent_email = p_respondent_email
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.has_submitted_evaluation IS 
'특정 사용자가 특정 역할/팀에 대해 이미 제출했는지 확인하는 함수. 클라이언트에서 사전 검증에 사용 가능.';
