-- 1. EXTENSIONS & ENUMS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('super_admin', 'staff', 'user');
CREATE TYPE ticket_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE urgency_level AS ENUM ('low', 'medium', 'high', 'emergency');
CREATE TYPE approval_mode AS ENUM ('paper_hybrid', 'digital_multistage');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'revision_requested');
CREATE TYPE module_type AS ENUM ('repair', 'reservation', 'environment', 'general_memo');

-- 2. USERS & PROFILES
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  department TEXT,
  position TEXT,
  role user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. MASTER DATA: BUILDINGS & ROOMS
CREATE TABLE buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,      -- เช่น BLD-01
  name TEXT NOT NULL,             -- เช่น อาคาร 1, อาคารวิทยาศาสตร์
  floor_count INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,      -- เช่น 112, LAB-SCI
  name TEXT NOT NULL,             -- เช่น ห้องปฏิบัติการเคมี, ห้องพักครู
  capacity INT,
  is_bookable BOOLEAN DEFAULT FALSE, -- ใช้สำหรับระบบขอใช้สถานที่
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MODULE 1: REPAIR TICKETS (งานแจ้งซ่อม)
CREATE TABLE repair_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL,
  reporter_id UUID NOT NULL REFERENCES profiles(id),
  building_id UUID NOT NULL REFERENCES buildings(id),
  room_id UUID REFERENCES rooms(id),
  location_detail TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  urgency urgency_level NOT NULL DEFAULT 'medium',
  status ticket_status NOT NULL DEFAULT 'pending',
  image_urls TEXT[] DEFAULT '{}',
  estimated_cost NUMERIC(10,2) DEFAULT 0.00,
  technician_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. MODULE 2: FACILITY RESERVATIONS (งานขอใช้สถานที่)
CREATE TABLE facility_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_number TEXT UNIQUE NOT NULL,
  applicant_id UUID NOT NULL REFERENCES profiles(id),
  room_id UUID NOT NULL REFERENCES rooms(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  purpose TEXT NOT NULL,
  attendee_count INT,
  equipment_needed TEXT,
  status approval_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. MODULE 3: ENVIRONMENT & SAFETY INSPECTIONS (งานสิ่งแวดล้อม/5ส)
CREATE TABLE environment_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspector_id UUID NOT NULL REFERENCES profiles(id),
  building_id UUID NOT NULL REFERENCES buildings(id),
  room_id UUID REFERENCES rooms(id),
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  score_cleanliness INT CHECK (score_cleanliness BETWEEN 1 AND 5),
  score_safety INT CHECK (score_safety BETWEEN 1 AND 5),
  score_landscape INT CHECK (score_landscape BETWEEN 1 AND 5),
  findings TEXT,
  action_required TEXT,
  image_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. MODULE 4: CENTRAL MEMO & DUAL-MODE APPROVAL ENGINE (สารบรรณและบันทึกข้อความ)
CREATE TABLE memorandums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_ref_no TEXT UNIQUE NOT NULL, -- เลขที่บันทึกข้อความ
  origin_module module_type NOT NULL,
  reference_id UUID,                -- ผูกกับ repair_tickets, reservations หรือ inspections
  author_id UUID NOT NULL REFERENCES profiles(id),
  subject TEXT NOT NULL,            -- เรื่อง
  recipient TEXT NOT NULL DEFAULT 'ผู้อำนวยการโรงเรียน', -- เรียน
  body_content TEXT NOT NULL,       -- ข้อความเนื้อหาบันทึก
  proposal TEXT,                    -- ข้อเสนอเพื่อพิจารณา
  approval_mode approval_mode NOT NULL DEFAULT 'paper_hybrid',
  current_step INT DEFAULT 1,
  final_status approval_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE approval_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memorandum_id UUID NOT NULL REFERENCES memorandums(id) ON DELETE CASCADE,
  step_order INT NOT NULL,          -- 1: หัวหน้างาน, 2: รอง ผอ., 3: ผอ.
  approver_id UUID REFERENCES profiles(id),
  assigned_role user_role NOT NULL,
  status approval_status DEFAULT 'pending',
  comments TEXT,
  signature_url TEXT,
  action_timestamp TIMESTAMPTZ
);

-- 8. AUTO USER TRIGGER ON AUTH
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    'user'::public.user_role
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- 9. ADDITIONS (not in the original file)
--    Numbering, updated_at, integrity checks, indexes and Row Level Security.
--    Without RLS every table above is readable/writable with the public
--    anon key, so this section is required before real data goes in.
-- =====================================================================

