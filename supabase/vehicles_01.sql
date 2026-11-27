-- Vehicle booking ("จองรถ"). Run once in the Supabase SQL editor, after schema.sql, executive_role.sql and
-- meeting_rooms.sql (it reuses touch_updated_at(), current_role_is() and the approval_status type).
-- Safe to run again: every statement is guarded.
--
-- Who may do what:
--   everyone signed in  reads the vehicles and every pending or approved trip (the shared calendar),
--                       books a vehicle, and cancels their own trip before it starts;
--   executive (ผอ.) and super_admin   read every request and approve or reject;
--   super_admin         adds and edits vehicles.
-- The database, not the browser, sets the status: a vehicle with requires_approval starts as 'pending',
-- the others are 'approved' and lock their dates at once.

-- =====================================================================
-- Tables
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('van', 'songthaew', 'pickup')),
  name TEXT NOT NULL,
  plate TEXT,
  seats INT CHECK (seats IS NULL OR seats > 0),
  has_driver BOOLEAN NOT NULL DEFAULT FALSE,
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  is_bookable BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vehicle_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES public.profiles(id),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  destination TEXT NOT NULL,
  purpose TEXT NOT NULL,
  passenger_count INT NOT NULL CHECK (passenger_count > 0),
  contact_phone TEXT NOT NULL,
  -- The teacher who drives, for vehicles without a regular driver.
  driver_name TEXT,
  status public.approval_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vehicle_reservations_time_check CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS vehicle_reservations_vehicle_time_idx ON public.vehicle_reservations (vehicle_id, start_time);
CREATE INDEX IF NOT EXISTS vehicle_reservations_applicant_idx ON public.vehicle_reservations (applicant_id);

DROP TRIGGER IF EXISTS vehicle_reservations_touch ON public.vehicle_reservations;
CREATE TRIGGER vehicle_reservations_touch BEFORE UPDATE ON public.vehicle_reservations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- A vehicle cannot have two overlapping active trips. The calendar warns in real time; this settles a race.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_reservations_no_overlap') THEN
    ALTER TABLE public.vehicle_reservations
      ADD CONSTRAINT vehicle_reservations_no_overlap
      EXCLUDE USING gist (vehicle_id WITH =, tstzrange(start_time, end_time) WITH &&)
      WHERE (status IN ('pending', 'approved'));
  END IF;
END $$;

-- =====================================================================
-- Rules on insert
-- =====================================================================
CREATE OR REPLACE FUNCTION public.enforce_vehicle_reservation_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v record;
BEGIN
  SELECT is_bookable, seats, has_driver, requires_approval INTO v
  FROM public.vehicles WHERE id = NEW.vehicle_id;
  IF NOT FOUND OR NOT v.is_bookable THEN
    RAISE EXCEPTION 'รถคันนี้ไม่เปิดให้ขอใช้' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.start_time < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'ไม่สามารถจองย้อนหลังได้' USING ERRCODE = 'P0001';
  END IF;
  IF v.seats IS NOT NULL AND NEW.passenger_count > v.seats THEN
    RAISE EXCEPTION 'รถคันนี้นั่งได้ % คน', v.seats USING ERRCODE = 'P0001';
  END IF;
  IF NOT v.has_driver AND COALESCE(btrim(NEW.driver_name), '') = '' THEN
    RAISE EXCEPTION 'กรุณาระบุชื่อผู้ขับรถ' USING ERRCODE = 'P0001';
  END IF;
  NEW.status := CASE WHEN v.requires_approval THEN 'pending'::public.approval_status
                     ELSE 'approved'::public.approval_status END;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.enforce_vehicle_reservation_rules() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vehicle_reservations_rules ON public.vehicle_reservations;
CREATE TRIGGER vehicle_reservations_rules BEFORE INSERT ON public.vehicle_reservations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_vehicle_reservation_rules();

-- =====================================================================
-- Row Level Security
-- =====================================================================
REVOKE ALL ON public.vehicles, public.vehicle_reservations FROM anon;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicles: read" ON public.vehicles;
CREATE POLICY "vehicles: read" ON public.vehicles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "vehicles: admin manage" ON public.vehicles;
CREATE POLICY "vehicles: admin manage" ON public.vehicles FOR ALL TO authenticated
  USING (public.current_role_is('super_admin')) WITH CHECK (public.current_role_is('super_admin'));

