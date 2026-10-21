-- Facility module, part 02 of 02: head = staff in every check, classroom cleaning zones and
-- the confirm_cleaning() RPC. Run AFTER facility_01_head_role.sql, as a separate run.
-- Everything here only adds; nothing existing is dropped or narrowed. Safe to run again
-- (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS before each CREATE POLICY).
-- The whole file runs as one transaction in the SQL editor: if any statement fails, none applies.
--
-- วิธีรัน: รัน facility_01_head_role.sql ให้เสร็จก่อน แล้ววางไฟล์นี้ทั้งไฟล์ใน SQL Editor กด Run
-- ส่วน "ชุดตรวจสอบ" ท้ายไฟล์เป็นคอมเมนต์ทั้งหมด ไม่ถูกรันไปด้วย ให้คัดลอกไปรันทีละชุดภายหลัง

-- 0. Stop early with a clear message if part 01 has not been run yet.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'user_role' AND e.enumlabel = 'head'
  ) THEN
    RAISE EXCEPTION 'ยังไม่ได้รันไฟล์ facility_01_head_role.sql — รันไฟล์นั้นแยกก่อน แล้วค่อยรันไฟล์นี้';
  END IF;
END $$;

-- =====================================================================
-- 1. head passes every check that lists staff
-- =====================================================================
-- Same function as schema.sql 9.5, plus one rule: a 'head' caller matches whenever 'staff' is
-- in the list. Every existing policy and RPC that says current_role_is('staff', ...) therefore
-- admits head too, without touching any of them. For every other role the result is unchanged.
CREATE OR REPLACE FUNCTION public.current_role_is(VARIADIC roles public.user_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND (p.role = ANY (roles)
           OR (p.role = 'head'::public.user_role AND 'staff'::public.user_role = ANY (roles)))
  );
$$;
REVOKE EXECUTE ON FUNCTION public.current_role_is(public.user_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_role_is(public.user_role[]) TO authenticated;

-- =====================================================================
-- 2. Tables
-- =====================================================================
-- One row per class per term (e.g. term '2569/2', name 'ม.3/2'), with its cleaning zone.
-- No student names or accounts: the class is the unit, its advisors confirm for it.
CREATE TABLE IF NOT EXISTS public.classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL,
  name TEXT NOT NULL,
  building_id UUID NULL REFERENCES public.buildings(id) ON DELETE SET NULL,
  zone TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (term, name)
);

-- A class can have several advisors; any one of them may confirm.
CREATE TABLE IF NOT EXISTS public.classroom_advisors (
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (classroom_id, user_id)
);
CREATE INDEX IF NOT EXISTS classroom_advisors_user_idx ON public.classroom_advisors (user_id);

-- Holidays and closures set by staff; weekends are excluded by the RPC itself.
CREATE TABLE IF NOT EXISTS public.school_off_days (
  day DATE PRIMARY KEY,
  reason TEXT
);

-- At most one confirmation per class per day; the first advisor to confirm wins.
-- Written only by confirm_cleaning() (there is no insert/update/delete policy).
-- confirmed_by is kept as history: deleting the teacher's account clears it instead of blocking.
CREATE TABLE IF NOT EXISTS public.cleaning_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_late BOOLEAN NOT NULL,
  photo_paths TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(photo_paths) <= 4),
  UNIQUE (classroom_id, day)
);
CREATE INDEX IF NOT EXISTS cleaning_confirmations_day_idx ON public.cleaning_confirmations (day);

-- =====================================================================
-- 3. Row Level Security
--    "officers" = current_role_is('staff', 'super_admin'), i.e. staff, head and super_admin.
-- =====================================================================
ALTER TABLE public.classrooms             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_advisors     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_off_days        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaning_confirmations ENABLE ROW LEVEL SECURITY;

