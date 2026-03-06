-- =============================================
-- Tour leaders master data
-- - Admin-editable leader list for tour reservations
-- =============================================

CREATE TABLE IF NOT EXISTS public.tour_leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_number INTEGER NOT NULL UNIQUE CHECK (group_number > 0),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.update_tour_leaders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tour_leaders_updated_at_trigger ON public.tour_leaders;

CREATE TRIGGER tour_leaders_updated_at_trigger
  BEFORE UPDATE ON public.tour_leaders
  FOR EACH ROW EXECUTE FUNCTION public.update_tour_leaders_updated_at();

ALTER TABLE public.tour_leaders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tour_leaders_public_read" ON public.tour_leaders;

CREATE POLICY "tour_leaders_public_read" ON public.tour_leaders
  FOR SELECT
  USING (is_active = true);

INSERT INTO public.tour_leaders (group_number, name)
VALUES
  (1, '최민정'),
  (2, '김종호'),
  (3, '홍수경'),
  (4, '배은경'),
  (5, '정군우'),
  (6, '김기연'),
  (7, '김현숙'),
  (8, '배기헌'),
  (9, '박상민'),
  (10, '조아라'),
  (11, '신민정'),
  (12, '정명훈'),
  (13, '박정원'),
  (14, '이태윤'),
  (15, '민슬기'),
  (16, '강선정'),
  (17, '진성권'),
  (18, '이다솜'),
  (19, '이승보'),
  (20, '황주은'),
  (21, '장재승'),
  (22, '이홍주'),
  (23, '현선진'),
  (24, '신중석'),
  (25, '김신혜'),
  (26, '박종민'),
  (27, '정효원'),
  (28, '서상준'),
  (29, '조민국'),
  (30, '김다연'),
  (31, '김수진')
ON CONFLICT (group_number) DO UPDATE
SET name = EXCLUDED.name,
    is_active = true;
