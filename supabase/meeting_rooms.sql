-- Meeting room booking ("ขอใช้ห้องประชุม"). Run once in the Supabase SQL editor, after schema.sql.
-- Part A is the provided SQL unchanged. Part B is what the app additionally needs; the
-- comments say why. Part C is optional starter data.

-- =====================================================================
-- Part A: provided SQL
-- =====================================================================

-- 1. เพิ่มฟิลด์เงื่อนไขในตาราง rooms
ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS equipment TEXT[] DEFAULT '{}'; -- เช่น '{"โปรเจกเตอร์", "ไมค์ลอย 2 ตัว"}'

-- 2. View สำหรับดึงสถานะห้องประชุม ณ ปัจจุบัน (Live Status) ไปโชว์ที่ Dashboard
CREATE OR REPLACE VIEW v_live_room_status AS
SELECT
  r.id AS room_id,
  r.room_number,
  r.name AS room_name,
  b.name AS building_name,
  r.capacity,
  CASE
    WHEN res.id IS NOT NULL THEN 'busy'
    ELSE 'available'
  END AS current_status,
  res.purpose AS active_meeting_title,
  res.end_time AS active_meeting_until,
  p.full_name AS booked_by
FROM rooms r
JOIN buildings b ON r.building_id = b.id
LEFT JOIN facility_reservations res ON r.id = res.room_id
  AND res.status = 'approved'
  AND NOW() BETWEEN res.start_time AND res.end_time
LEFT JOIN profiles p ON res.applicant_id = p.id
WHERE r.is_bookable = TRUE;

-- =====================================================================
-- Part B: additions
-- =====================================================================

-- B1. The view runs with its owner's rights, so without this anyone holding the public anon
--     key could read meeting titles and booker names. Only signed-in users may read it.
REVOKE ALL ON v_live_room_status FROM anon, PUBLIC;
GRANT SELECT ON v_live_room_status TO authenticated;

-- B2. Double booking is impossible: a room cannot have two overlapping active reservations.
--     The calendar warns in real time, this constraint is what settles a race between two people.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
ALTER TABLE facility_reservations
  ADD CONSTRAINT facility_reservations_no_overlap
  EXCLUDE USING gist (room_id WITH =, tstzrange(start_time, end_time) WITH &&)
  WHERE (status IN ('pending', 'approved'));

-- B3. The database, not the browser, decides the status: rooms with requires_approval start as
--     'pending', the others are 'approved' and lock the slot at once. Only bookable rooms and
--     times that are not in the past are accepted.
CREATE OR REPLACE FUNCTION public.enforce_reservation_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r record;
BEGIN
  SELECT is_bookable, COALESCE(requires_approval, false) AS requires_approval INTO r
  FROM public.rooms WHERE id = NEW.room_id;
  IF NOT FOUND OR NOT r.is_bookable THEN
    RAISE EXCEPTION 'ห้องนี้ไม่เปิดให้ขอใช้' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.start_time < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'ไม่สามารถจองย้อนหลังได้' USING ERRCODE = 'P0001';
  END IF;
  NEW.status := CASE WHEN r.requires_approval THEN 'pending'::public.approval_status
                     ELSE 'approved'::public.approval_status END;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_reservation_rules() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER facility_reservations_rules BEFORE INSERT ON facility_reservations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reservation_rules();

-- B4. Everyone signed in can see which slots are taken (shared calendar and conflict check).
--     Rejected requests stay visible only to the applicant and staff.
CREATE POLICY "reservations: read active" ON facility_reservations FOR SELECT TO authenticated
  USING (status IN ('pending', 'approved'));

-- B5. A requester can draft and edit the memo for their own reservation.
CREATE POLICY "memos: requester creates for own reservation" ON memorandums FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND origin_module = 'reservation'
    AND EXISTS (SELECT 1 FROM facility_reservations f
                WHERE f.id = reference_id AND f.applicant_id = (SELECT auth.uid()))
  );
CREATE POLICY "memos: author updates own pending" ON memorandums FOR UPDATE TO authenticated
  USING (author_id = (SELECT auth.uid()) AND final_status = 'pending')
  WITH CHECK (author_id = (SELECT auth.uid()) AND final_status = 'pending');

-- B6. Live updates: the calendar refreshes when anyone books.
ALTER PUBLICATION supabase_realtime ADD TABLE facility_reservations;

-- =====================================================================
-- Part C: optional starter data (edit to match the real rooms)
-- =====================================================================
UPDATE rooms SET name = 'ห้องประชุมใหญ่', capacity = 60, requires_approval = true,
  equipment = '{"โปรเจกเตอร์","ไมค์ลอย","เครื่องเสียง"}' WHERE room_number = 'MTG-01';
UPDATE rooms SET requires_approval = true, equipment = '{"เครื่องเสียง","ไมค์ลอย"}' WHERE room_number = 'CAN-01';
UPDATE rooms SET equipment = '{"คอมพิวเตอร์ 40 เครื่อง","โปรเจกเตอร์"}' WHERE room_number = '301';
INSERT INTO rooms (building_id, room_number, name, capacity, is_bookable, requires_approval, equipment)
SELECT id, 'MTG-02', 'ห้องประชุมย่อย', 15, true, false, '{"จอ TV","ไวท์บอร์ด"}'
FROM buildings WHERE code = 'BLD-02'
ON CONFLICT (building_id, room_number) DO NOTHING;