-- classroom_advisors: officers see every assignment; a teacher sees only their own rows.
-- (The classrooms/confirmations policies below rely on "own rows" being visible.)
DROP POLICY IF EXISTS "classroom advisors: officers or self read" ON public.classroom_advisors;
CREATE POLICY "classroom advisors: officers or self read" ON public.classroom_advisors FOR SELECT TO authenticated
  USING (public.current_role_is('staff', 'super_admin') OR user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "classroom advisors: staff manage" ON public.classroom_advisors;
CREATE POLICY "classroom advisors: staff manage" ON public.classroom_advisors FOR ALL TO authenticated
  USING (public.current_role_is('staff', 'super_admin'))
  WITH CHECK (public.current_role_is('staff', 'super_admin'));

-- classrooms: officers see all; a teacher sees only the classes they advise.
DROP POLICY IF EXISTS "classrooms: officers or advisors read" ON public.classrooms;
CREATE POLICY "classrooms: officers or advisors read" ON public.classrooms FOR SELECT TO authenticated
  USING (public.current_role_is('staff', 'super_admin') OR EXISTS (
    SELECT 1 FROM public.classroom_advisors a
    WHERE a.classroom_id = classrooms.id AND a.user_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "classrooms: staff manage" ON public.classrooms;
CREATE POLICY "classrooms: staff manage" ON public.classrooms FOR ALL TO authenticated
  USING (public.current_role_is('staff', 'super_admin'))
  WITH CHECK (public.current_role_is('staff', 'super_admin'));

-- school_off_days: any signed-in user reads (the teacher page greys these days out); officers manage.
DROP POLICY IF EXISTS "off days: read" ON public.school_off_days;
CREATE POLICY "off days: read" ON public.school_off_days FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "off days: staff manage" ON public.school_off_days;
CREATE POLICY "off days: staff manage" ON public.school_off_days FOR ALL TO authenticated
  USING (public.current_role_is('staff', 'super_admin'))
  WITH CHECK (public.current_role_is('staff', 'super_admin'));

-- cleaning_confirmations: officers see all; advisors see their classes' rows. Read only:
-- no insert/update/delete policy, so the only way in is confirm_cleaning() below.
DROP POLICY IF EXISTS "cleaning confirmations: officers or advisors read" ON public.cleaning_confirmations;
CREATE POLICY "cleaning confirmations: officers or advisors read" ON public.cleaning_confirmations FOR SELECT TO authenticated
  USING (public.current_role_is('staff', 'super_admin') OR EXISTS (
    SELECT 1 FROM public.classroom_advisors a
    WHERE a.classroom_id = cleaning_confirmations.classroom_id AND a.user_id = (SELECT auth.uid())));

-- =====================================================================
-- 4. confirm_cleaning(): the only writer of cleaning_confirmations
-- =====================================================================
-- Returns 'confirmed' when this call recorded the day, 'already' when another advisor (or this
-- one) had already confirmed it. Two advisors pressing at the same moment: the unique key makes
-- the second insert wait and then do nothing, so it gets 'already', never an error.
-- "Today" is the Bangkok calendar day, so a confirmation at 00:30 Bangkok counts for that day.
-- A confirmation for an earlier day is allowed up to 7 days back and marked is_late.
CREATE OR REPLACE FUNCTION public.confirm_cleaning(p_classroom UUID, p_day DATE, p_photos TEXT[])
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_today DATE := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_photos TEXT[] := COALESCE(p_photos, '{}');
  v_path TEXT;
  v_id UUID;
BEGIN
  -- Same message whether the class does not exist, is inactive or belongs to someone else,
  -- so guessing ids reveals nothing.
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.classroom_advisors a
    JOIN public.classrooms c ON c.id = a.classroom_id
    WHERE a.classroom_id = p_classroom AND a.user_id = v_uid AND c.is_active
  ) THEN
    RAISE EXCEPTION 'คุณไม่ได้เป็นครูที่ปรึกษาของห้องนี้' USING ERRCODE = 'P0001';
  END IF;

  IF p_day IS NULL THEN
    RAISE EXCEPTION 'ไม่ได้ระบุวันที่' USING ERRCODE = 'P0001';
  END IF;
  IF p_day > v_today THEN
    RAISE EXCEPTION 'ยืนยันล่วงหน้าไม่ได้ ยืนยันได้ถึงวันนี้เท่านั้น' USING ERRCODE = 'P0001';
  END IF;
  IF p_day < v_today - 7 THEN
    RAISE EXCEPTION 'ยืนยันย้อนหลังได้ไม่เกิน 7 วัน' USING ERRCODE = 'P0001';
  END IF;
  IF extract(isodow FROM p_day) >= 6 THEN
    RAISE EXCEPTION 'วันเสาร์-อาทิตย์ไม่ต้องยืนยัน' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.school_off_days o WHERE o.day = p_day) THEN
    RAISE EXCEPTION 'วันนี้เป็นวันหยุดหรือปิดเรียน ไม่ต้องยืนยัน' USING ERRCODE = 'P0001';
  END IF;

  IF cardinality(v_photos) > 4 THEN
    RAISE EXCEPTION 'แนบรูปได้ไม่เกิน 4 รูป' USING ERRCODE = 'P0001';
  END IF;
  -- Only files the caller uploaded through the app: <their user id>/<uuid>.jpg
  FOREACH v_path IN ARRAY v_photos LOOP
    IF v_path IS NULL OR v_path !~ ('^' || v_uid::text || '/[0-9a-f-]{36}\.jpg$') THEN
      RAISE EXCEPTION 'รูปที่แนบไม่ถูกต้อง' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  INSERT INTO public.cleaning_confirmations (classroom_id, day, confirmed_by, is_late, photo_paths)
  VALUES (p_classroom, p_day, v_uid, p_day < v_today, v_photos)
  ON CONFLICT (classroom_id, day) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN 'already';
  END IF;
  RETURN 'confirmed';
END $$;
REVOKE EXECUTE ON FUNCTION public.confirm_cleaning(UUID, DATE, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_cleaning(UUID, DATE, TEXT[]) TO authenticated;

-- =====================================================================
-- 5. Cleaning photos: private bucket, files under <user id>/<uuid>.jpg, shown through signed URLs.
--    Same three own-folder policies as feedback-images; officers may also read.
-- =====================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('cleaning-photos', 'cleaning-photos', false, 1048576, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "cleaning photos: upload to own folder" ON storage.objects;
CREATE POLICY "cleaning photos: upload to own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cleaning-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS "cleaning photos: read own or officers" ON storage.objects;
CREATE POLICY "cleaning photos: read own or officers" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cleaning-photos' AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR public.current_role_is('staff', 'super_admin')));
DROP POLICY IF EXISTS "cleaning photos: delete own or admin" ON storage.objects;
CREATE POLICY "cleaning photos: delete own or admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cleaning-photos' AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR public.current_role_is('super_admin')));

-- =====================================================================
-- 6. ชุดตรวจสอบ (CHECK BLOCK) — ทั้งหมดเป็นคอมเมนต์ ไม่ถูกรันพร้อมไฟล์
-- =====================================================================
-- วิธีใช้:
--   1) รันไฟล์นี้ให้เสร็จก่อน (ขึ้น Success)
--   2) แก้อีเมล 3 แบบนี้ให้เป็นบัญชีที่มีอยู่จริง คนละคนกัน (ใช้ Find & Replace ในหน้าจอได้):
--        ครูทดสอบ@lrp.ac.th     = ครูที่จะเป็นครูที่ปรึกษาของห้องทดสอบ (บัญชีครูธรรมดา)
--        ครูคนอื่น@lrp.ac.th    = ครูอีกคน ที่ไม่ใช่ครูที่ปรึกษา (บัญชีครูธรรมดา ไม่ใช่ staff/head/super_admin)
--        หัวหน้าทดสอบ@lrp.ac.th = บัญชีที่จะถูกตั้งเป็น head ชั่วคราวในชุด J (ต้องไม่ใช่ super_admin)
--      ดูอีเมลที่มีอยู่จริงได้ด้วย:  select email, role from public.profiles order by email;
--   3) คัดลอกทีละชุด (ทุกบรรทัดใต้หัวข้อชุด) ไปวางใน SQL Editor หน้าใหม่
--      ลบเครื่องหมาย "-- " หน้าบรรทัดออก (เลือกข้อความแล้วกด Ctrl+/ หรือ Cmd+/) แล้วกด Run
--   4) **ทุกชุดจบด้วยข้อความ ERROR เสมอ — ตั้งใจให้เป็นแบบนั้น** เพราะ error ทำให้ระบบยกเลิก
--      ทุกอย่างที่ชุดนั้นทำ (ห้องทดสอบ ครูที่ปรึกษา บทบาท head ชั่วคราว การยืนยันทดสอบ) จึงไม่มีอะไร
--      ค้างในระบบ ให้เทียบข้อความหลังคำว่า ERROR กับ "ผลที่ควรได้" ของชุดนั้น
--      - ชุดที่ทดสอบว่าระบบต้องปฏิเสธ: ข้อความ error คือคำปฏิเสธจากระบบ
--      - ชุดที่ทดสอบว่าทำได้: ข้อความขึ้นต้นด้วย "ผลทดสอบ:" ตามด้วยค่าที่วัดได้
--   5) ถ้าชุด A, C, I ขึ้น "คุณไม่ได้เป็นครูที่ปรึกษาของห้องนี้" หรือค่าเป็น 0 ผิดคาด ให้ตรวจว่า
--      อีเมลที่แก้ตรงกับบัญชีจริงทุกตัวอักษร
--   6) ถ้าผลแปลก เช่น ชุด C ได้ rooms_seen=1 ทั้งที่ใช้บัญชีครูธรรมดา หรือมีคำเตือน
--      "SET LOCAL can only be used in transaction blocks" ให้เพิ่มบรรทัด begin; เป็นบรรทัดแรกของชุด
--      กด Run แล้วเมื่ออ่านผลเสร็จ ให้รันคำสั่ง rollback; อีกครั้งเพื่อยกเลิกข้อมูลทดสอบ
--
-- ทุกชุดเริ่มด้วยการสร้างห้องทดสอบ 'ห้องทดสอบ' (ภาค TEST) และตั้ง "วันทดสอบ" = วันจันทร์-ศุกร์
-- ล่าสุดที่ไม่เกินวันนี้ตามเวลาไทย ถ้าวันนั้นถูกตั้งเป็นวันหยุดไว้ ชุด A, G, H, I จะขึ้น error
-- เรื่องวันหยุดแทน ซึ่งไม่ใช่ความผิดของระบบ ให้รันใหม่ในวันเรียนปกติ
--
-- ========== ชุด A: ครูที่ปรึกษายืนยัน แล้วกดซ้ำ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: first_try=confirmed, second_try=already, row_count=1
-- insert into public.classrooms (term, name, zone) values ('TEST', 'ห้องทดสอบ', 'เขตทดสอบ');
-- insert into public.classroom_advisors (classroom_id, user_id)
--   select c.id, p.id from public.classrooms c, public.profiles p
--   where c.term = 'TEST' and c.name = 'ห้องทดสอบ' and p.email = 'ครูทดสอบ@lrp.ac.th';
-- select set_config('test.classroom', (select id::text from public.classrooms where term = 'TEST' and name = 'ห้องทดสอบ'), true);
-- select set_config('test.day', (select (d - case extract(isodow from d)::int when 6 then 1 when 7 then 2 else 0 end)::text
--   from (select (now() at time zone 'Asia/Bangkok')::date as d) t), true);
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- select set_config('test.r1', public.confirm_cleaning(current_setting('test.classroom')::uuid, current_setting('test.day')::date, '{}'), true);
-- select set_config('test.r2', public.confirm_cleaning(current_setting('test.classroom')::uuid, current_setting('test.day')::date, '{}'), true);
-- do $$ begin raise exception 'ผลทดสอบ: first_try=%, second_try=%, row_count=%',
--   current_setting('test.r1'), current_setting('test.r2'),
--   (select count(*) from public.cleaning_confirmations where classroom_id = current_setting('test.classroom')::uuid); end $$;
--
-- ========== ชุด B: ครูที่ไม่ใช่ครูที่ปรึกษากดยืนยัน ==========
-- ผลที่ควรได้: ERROR: คุณไม่ได้เป็นครูที่ปรึกษาของห้องนี้
-- insert into public.classrooms (term, name, zone) values ('TEST', 'ห้องทดสอบ', 'เขตทดสอบ');
-- insert into public.classroom_advisors (classroom_id, user_id)
--   select c.id, p.id from public.classrooms c, public.profiles p
--   where c.term = 'TEST' and c.name = 'ห้องทดสอบ' and p.email = 'ครูทดสอบ@lrp.ac.th';
-- select set_config('test.classroom', (select id::text from public.classrooms where term = 'TEST' and name = 'ห้องทดสอบ'), true);
-- select set_config('test.day', (select (d - case extract(isodow from d)::int when 6 then 1 when 7 then 2 else 0 end)::text
--   from (select (now() at time zone 'Asia/Bangkok')::date as d) t), true);
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'ครูคนอื่น@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- select public.confirm_cleaning(current_setting('test.classroom')::uuid, current_setting('test.day')::date, '{}');
--
-- ========== ชุด C: ครูที่ไม่ใช่ครูที่ปรึกษามองไม่เห็นห้องทดสอบ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: rooms_seen=0, advisors_seen=0
-- insert into public.classrooms (term, name, zone) values ('TEST', 'ห้องทดสอบ', 'เขตทดสอบ');
-- insert into public.classroom_advisors (classroom_id, user_id)
--   select c.id, p.id from public.classrooms c, public.profiles p
--   where c.term = 'TEST' and c.name = 'ห้องทดสอบ' and p.email = 'ครูทดสอบ@lrp.ac.th';
-- select set_config('test.classroom', (select id::text from public.classrooms where term = 'TEST' and name = 'ห้องทดสอบ'), true);
-- select set_config('test.day', (select (d - case extract(isodow from d)::int when 6 then 1 when 7 then 2 else 0 end)::text
--   from (select (now() at time zone 'Asia/Bangkok')::date as d) t), true);
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'ครูคนอื่น@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ begin raise exception 'ผลทดสอบ: rooms_seen=%, advisors_seen=%',
--   (select count(*) from public.classrooms where term = 'TEST'),
--   (select count(*) from public.classroom_advisors where classroom_id = current_setting('test.classroom')::uuid); end $$;
--
-- ========== ชุด D: ยืนยันล่วงหน้า (พรุ่งนี้) ==========
-- ผลที่ควรได้: ERROR: ยืนยันล่วงหน้าไม่ได้ ยืนยันได้ถึงวันนี้เท่านั้น
-- insert into public.classrooms (term, name, zone) values ('TEST', 'ห้องทดสอบ', 'เขตทดสอบ');
-- insert into public.classroom_advisors (classroom_id, user_id)
--   select c.id, p.id from public.classrooms c, public.profiles p
--   where c.term = 'TEST' and c.name = 'ห้องทดสอบ' and p.email = 'ครูทดสอบ@lrp.ac.th';
-- select set_config('test.classroom', (select id::text from public.classrooms where term = 'TEST' and name = 'ห้องทดสอบ'), true);
-- select set_config('test.day', (select (d - case extract(isodow from d)::int when 6 then 1 when 7 then 2 else 0 end)::text
--   from (select (now() at time zone 'Asia/Bangkok')::date as d) t), true);
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- select public.confirm_cleaning(current_setting('test.classroom')::uuid, (now() at time zone 'Asia/Bangkok')::date + 1, '{}');
--
-- ========== ชุด E: ยืนยันวันเสาร์ (วันเสาร์ล่าสุด ไม่เกิน 6 วันก่อน) ==========
-- ผลที่ควรได้: ERROR: วันเสาร์-อาทิตย์ไม่ต้องยืนยัน
-- insert into public.classrooms (term, name, zone) values ('TEST', 'ห้องทดสอบ', 'เขตทดสอบ');
-- insert into public.classroom_advisors (classroom_id, user_id)
--   select c.id, p.id from public.classrooms c, public.profiles p
--   where c.term = 'TEST' and c.name = 'ห้องทดสอบ' and p.email = 'ครูทดสอบ@lrp.ac.th';
-- select set_config('test.classroom', (select id::text from public.classrooms where term = 'TEST' and name = 'ห้องทดสอบ'), true);
-- select set_config('test.day', (select (d - case extract(isodow from d)::int when 6 then 1 when 7 then 2 else 0 end)::text
--   from (select (now() at time zone 'Asia/Bangkok')::date as d) t), true);
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- select public.confirm_cleaning(current_setting('test.classroom')::uuid,
--   (select d - ((extract(isodow from d)::int + 1) % 7) from (select (now() at time zone 'Asia/Bangkok')::date as d) t), '{}');
--
-- ========== ชุด F: ยืนยันย้อนหลังเกิน 7 วัน ==========
-- ผลที่ควรได้: ERROR: ยืนยันย้อนหลังได้ไม่เกิน 7 วัน
-- insert into public.classrooms (term, name, zone) values ('TEST', 'ห้องทดสอบ', 'เขตทดสอบ');
-- insert into public.classroom_advisors (classroom_id, user_id)
--   select c.id, p.id from public.classrooms c, public.profiles p
--   where c.term = 'TEST' and c.name = 'ห้องทดสอบ' and p.email = 'ครูทดสอบ@lrp.ac.th';
-- select set_config('test.classroom', (select id::text from public.classrooms where term = 'TEST' and name = 'ห้องทดสอบ'), true);
-- select set_config('test.day', (select (d - case extract(isodow from d)::int when 6 then 1 when 7 then 2 else 0 end)::text
--   from (select (now() at time zone 'Asia/Bangkok')::date as d) t), true);
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- select public.confirm_cleaning(current_setting('test.classroom')::uuid, current_setting('test.day')::date - 14, '{}');
--
-- ========== ชุด G: แนบรูป 5 รูป ==========
-- ผลที่ควรได้: ERROR: แนบรูปได้ไม่เกิน 4 รูป
-- insert into public.classrooms (term, name, zone) values ('TEST', 'ห้องทดสอบ', 'เขตทดสอบ');
-- insert into public.classroom_advisors (classroom_id, user_id)
--   select c.id, p.id from public.classrooms c, public.profiles p
--   where c.term = 'TEST' and c.name = 'ห้องทดสอบ' and p.email = 'ครูทดสอบ@lrp.ac.th';
-- select set_config('test.classroom', (select id::text from public.classrooms where term = 'TEST' and name = 'ห้องทดสอบ'), true);
-- select set_config('test.day', (select (d - case extract(isodow from d)::int when 6 then 1 when 7 then 2 else 0 end)::text
--   from (select (now() at time zone 'Asia/Bangkok')::date as d) t), true);
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- select public.confirm_cleaning(current_setting('test.classroom')::uuid, current_setting('test.day')::date,
--   array['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg']);
--
-- ========== ชุด H: แนบรูปที่ไม่ได้อยู่ในโฟลเดอร์ของตัวเอง ==========
-- ผลที่ควรได้: ERROR: รูปที่แนบไม่ถูกต้อง
-- insert into public.classrooms (term, name, zone) values ('TEST', 'ห้องทดสอบ', 'เขตทดสอบ');
-- insert into public.classroom_advisors (classroom_id, user_id)
--   select c.id, p.id from public.classrooms c, public.profiles p
--   where c.term = 'TEST' and c.name = 'ห้องทดสอบ' and p.email = 'ครูทดสอบ@lrp.ac.th';
-- select set_config('test.classroom', (select id::text from public.classrooms where term = 'TEST' and name = 'ห้องทดสอบ'), true);
-- select set_config('test.day', (select (d - case extract(isodow from d)::int when 6 then 1 when 7 then 2 else 0 end)::text
--   from (select (now() at time zone 'Asia/Bangkok')::date as d) t), true);
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- select public.confirm_cleaning(current_setting('test.classroom')::uuid, current_setting('test.day')::date,
--   array['00000000-0000-0000-0000-000000000000/11111111-1111-1111-1111-111111111111.jpg']);
--
-- ========== ชุด I: แนบรูปถูกต้อง 1 รูป ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: result=confirmed, photos=1
-- insert into public.classrooms (term, name, zone) values ('TEST', 'ห้องทดสอบ', 'เขตทดสอบ');
-- insert into public.classroom_advisors (classroom_id, user_id)
--   select c.id, p.id from public.classrooms c, public.profiles p
--   where c.term = 'TEST' and c.name = 'ห้องทดสอบ' and p.email = 'ครูทดสอบ@lrp.ac.th';
-- select set_config('test.classroom', (select id::text from public.classrooms where term = 'TEST' and name = 'ห้องทดสอบ'), true);
-- select set_config('test.day', (select (d - case extract(isodow from d)::int when 6 then 1 when 7 then 2 else 0 end)::text
--   from (select (now() at time zone 'Asia/Bangkok')::date as d) t), true);
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- select set_config('test.r1', public.confirm_cleaning(current_setting('test.classroom')::uuid, current_setting('test.day')::date,
--   array[(auth.uid())::text || '/' || gen_random_uuid()::text || '.jpg']), true);
-- do $$ begin raise exception 'ผลทดสอบ: result=%, photos=%', current_setting('test.r1'),
--   (select cardinality(photo_paths) from public.cleaning_confirmations where classroom_id = current_setting('test.classroom')::uuid); end $$;
--
-- ========== ชุด J: head ทำได้เท่า staff (ตั้ง head ชั่วคราว ถูกยกเลิกเองเมื่อจบชุด) ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: is_staff=t (t = จริง), is_admin=f (f = ไม่จริง), tickets_seen=N, all_tickets=N, rooms_seen=1
--   (N สองตัวต้องเท่ากัน = head เห็นเรื่องแจ้งซ่อมทุกเรื่อง ไม่ใช่แค่ของตัวเอง)
-- insert into public.classrooms (term, name, zone) values ('TEST', 'ห้องทดสอบ', 'เขตทดสอบ');
-- insert into public.classroom_advisors (classroom_id, user_id)
--   select c.id, p.id from public.classrooms c, public.profiles p
--   where c.term = 'TEST' and c.name = 'ห้องทดสอบ' and p.email = 'ครูทดสอบ@lrp.ac.th';
-- select set_config('test.classroom', (select id::text from public.classrooms where term = 'TEST' and name = 'ห้องทดสอบ'), true);
-- select set_config('test.day', (select (d - case extract(isodow from d)::int when 6 then 1 when 7 then 2 else 0 end)::text
--   from (select (now() at time zone 'Asia/Bangkok')::date as d) t), true);
-- update public.profiles set role = 'head' where email = 'หัวหน้าทดสอบ@lrp.ac.th';
-- select set_config('test.all_tickets', (select count(*)::text from public.repair_tickets where deleted_at is null), true);
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'หัวหน้าทดสอบ@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ begin raise exception 'ผลทดสอบ: is_staff=%, is_admin=%, tickets_seen=%, all_tickets=%, rooms_seen=%',
--   public.current_role_is('staff'), public.current_role_is('super_admin'),
--   (select count(*) from public.repair_tickets), current_setting('test.all_tickets'),
--   (select count(*) from public.classrooms where term = 'TEST'); end $$;
--
-- กรณีที่ทดสอบใน SQL Editor ไม่ได้: ครูที่ปรึกษาสองคนกดพร้อมกันในวินาทีเดียวกัน
-- ฐานข้อมูลรับประกันด้วย unique (classroom_id, day) + ON CONFLICT DO NOTHING:
-- คนแรกได้ confirmed คนที่สองได้ already โดยไม่มี error และมีเพียง 1 แถว
