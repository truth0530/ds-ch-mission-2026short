-- =============================================
-- Add role column to admin_users
-- Roles: master, survey, tour, all
-- =============================================

ALTER TABLE public.admin_users
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'all'
CHECK (role IN ('master', 'survey', 'tour', 'all'));

-- Set the initial super admin as master
UPDATE public.admin_users
SET role = 'master'
WHERE email = 'truth0530@gmail.com';
