-- =============================================
-- 기독유적지 투어 신청 시스템 테이블
-- =============================================

-- 1. tour_slots: 투어 시간 슬롯
CREATE TABLE tour_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_date DATE NOT NULL,
  tour_time TIME NOT NULL,
  time_label TEXT NOT NULL,
  max_capacity INTEGER DEFAULT 4,
  current_bookings INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_capacity CHECK (current_bookings >= 0 AND current_bookings <= max_capacity),
  UNIQUE(tour_date, tour_time)
);

-- 2. tour_reservations: 신청 내역
CREATE TABLE tour_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID REFERENCES tour_slots(id) ON DELETE CASCADE,
  reservation_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  memo TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 인덱스
CREATE INDEX idx_tour_reservations_slot_id ON tour_reservations(slot_id);
CREATE INDEX idx_tour_reservations_code ON tour_reservations(reservation_code);
CREATE INDEX idx_tour_reservations_status ON tour_reservations(status);

-- 4. 트리거: 신청/취소/변경 시 current_bookings 자동 증감
CREATE OR REPLACE FUNCTION update_slot_booking_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    UPDATE tour_slots SET current_bookings = current_bookings + 1
    WHERE id = NEW.slot_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.slot_id IS DISTINCT FROM NEW.slot_id THEN
      IF OLD.status = 'active' THEN
        UPDATE tour_slots SET current_bookings = current_bookings - 1
        WHERE id = OLD.slot_id;
      END IF;
      IF NEW.status = 'active' THEN
        UPDATE tour_slots SET current_bookings = current_bookings + 1
        WHERE id = NEW.slot_id;
      END IF;
    ELSE
      IF OLD.status = 'active' AND NEW.status = 'cancelled' THEN
        UPDATE tour_slots SET current_bookings = current_bookings - 1
        WHERE id = NEW.slot_id;
      ELSIF OLD.status = 'cancelled' AND NEW.status = 'active' THEN
        UPDATE tour_slots SET current_bookings = current_bookings + 1
        WHERE id = NEW.slot_id;
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'active' THEN
    UPDATE tour_slots SET current_bookings = current_bookings - 1
    WHERE id = OLD.slot_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tour_reservation_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON tour_reservations
  FOR EACH ROW EXECUTE FUNCTION update_slot_booking_count();

-- 5. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_tour_reservation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tour_reservation_updated_at_trigger
  BEFORE UPDATE ON tour_reservations
  FOR EACH ROW EXECUTE FUNCTION update_tour_reservation_updated_at();

-- 6. RLS 정책
ALTER TABLE tour_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tour_slots_read" ON tour_slots FOR SELECT USING (true);
CREATE POLICY "tour_reservations_insert" ON tour_reservations FOR INSERT WITH CHECK (true);
CREATE POLICY "tour_reservations_read" ON tour_reservations FOR SELECT USING (true);
CREATE POLICY "tour_reservations_update" ON tour_reservations FOR UPDATE USING (true);

-- 7. Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE tour_slots;

-- 8. 초기 데이터 삽입
INSERT INTO tour_slots (tour_date, tour_time, time_label) VALUES
  ('2026-03-14', '10:00', '오전 10시'),
  ('2026-03-21', '10:00', '오전 10시'),
  ('2026-03-28', '10:00', '오전 10시'),
  ('2026-04-11', '10:00', '오전 10시'),
  ('2026-04-25', '10:00', '오전 10시'),
  ('2026-05-09', '10:00', '오전 10시'),
  ('2026-05-16', '10:00', '오전 10시'),
  ('2026-04-04', '17:00', '오후 5시'),
  ('2026-04-18', '17:00', '오후 5시');
