// Tour Slot (from DB)
export interface TourSlot {
  id: string;
  tour_date: string;
  tour_time: string;
  time_label: string;
  max_capacity: number;
  current_bookings: number;
  is_active: boolean;
  created_at: string;
}

// Tour Reservation (from DB)
export interface TourReservation {
  id: string;
  slot_id: string;
  reservation_code: string;
  name: string;
  phone: string;
  email: string | null;
  memo: string | null;
  status: 'active' | 'cancelled';
  created_at: string;
  updated_at: string;
}

// Reservation with slot info (joined)
export interface TourReservationWithSlot extends TourReservation {
  tour_slots: Pick<TourSlot, 'tour_date' | 'tour_time' | 'time_label'>;
}

// Form data for creating a reservation
export interface TourReservationForm {
  slot_id: string;
  name: string;
  phone: string;
  email?: string;
  memo?: string;
}

// Form data for looking up a reservation
export interface TourLookupForm {
  reservation_code: string;
  name: string;
}
