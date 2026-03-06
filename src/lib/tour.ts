import type { TourReservationManageView, TourReservationRpcRow } from '@/types/tour';

export function formatTourReservation(row: TourReservationRpcRow): TourReservationManageView {
  return {
    reservation_code: row.reservation_code,
    manage_token: row.manage_token,
    name: row.name,
    phone: row.phone,
    email: row.email,
    memo: row.memo,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    slot_id: row.slot_id,
    tour_slots: {
      tour_date: row.tour_date,
      tour_time: row.tour_time,
      time_label: row.time_label,
    },
  };
}

export function toPublicReservation(row: TourReservationManageView) {
  return {
    reservation_code: row.reservation_code,
    manage_token: row.manage_token,
    name: row.name,
    status: row.status,
    created_at: row.created_at,
    slot_id: row.slot_id,
    tour_slots: row.tour_slots,
  };
}
