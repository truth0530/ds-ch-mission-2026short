-- Make phone and email optional in tour_reservations
ALTER TABLE public.tour_reservations ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.tour_reservations ALTER COLUMN email DROP NOT NULL;
