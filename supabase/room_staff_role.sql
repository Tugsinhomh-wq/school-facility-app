-- Role "room_staff" (เจ้าหน้าที่ห้องประชุม): runs the meeting-room side only.
-- Run the first statement on its own, then the rest (a new enum value cannot be used in the same transaction).
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'room_staff';

-- Reservations: see every request (including rejected) and decide on them.
CREATE POLICY "reservations: room staff read all" ON facility_reservations FOR SELECT TO authenticated
  USING (public.current_role_is('room_staff'));
CREATE POLICY "reservations: room staff update all" ON facility_reservations FOR UPDATE TO authenticated
  USING (public.current_role_is('room_staff')) WITH CHECK (public.current_role_is('room_staff'));

-- Names on the calendar: only people who have made a reservation, never the whole directory.
CREATE POLICY "profiles: room staff read applicants" ON profiles FOR SELECT TO authenticated
  USING (public.current_role_is('room_staff') AND EXISTS (SELECT 1 FROM facility_reservations f WHERE f.applicant_id = profiles.id));

-- Memos: only the ones drafted from a room request.
CREATE POLICY "memos: room staff read reservation memos" ON memorandums FOR SELECT TO authenticated
  USING (public.current_role_is('room_staff') AND origin_module = 'reservation');
CREATE POLICY "memos: room staff create reservation memos" ON memorandums FOR INSERT TO authenticated
  WITH CHECK (public.current_role_is('room_staff') AND origin_module = 'reservation' AND author_id = (SELECT auth.uid()));
CREATE POLICY "memos: room staff update reservation memos" ON memorandums FOR UPDATE TO authenticated
  USING (public.current_role_is('room_staff') AND origin_module = 'reservation')
  WITH CHECK (public.current_role_is('room_staff') AND origin_module = 'reservation');

-- Rooms: add, rename and open/close rooms for booking. Halls live in buildings coded HALL-nn.
CREATE POLICY "rooms: room staff manage" ON rooms FOR ALL TO authenticated
  USING (public.current_role_is('room_staff') AND building_id IN (SELECT id FROM buildings WHERE code LIKE 'HALL-%'))
  WITH CHECK (public.current_role_is('room_staff') AND building_id IN (SELECT id FROM buildings WHERE code LIKE 'HALL-%'));
CREATE POLICY "buildings: room staff manage halls" ON buildings FOR ALL TO authenticated
  USING (public.current_role_is('room_staff') AND code LIKE 'HALL-%')
  WITH CHECK (public.current_role_is('room_staff') AND code LIKE 'HALL-%');
