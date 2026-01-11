-- Mission Evaluations: 인덱스 및 분석용 View 추가

-- 1. 인덱스 생성 (쿼리 성능 최적화)
-- 역할별 필터링을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_mission_evaluations_role 
ON public.mission_evaluations(role);

-- 선교사별 응답 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_mission_evaluations_missionary 
ON public.mission_evaluations(team_missionary);

-- 제출 날짜 기준 정렬을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_mission_evaluations_created_at 
ON public.mission_evaluations(created_at DESC);

-- 복합 인덱스: 팀별 역할별 응답 조회 시 효율성
CREATE INDEX IF NOT EXISTS idx_mission_evaluations_team_role 
ON public.mission_evaluations(team_missionary, role, created_at DESC);

-- 응답 상태별 필터링 인덱스
CREATE INDEX IF NOT EXISTS idx_mission_evaluations_status 
ON public.mission_evaluations(response_status);

-- 2. JSONB 필드 인덱스 (자주 쿼리하는 질문들)
-- GIN 인덱스로 JSONB 전체 검색 성능 향상
CREATE INDEX IF NOT EXISTS idx_mission_evaluations_answers_gin 
ON public.mission_evaluations USING GIN (answers);

-- 특정 질문 필드에 대한 인덱스 (예: 평점 질문 q1, q2, q3)
CREATE INDEX IF NOT EXISTS idx_mission_evaluations_q1 
ON public.mission_evaluations ((answers->>'q1'));

CREATE INDEX IF NOT EXISTS idx_mission_evaluations_q2 
ON public.mission_evaluations ((answers->>'q2'));

CREATE INDEX IF NOT EXISTS idx_mission_evaluations_q3 
ON public.mission_evaluations ((answers->>'q3'));

-- 3. 분석용 View 생성
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
    
    -- 응답 메타데이터
    jsonb_object_keys(answers) as answered_question_ids,
    jsonb_array_length(jsonb_object_keys(answers)) as total_answers_count,
    LENGTH(answers::text) as response_text_length
    
FROM public.mission_evaluations;

-- View에 대한 설명 추가
COMMENT ON VIEW public.survey_analysis IS 
'설문 응답 분석을 위한 View. JSONB 필드의 주요 질문들을 별도 컬럼으로 추출하여 집계 쿼리 성능 향상.';

-- 4. 응답 통계를 위한 함수 (선택적)
CREATE OR REPLACE FUNCTION public.get_average_scores_by_missionary(missionary_name TEXT)
RETURNS TABLE (
    avg_spiritual_prep NUMERIC,
    avg_ministry_prep NUMERIC,
    avg_communication NUMERIC,
    total_responses BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROUND(AVG((answers->>'q1')::int), 2) as avg_spiritual_prep,
        ROUND(AVG((answers->>'q2')::int), 2) as avg_ministry_prep,
        ROUND(AVG((answers->>'q3')::int), 2) as avg_communication,
        COUNT(*) as total_responses
    FROM public.mission_evaluations
    WHERE team_missionary = missionary_name
      AND role = '선교사'
      AND answers ? 'q1' 
      AND answers ? 'q2' 
      AND answers ? 'q3';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.get_average_scores_by_missionary IS 
'특정 선교사에 대한 평균 점수를 계산하는 함수.';