-- Everyone signed in sees which dates are taken. Rejected requests stay with the applicant and the approvers.
DROP POLICY IF EXISTS "vehicle reservations: read active" ON public.vehicle_reservations;
CREATE POLICY "vehicle reservations: read active" ON public.vehicle_reservations FOR SELECT TO authenticated
  USING (status IN ('pending', 'approved'));
DROP POLICY IF EXISTS "vehicle reservations: read own" ON public.vehicle_reservations;
CREATE POLICY "vehicle reservations: read own" ON public.vehicle_reservations FOR SELECT TO authenticated
  USING (applicant_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "vehicle reservations: approvers read all" ON public.vehicle_reservations;
CREATE POLICY "vehicle reservations: approvers read all" ON public.vehicle_reservations FOR SELECT TO authenticated
  USING (public.current_role_is('executive', 'super_admin'));

DROP POLICY IF EXISTS "vehicle reservations: create own" ON public.vehicle_reservations;
CREATE POLICY "vehicle reservations: create own" ON public.vehicle_reservations FOR INSERT TO authenticated
  WITH CHECK (applicant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "vehicle reservations: approvers decide" ON public.vehicle_reservations;
CREATE POLICY "vehicle reservations: approvers decide" ON public.vehicle_reservations FOR UPDATE TO authenticated
  USING (public.current_role_is('executive', 'super_admin'))
  WITH CHECK (public.current_role_is('executive', 'super_admin'));

-- The applicant can only withdraw their own trip, and only before it starts (withdrawn = 'rejected').
DROP POLICY IF EXISTS "vehicle reservations: applicant cancels own" ON public.vehicle_reservations;
CREATE POLICY "vehicle reservations: applicant cancels own" ON public.vehicle_reservations FOR UPDATE TO authenticated
  USING (applicant_id = (SELECT auth.uid()) AND status IN ('pending', 'approved') AND start_time > now())
  WITH CHECK (applicant_id = (SELECT auth.uid()) AND status = 'rejected');

-- Names on the calendar for the director: only people who have made a request, never the whole directory.
DROP POLICY IF EXISTS "profiles: executive read vehicle applicants" ON public.profiles;
CREATE POLICY "profiles: executive read vehicle applicants" ON public.profiles FOR SELECT TO authenticated
  USING (public.current_role_is('executive')
         AND EXISTS (SELECT 1 FROM public.vehicle_reservations v WHERE v.applicant_id = profiles.id));

-- Live updates: the calendar refreshes when anyone books.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'vehicle_reservations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicle_reservations;
  END IF;
END $$;

-- =====================================================================
-- Starter data (edit to match the real vehicles)
-- =====================================================================
-- Seats are left empty on purpose: the passenger check only runs once a number is set, so a wrong guess
-- cannot block a real trip. Set them, and the plates, with for example:
--   update public.vehicles set seats = 12, plate = 'กก 1234' where kind = 'van';
INSERT INTO public.vehicles (kind, name, has_driver, requires_approval, sort_order)
SELECT v.kind, v.name, v.has_driver, v.requires_approval, v.sort_order
FROM (VALUES
  ('van', 'รถตู้', TRUE, TRUE, 1),
  ('songthaew', 'รถสองแถวโรงเรียน', TRUE, TRUE, 2),
  ('pickup', 'รถกระบะ', FALSE, FALSE, 3)
) AS v(kind, name, has_driver, requires_approval, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.vehicles);

-- =====================================================================
-- Check block: run after the file. Expect 3 vehicles, both tables with RLS on, the exclusion constraint,
-- both triggers, and 8 policies on vehicle_reservations plus 2 on vehicles.
-- =====================================================================
-- SELECT count(*) AS vehicles FROM public.vehicles;
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('vehicles', 'vehicle_reservations');
-- SELECT conname FROM pg_constraint WHERE conname = 'vehicle_reservations_no_overlap';
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.vehicle_reservations'::regclass AND NOT tgisinternal;
-- SELECT tablename, count(*) FROM pg_policies WHERE tablename IN ('vehicles', 'vehicle_reservations') GROUP BY tablename;
