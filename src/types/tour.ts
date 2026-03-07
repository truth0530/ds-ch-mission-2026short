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

export interface TourLeader {
  id: string;
  group_number: number;
  name: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Tour Reservation (from DB)
export interface TourReservation {
  id: string;
  slot_id: string;
  reservation_code: string;
  manage_token: string;
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

export interface TourReservationManageView {
  reservation_code: string;
  name: string;
  phone: string;
  email: string | null;
  memo: string | null;
  status: 'active' | 'cancelled';
  created_at: string;
  updated_at: string;
  slot_id: string;
  tour_slots: Pick<TourSlot, 'tour_date' | 'tour_time' | 'time_label'>;
}

export interface TourReservationPublicView {
  reservation_code: string;
  name: string;
  status: 'active' | 'cancelled';
  created_at: string;
  slot_id: string;
  tour_slots: Pick<TourSlot, 'tour_date' | 'tour_time' | 'time_label'>;
}

export type TourReservationAdminView = Omit<TourReservationWithSlot, 'manage_token'>;

export interface TourReservationRpcRow {
  id: string;
  slot_id: string;
  reservation_code: string;
  manage_token: string;
  name: string;
  phone: string;
  email: string | null;
  memo: string | null;
  status: 'active' | 'cancelled';
  created_at: string;
  updated_at: string;
  tour_date: string;
  tour_time: string;
  time_label: string;
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
