-- Migration: Strengthen RLS Policies
-- Date: 2026-01-14
-- Purpose: Fix infinite recursion in RLS policies and strengthen security

-- ============================================
-- 1. Create SECURITY DEFINER function for admin check
-- This function bypasses RLS to check admin status without recursion
-- ============================================

CREATE OR REPLACE FUNCTION public.is_admin_user(check_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    admin_exists BOOLEAN;
    super_admin_email TEXT;
BEGIN
    -- Get super admin email from environment (set this in Supabase Dashboard -> Settings -> API)
    super_admin_email := current_setting('app.settings.admin_email', true);

    -- Check if the email is the super admin
    IF check_email = super_admin_email THEN
        RETURN TRUE;
    END IF;

    -- Check if the email exists in admin_users table
    SELECT EXISTS (
        SELECT 1 FROM public.admin_users WHERE email = check_email
    ) INTO admin_exists;

    RETURN admin_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin_user(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user(TEXT) TO anon;

-- ============================================
-- 2. Drop existing problematic policies
-- ============================================

-- Drop existing policies on admin_users (if they exist)
DROP POLICY IF EXISTS "Admins can view all admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can insert admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can delete admin users" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_select" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_insert" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_delete" ON public.admin_users;

-- Drop existing policies on mission_evaluations (if they exist)
DROP POLICY IF EXISTS "Authenticated users can view their own evaluations" ON public.mission_evaluations;
DROP POLICY IF EXISTS "Authenticated users can insert evaluations" ON public.mission_evaluations;
DROP POLICY IF EXISTS "Admins can view all evaluations" ON public.mission_evaluations;
DROP POLICY IF EXISTS "evaluations_select" ON public.mission_evaluations;
DROP POLICY IF EXISTS "evaluations_insert" ON public.mission_evaluations;
DROP POLICY IF EXISTS "evaluations_update" ON public.mission_evaluations;

-- Drop existing policies on survey_questions (if they exist)
DROP POLICY IF EXISTS "Anyone can view survey questions" ON public.survey_questions;
DROP POLICY IF EXISTS "Admins can manage survey questions" ON public.survey_questions;
DROP POLICY IF EXISTS "questions_select" ON public.survey_questions;
DROP POLICY IF EXISTS "questions_insert" ON public.survey_questions;
DROP POLICY IF EXISTS "questions_update" ON public.survey_questions;
DROP POLICY IF EXISTS "questions_delete" ON public.survey_questions;

-- Drop existing policies on mission_teams (if they exist)
DROP POLICY IF EXISTS "Anyone can view mission teams" ON public.mission_teams;
DROP POLICY IF EXISTS "Admins can manage mission teams" ON public.mission_teams;
DROP POLICY IF EXISTS "teams_select" ON public.mission_teams;
DROP POLICY IF EXISTS "teams_insert" ON public.mission_teams;
DROP POLICY IF EXISTS "teams_update" ON public.mission_teams;
DROP POLICY IF EXISTS "teams_delete" ON public.mission_teams;

-- ============================================
-- 3. Enable RLS on all tables
-- ============================================

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_teams ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. Create new RLS policies for admin_users
-- Using SECURITY DEFINER function to avoid recursion
-- ============================================

-- Admin users: Select (admins only)
CREATE POLICY "admin_users_select" ON public.admin_users
    FOR SELECT
    USING (public.is_admin_user(auth.jwt() ->> 'email'));

-- Admin users: Insert (admins only)
CREATE POLICY "admin_users_insert" ON public.admin_users
    FOR INSERT
    WITH CHECK (public.is_admin_user(auth.jwt() ->> 'email'));

-- Admin users: Delete (admins only)
CREATE POLICY "admin_users_delete" ON public.admin_users
    FOR DELETE
    USING (public.is_admin_user(auth.jwt() ->> 'email'));

-- ============================================
-- 5. Create new RLS policies for mission_evaluations
-- ============================================

-- Evaluations: Anyone can insert (survey submissions)
CREATE POLICY "evaluations_insert" ON public.mission_evaluations
    FOR INSERT
    WITH CHECK (true);

-- Evaluations: Select own submissions (by email) or admin can see all
CREATE POLICY "evaluations_select" ON public.mission_evaluations
    FOR SELECT
    USING (
        respondent_email = auth.jwt() ->> 'email'
        OR public.is_admin_user(auth.jwt() ->> 'email')
    );

-- Evaluations: Update own submissions (by email) or admin can update all
CREATE POLICY "evaluations_update" ON public.mission_evaluations
    FOR UPDATE
    USING (
        respondent_email = auth.jwt() ->> 'email'
        OR public.is_admin_user(auth.jwt() ->> 'email')
    );

-- Evaluations: Delete (admins only)
CREATE POLICY "evaluations_delete" ON public.mission_evaluations
    FOR DELETE
    USING (public.is_admin_user(auth.jwt() ->> 'email'));

-- ============================================
-- 6. Create new RLS policies for survey_questions
-- ============================================

-- Questions: Anyone can read (for survey form)
CREATE POLICY "questions_select" ON public.survey_questions
    FOR SELECT
    USING (true);

-- Questions: Insert (admins only)
CREATE POLICY "questions_insert" ON public.survey_questions
    FOR INSERT
    WITH CHECK (public.is_admin_user(auth.jwt() ->> 'email'));

-- Questions: Update (admins only)
CREATE POLICY "questions_update" ON public.survey_questions
    FOR UPDATE
    USING (public.is_admin_user(auth.jwt() ->> 'email'));

-- Questions: Delete (admins only)
CREATE POLICY "questions_delete" ON public.survey_questions
    FOR DELETE
    USING (public.is_admin_user(auth.jwt() ->> 'email'));

-- ============================================
-- 7. Create new RLS policies for mission_teams
-- ============================================

-- Teams: Anyone can read (for team selection)
CREATE POLICY "teams_select" ON public.mission_teams
    FOR SELECT
    USING (true);

-- Teams: Insert (admins only)
CREATE POLICY "teams_insert" ON public.mission_teams
    FOR INSERT
    WITH CHECK (public.is_admin_user(auth.jwt() ->> 'email'));

-- Teams: Update (admins only)
CREATE POLICY "teams_update" ON public.mission_teams
    FOR UPDATE
    USING (public.is_admin_user(auth.jwt() ->> 'email'));

-- Teams: Delete (admins only)
CREATE POLICY "teams_delete" ON public.mission_teams
    FOR DELETE
    USING (public.is_admin_user(auth.jwt() ->> 'email'));

-- ============================================
-- 8. Set super admin email in database settings
-- NOTE: You need to set this in Supabase Dashboard:
-- Settings -> API -> Database Settings -> Add custom variable
-- Key: app.settings.admin_email
-- Value: truth0530@gmail.com (or your admin email from env)
-- ============================================

COMMENT ON FUNCTION public.is_admin_user IS
'Check if a user email is an admin. Uses SECURITY DEFINER to bypass RLS and prevent recursion.
Required setting: app.settings.admin_email must be set in Supabase Dashboard -> Settings -> API';