-- 9.1 Document numbers: REQ-YYYYMM-XXXX / RSV-YYYYMM-XXXX (filled when left empty)
CREATE SEQUENCE IF NOT EXISTS public.ticket_number_seq;
CREATE SEQUENCE IF NOT EXISTS public.reservation_number_seq;

CREATE OR REPLACE FUNCTION public.set_ticket_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := 'REQ-' || to_char(now(), 'YYYYMM') || '-' ||
      lpad((nextval('public.ticket_number_seq') % 10000)::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.set_reservation_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.reservation_number IS NULL OR NEW.reservation_number = '' THEN
    NEW.reservation_number := 'RSV-' || to_char(now(), 'YYYYMM') || '-' ||
      lpad((nextval('public.reservation_number_seq') % 10000)::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER repair_tickets_set_number BEFORE INSERT ON repair_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_ticket_number();
CREATE TRIGGER facility_reservations_set_number BEFORE INSERT ON facility_reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_reservation_number();

-- 9.2 updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER repair_tickets_touch BEFORE UPDATE ON repair_tickets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER memorandums_touch BEFORE UPDATE ON memorandums
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 9.3 Integrity
ALTER TABLE facility_reservations
  ADD CONSTRAINT facility_reservations_time_check CHECK (end_time > start_time);
ALTER TABLE rooms
  ADD CONSTRAINT rooms_building_room_unique UNIQUE (building_id, room_number);

-- 9.4 Indexes (foreign keys and the dashboard's sort/filter columns)
CREATE INDEX repair_tickets_reporter_idx ON repair_tickets (reporter_id);
CREATE INDEX repair_tickets_building_idx ON repair_tickets (building_id);
CREATE INDEX repair_tickets_status_idx ON repair_tickets (status);
CREATE INDEX repair_tickets_created_idx ON repair_tickets (created_at DESC);
CREATE INDEX rooms_building_idx ON rooms (building_id);
CREATE INDEX repair_tickets_room_idx ON repair_tickets (room_id);
CREATE INDEX reservations_room_time_idx ON facility_reservations (room_id, start_time);
CREATE INDEX reservations_applicant_idx ON facility_reservations (applicant_id);
CREATE INDEX inspections_building_idx ON environment_inspections (building_id);
CREATE INDEX inspections_room_idx ON environment_inspections (room_id);
CREATE INDEX inspections_inspector_idx ON environment_inspections (inspector_id);
CREATE INDEX memorandums_author_idx ON memorandums (author_id);
CREATE INDEX memorandums_ref_idx ON memorandums (origin_module, reference_id);
CREATE INDEX approval_records_memo_idx ON approval_records (memorandum_id, step_order);
CREATE INDEX approval_records_approver_idx ON approval_records (approver_id);

-- 9.5 Role helper (SECURITY DEFINER avoids recursive RLS on profiles)
CREATE OR REPLACE FUNCTION public.current_role_is(VARIADIC roles public.user_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = ANY (roles)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.current_role_is(public.user_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_role_is(public.user_role[]) TO authenticated;

-- The caller's own role, read outside RLS (a policy on profiles cannot query profiles directly).
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT role FROM public.profiles WHERE id = (SELECT auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- 9.6 Row Level Security
ALTER TABLE profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_tickets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_reservations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE environment_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE memorandums             ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_records        ENABLE ROW LEVEL SECURITY;

-- profiles: own row; super_admin reads/updates all; nobody can promote themselves
CREATE POLICY "profiles: read own" ON profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));
CREATE POLICY "profiles: super_admin read all" ON profiles FOR SELECT TO authenticated
  USING (public.current_role_is('super_admin'));
CREATE POLICY "profiles: staff read all" ON profiles FOR SELECT TO authenticated
  USING (public.current_role_is('staff', 'super_admin'));
CREATE POLICY "profiles: super_admin update all" ON profiles FOR UPDATE TO authenticated
  USING (public.current_role_is('super_admin')) WITH CHECK (public.current_role_is('super_admin'));
CREATE POLICY "profiles: update own" ON profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid())
    AND role = public.current_user_role());

-- buildings / rooms: any signed-in user reads; staff manage
CREATE POLICY "buildings: read" ON buildings FOR SELECT TO authenticated USING (true);
CREATE POLICY "buildings: staff manage" ON buildings FOR ALL TO authenticated
  USING (public.current_role_is('staff', 'super_admin'))
  WITH CHECK (public.current_role_is('staff', 'super_admin'));
CREATE POLICY "rooms: read" ON rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "rooms: staff manage" ON rooms FOR ALL TO authenticated
  USING (public.current_role_is('staff', 'super_admin'))
  WITH CHECK (public.current_role_is('staff', 'super_admin'));

-- repair_tickets: users see/create their own; staff see and manage all
CREATE POLICY "tickets: user reads own" ON repair_tickets FOR SELECT TO authenticated
  USING (reporter_id = (SELECT auth.uid()));
CREATE POLICY "tickets: staff read all" ON repair_tickets FOR SELECT TO authenticated
  USING (public.current_role_is('staff', 'super_admin'));
CREATE POLICY "tickets: user creates own" ON repair_tickets FOR INSERT TO authenticated
  WITH CHECK (reporter_id = (SELECT auth.uid()));
CREATE POLICY "tickets: staff update all" ON repair_tickets FOR UPDATE TO authenticated
  USING (public.current_role_is('staff', 'super_admin'))
  WITH CHECK (public.current_role_is('staff', 'super_admin'));

-- facility_reservations: same shape as tickets
CREATE POLICY "reservations: user reads own" ON facility_reservations FOR SELECT TO authenticated
  USING (applicant_id = (SELECT auth.uid()));
CREATE POLICY "reservations: staff read all" ON facility_reservations FOR SELECT TO authenticated
  USING (public.current_role_is('staff', 'super_admin'));
CREATE POLICY "reservations: user creates own" ON facility_reservations FOR INSERT TO authenticated
  WITH CHECK (applicant_id = (SELECT auth.uid()));
CREATE POLICY "reservations: staff update all" ON facility_reservations FOR UPDATE TO authenticated
  USING (public.current_role_is('staff', 'super_admin'))
  WITH CHECK (public.current_role_is('staff', 'super_admin'));

-- environment_inspections: staff only
CREATE POLICY "inspections: staff manage" ON environment_inspections FOR ALL TO authenticated
  USING (public.current_role_is('staff', 'super_admin'))
  WITH CHECK (public.current_role_is('staff', 'super_admin') AND inspector_id = (SELECT auth.uid()));

-- memorandums: author reads own; staff read/manage all
CREATE POLICY "memos: author reads own" ON memorandums FOR SELECT TO authenticated
  USING (author_id = (SELECT auth.uid()));
CREATE POLICY "memos: staff read all" ON memorandums FOR SELECT TO authenticated
  USING (public.current_role_is('staff', 'super_admin'));
CREATE POLICY "memos: staff create" ON memorandums FOR INSERT TO authenticated
  WITH CHECK (public.current_role_is('staff', 'super_admin') AND author_id = (SELECT auth.uid()));
CREATE POLICY "memos: staff update" ON memorandums FOR UPDATE TO authenticated
  USING (public.current_role_is('staff', 'super_admin'))
  WITH CHECK (public.current_role_is('staff', 'super_admin'));

-- approval_records: staff read/manage; the assigned approver may record their decision
CREATE POLICY "approvals: staff read" ON approval_records FOR SELECT TO authenticated
  USING (public.current_role_is('staff', 'super_admin') OR approver_id = (SELECT auth.uid()));
CREATE POLICY "approvals: staff manage" ON approval_records FOR ALL TO authenticated
  USING (public.current_role_is('staff', 'super_admin'))
  WITH CHECK (public.current_role_is('staff', 'super_admin'));

-- 9.7 Trigger-only functions must not be callable through the REST /rpc endpoint.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_ticket_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_reservation_number() FROM PUBLIC, anon, authenticated;

-- 9.8 Draft memo numbers: MEMO-YYYYMM-XXXX until the records office assigns the official number.
CREATE SEQUENCE IF NOT EXISTS public.memo_number_seq;

CREATE OR REPLACE FUNCTION public.set_memo_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.doc_ref_no IS NULL OR NEW.doc_ref_no = '' THEN
    NEW.doc_ref_no := 'MEMO-' || to_char(now(), 'YYYYMM') || '-' ||
      lpad((nextval('public.memo_number_seq') % 10000)::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_memo_number() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER memorandums_set_number BEFORE INSERT ON memorandums
  FOR EACH ROW EXECUTE FUNCTION public.set_memo_number();

-- 9.9 Repair photos: private bucket, files under <user id>/<uuid>.jpg, shown through signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('repair-images', 'repair-images', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "repair images: upload to own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'repair-images' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "repair images: read own or staff" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'repair-images' AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR public.current_role_is('staff', 'super_admin')));

CREATE POLICY "repair images: delete own or staff" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'repair-images' AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR public.current_role_is('staff', 'super_admin')));

ALTER TABLE repair_tickets
  ADD CONSTRAINT repair_tickets_images_max CHECK (cardinality(image_urls) <= 4);
