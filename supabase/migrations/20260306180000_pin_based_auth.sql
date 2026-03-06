-- Switch from auto-generated manage_token to user-provided 4-digit PIN
-- The manage_token column is reused to store the PIN (no schema change needed)
-- Just need to update the RPC functions to match by name + manage_token (PIN)
-- without requiring reservation_code

-- Update change_tour_reservation to find by name + PIN (no reservation_code)
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
  WHERE public.tour_reservations.name = p_name
    AND public.tour_reservations.manage_token = p_manage_token
    AND public.tour_reservations.status = 'active'
  FOR UPDATE;

  IF v_reservation.id IS NULL THEN
    RAISE EXCEPTION 'RESERVATION_NOT_FOUND';
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

-- Update cancel_tour_reservation to find by name + PIN
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
  WHERE public.tour_reservations.name = p_name
    AND public.tour_reservations.manage_token = p_manage_token
    AND public.tour_reservations.status = 'active'
  FOR UPDATE;

  IF v_reservation.id IS NULL THEN
    RAISE EXCEPTION 'RESERVATION_NOT_FOUND';
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
