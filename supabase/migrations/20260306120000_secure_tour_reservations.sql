-- =============================================
-- Secure tour reservations
-- - Tighten RLS
-- - Add manage token for self-service operations
-- - Add atomic reservation functions
-- =============================================

ALTER TABLE public.tour_reservations
ADD COLUMN IF NOT EXISTS manage_token TEXT;

UPDATE public.tour_reservations
SET manage_token = encode(gen_random_bytes(16), 'hex')
WHERE manage_token IS NULL;

ALTER TABLE public.tour_reservations
ALTER COLUMN manage_token SET DEFAULT encode(gen_random_bytes(16), 'hex'),
ALTER COLUMN manage_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tour_reservations_manage_token
ON public.tour_reservations(manage_token);

DROP POLICY IF EXISTS "tour_slots_read" ON public.tour_slots;
DROP POLICY IF EXISTS "tour_reservations_insert" ON public.tour_reservations;
DROP POLICY IF EXISTS "tour_reservations_read" ON public.tour_reservations;
DROP POLICY IF EXISTS "tour_reservations_update" ON public.tour_reservations;

CREATE POLICY "tour_slots_public_read" ON public.tour_slots
  FOR SELECT
  USING (is_active = true);

CREATE OR REPLACE FUNCTION public.create_tour_reservation(
  p_slot_id UUID,
  p_name TEXT,
  p_phone TEXT,
  p_email TEXT DEFAULT NULL,
  p_memo TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  slot_id UUID,
  reservation_code TEXT,
  manage_token TEXT,
  name TEXT,
  phone TEXT,
  email TEXT,
  memo TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  tour_date DATE,
  tour_time TIME,
  time_label TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot tour_slots%ROWTYPE;
  v_reservation tour_reservations%ROWTYPE;
  v_code TEXT;
BEGIN
  SELECT *
  INTO v_slot
  FROM public.tour_slots
  WHERE public.tour_slots.id = p_slot_id
  FOR UPDATE;

  IF v_slot.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_SLOT';
  END IF;

  IF NOT v_slot.is_active THEN
    RAISE EXCEPTION 'INACTIVE_SLOT';
  END IF;

  IF v_slot.current_bookings >= v_slot.max_capacity THEN
    RAISE EXCEPTION 'SLOT_FULL';
  END IF;

  LOOP
    v_code := upper(substr(translate(gen_random_uuid()::text, '-01ilo', ''), 1, 6));
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.tour_reservations
      WHERE public.tour_reservations.reservation_code = v_code
    );
  END LOOP;

  INSERT INTO public.tour_reservations (
    slot_id,
    reservation_code,
    name,
    phone,
    email,
    memo
  )
  VALUES (
    p_slot_id,
    v_code,
    p_name,
    p_phone,
    NULLIF(p_email, ''),
    NULLIF(p_memo, '')
  )
  RETURNING * INTO v_reservation;

  RETURN QUERY
  SELECT
    v_reservation.id,
    v_reservation.slot_id,
    v_reservation.reservation_code,
    v_reservation.manage_token,
    v_reservation.name,
    v_reservation.phone,
    v_reservation.email,
    v_reservation.memo,
    v_reservation.status,
    v_reservation.created_at,
    v_reservation.updated_at,
    tour_slots.tour_date,
    tour_slots.tour_time,
    tour_slots.time_label
  FROM public.tour_slots
  WHERE public.tour_slots.id = v_reservation.slot_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.change_tour_reservation(
  p_reservation_code TEXT,
  p_manage_token TEXT,
  p_name TEXT,
  p_new_slot_id UUID
)
RETURNS TABLE (
  id UUID,
  slot_id UUID,
  reservation_code TEXT,
  manage_token TEXT,
  name TEXT,
  phone TEXT,
  email TEXT,
  memo TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  tour_date DATE,
  tour_time TIME,
  time_label TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation tour_reservations%ROWTYPE;
  v_new_slot tour_slots%ROWTYPE;
BEGIN
  SELECT *
  INTO v_reservation
  FROM public.tour_reservations
  WHERE public.tour_reservations.reservation_code = p_reservation_code
    AND public.tour_reservations.manage_token = p_manage_token
    AND public.tour_reservations.name = p_name
  FOR UPDATE;

  IF v_reservation.id IS NULL THEN
    RAISE EXCEPTION 'RESERVATION_NOT_FOUND';
  END IF;

  IF v_reservation.status <> 'active' THEN
    RAISE EXCEPTION 'RESERVATION_CANCELLED';
  END IF;

  IF v_reservation.slot_id = p_new_slot_id THEN
    RAISE EXCEPTION 'SAME_SLOT';
  END IF;

  SELECT *
  INTO v_new_slot
  FROM public.tour_slots
  WHERE public.tour_slots.id = p_new_slot_id
  FOR UPDATE;

  IF v_new_slot.id IS NULL THEN
    RAISE EXCEPTION 'INVALID_SLOT';
  END IF;

  IF NOT v_new_slot.is_active THEN
    RAISE EXCEPTION 'INACTIVE_SLOT';
  END IF;

  IF v_new_slot.current_bookings >= v_new_slot.max_capacity THEN
    RAISE EXCEPTION 'SLOT_FULL';
  END IF;

  UPDATE public.tour_reservations
  SET slot_id = p_new_slot_id
  WHERE public.tour_reservations.id = v_reservation.id
  RETURNING * INTO v_reservation;

  RETURN QUERY
  SELECT
    v_reservation.id,
    v_reservation.slot_id,
    v_reservation.reservation_code,
    v_reservation.manage_token,
    v_reservation.name,
    v_reservation.phone,
    v_reservation.email,
    v_reservation.memo,
    v_reservation.status,
    v_reservation.created_at,
    v_reservation.updated_at,
    tour_slots.tour_date,
    tour_slots.tour_time,
    tour_slots.time_label
  FROM public.tour_slots
  WHERE public.tour_slots.id = v_reservation.slot_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_tour_reservation(
  p_reservation_code TEXT,
  p_manage_token TEXT,
  p_name TEXT
)
RETURNS TABLE (
  id UUID,
  slot_id UUID,
  reservation_code TEXT,
  manage_token TEXT,
  name TEXT,
  phone TEXT,
  email TEXT,
  memo TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  tour_date DATE,
  tour_time TIME,
  time_label TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation tour_reservations%ROWTYPE;
BEGIN
  SELECT *
  INTO v_reservation
  FROM public.tour_reservations
  WHERE public.tour_reservations.reservation_code = p_reservation_code
    AND public.tour_reservations.manage_token = p_manage_token
    AND public.tour_reservations.name = p_name
  FOR UPDATE;

  IF v_reservation.id IS NULL THEN
    RAISE EXCEPTION 'RESERVATION_NOT_FOUND';
  END IF;

  IF v_reservation.status <> 'active' THEN
    RAISE EXCEPTION 'ALREADY_CANCELLED';
  END IF;

  UPDATE public.tour_reservations
  SET status = 'cancelled'
  WHERE public.tour_reservations.id = v_reservation.id
  RETURNING * INTO v_reservation;

  RETURN QUERY
  SELECT
    v_reservation.id,
    v_reservation.slot_id,
    v_reservation.reservation_code,
    v_reservation.manage_token,
    v_reservation.name,
    v_reservation.phone,
    v_reservation.email,
    v_reservation.memo,
    v_reservation.status,
    v_reservation.created_at,
    v_reservation.updated_at,
    tour_slots.tour_date,
    tour_slots.tour_time,
    tour_slots.time_label
  FROM public.tour_slots
  WHERE public.tour_slots.id = v_reservation.slot_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_tour_reservation(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.change_tour_reservation(TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_tour_reservation(TEXT, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_tour_reservation(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.change_tour_reservation(TEXT, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_tour_reservation(TEXT, TEXT, TEXT) TO service_role;
