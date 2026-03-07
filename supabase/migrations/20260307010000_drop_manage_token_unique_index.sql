-- Drop UNIQUE index on manage_token.
-- The column is now used as a user-provided 4-digit PIN, so duplicate values must be allowed.

DROP INDEX IF EXISTS public.idx_tour_reservations_manage_token;
