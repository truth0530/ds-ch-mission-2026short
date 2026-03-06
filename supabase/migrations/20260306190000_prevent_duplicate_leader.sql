-- Prevent duplicate leader registration:
-- 1. Add unique constraint (only one active reservation per leader name)
-- 2. Add check in create_tour_reservation RPC

-- Partial unique index: only one active reservation per name
CREATE UNIQUE INDEX IF NOT EXISTS idx_tour_reservations_active_name
ON public.tour_reservations(name)
WHERE status = 'active';

-- Update create_tour_reservation to check for existing active reservation
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
  -- Check for existing active reservation with the same name
  IF EXISTS (
    SELECT 1 FROM public.tour_reservations
    WHERE public.tour_reservations.name = p_name
      AND public.tour_reservations.status = 'active'
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_LEADER';
  END IF;

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
