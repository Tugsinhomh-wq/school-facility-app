-- Cleaning module, part 03: the check window (ช่วงวันที่เช็กเขตทำความสะอาด). Run AFTER cleaning_02.sql.
-- Everything here only adds, apart from confirm_cleaning(), which is replaced by the same function plus
-- one step (below). Safe to run again (IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS before each CREATE).
-- The whole file runs as one transaction in the SQL editor: if any statement fails, none applies.
--
-- วิธีรัน: วางไฟล์นี้ทั้งไฟล์ใน SQL Editor กด Run ส่วน "ชุดตรวจสอบ" ท้ายไฟล์เป็นคอมเมนต์ทั้งหมด ไม่ถูกรันไปด้วย ให้คัดลอกไปรันทีละชุดภายหลัง
-- ต้องรันไฟล์นี้ก่อน deploy โค้ดที่สำรองข้อมูล (src/lib/backup.ts) ไม่งั้นการสำรองคืนถัดไปจะ error เพราะหาตาราง cleaning_settings ไม่เจอ
-- (และฟอร์ม "ช่วงวันที่เช็ก" จะขึ้นข้อความว่าระบบยังไม่พร้อมจนกว่าจะรัน ส่วนหน้าอื่นทำงานเหมือนเดิม คือเช็กทุกวันทำการ)
--
-- What it is:
--   The school can say from which day to which day the cleaning checks apply (e.g. not before the school opens).
--   One row, set by super_admin only; every signed-in user can read it (teachers' pages grey out the days outside it).
--   Both dates are optional: no row, or both empty, means every school day counts, as before.
--   Days outside the window are treated like off days: nothing is due and confirm_cleaning() refuses them.
--   An existing confirmation outside the window is kept as it is.

-- 0. Stop early with a clear message if an earlier file has not been run.
DO $$
BEGIN
  IF to_regclass('public.cleaning_confirmations') IS NULL
     OR to_regclass('public.school_off_days') IS NULL
     OR to_regclass('public.classroom_advisors') IS NULL
     OR to_regclass('public.classrooms') IS NULL
     OR to_regprocedure('public.confirm_cleaning(uuid, date, text[])') IS NULL THEN
    RAISE EXCEPTION 'ยังไม่ได้รันไฟล์ facility_02_cleaning.sql — รันไฟล์นั้นก่อน แล้วค่อยรันไฟล์นี้';
  END IF;
  IF to_regclass('public.cleaning_cancellations') IS NULL
     OR to_regprocedure('public.cancel_cleaning(uuid, date)') IS NULL THEN
    RAISE EXCEPTION 'ยังไม่ได้รันไฟล์ cleaning_02.sql — รันไฟล์นั้นก่อน แล้วค่อยรันไฟล์นี้';
  END IF;
  IF to_regprocedure('public.touch_updated_at()') IS NULL THEN
    RAISE EXCEPTION 'ไม่พบฟังก์ชัน public.touch_updated_at() (อยู่ใน schema.sql ข้อ 9.2)';
  END IF;
END $$;

-- =====================================================================
-- 1. Table: a single row (id is always true)
--    updated_by is kept as history: deleting that account clears it instead of blocking.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.cleaning_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  check_start DATE,
  check_end DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CHECK (check_start IS NULL OR check_end IS NULL OR check_end >= check_start)
);

-- The app roles read it and super_admin writes it (RLS below); service_role reads it for the nightly backup
-- (src/lib/backup.ts). Nobody gets DELETE: clearing the window means setting both dates to empty.
REVOKE ALL ON public.cleaning_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cleaning_settings TO authenticated, service_role;
GRANT INSERT, UPDATE ON public.cleaning_settings TO authenticated;

-- touch_updated_at is the schema.sql 9.2 helper (same as control_assessments).
DROP TRIGGER IF EXISTS cleaning_settings_touch ON public.cleaning_settings;
CREATE TRIGGER cleaning_settings_touch BEFORE UPDATE ON public.cleaning_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Guard, same style as control_assessments_guard in control_02: SECURITY INVOKER (never DEFINER, or the
-- caller below would always read as the function owner). updated_by is whoever is signed in, whatever the
-- client sent (a server-side job with no auth.uid() keeps what it sets).
CREATE OR REPLACE FUNCTION public.cleaning_settings_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
BEGIN
  IF v_uid IS NOT NULL THEN
    NEW.updated_by := v_uid;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.cleaning_settings_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS cleaning_settings_guard ON public.cleaning_settings;
CREATE TRIGGER cleaning_settings_guard BEFORE INSERT OR UPDATE ON public.cleaning_settings
  FOR EACH ROW EXECUTE FUNCTION public.cleaning_settings_guard();

-- =====================================================================
-- 2. Row Level Security: everyone signed in reads, only super_admin writes, nobody deletes
-- =====================================================================
ALTER TABLE public.cleaning_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cleaning settings: signed-in read" ON public.cleaning_settings;
CREATE POLICY "cleaning settings: signed-in read" ON public.cleaning_settings FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "cleaning settings: super_admin create" ON public.cleaning_settings;
CREATE POLICY "cleaning settings: super_admin create" ON public.cleaning_settings FOR INSERT TO authenticated
  WITH CHECK (public.current_role_is('super_admin'));

DROP POLICY IF EXISTS "cleaning settings: super_admin update" ON public.cleaning_settings;
CREATE POLICY "cleaning settings: super_admin update" ON public.cleaning_settings FOR UPDATE TO authenticated
  USING (public.current_role_is('super_admin'))
  WITH CHECK (public.current_role_is('super_admin'));

-- =====================================================================
-- 3. confirm_cleaning(): the current definition (facility_02_cleaning.sql) plus ONE step, right after the
--    off-day check: a day before check_start or after check_end is refused. No row, or an empty date, changes
--    nothing. Signature, SECURITY DEFINER, search_path and grants are the same as before.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.confirm_cleaning(p_classroom UUID, p_day DATE, p_photos TEXT[])
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_today DATE := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_photos TEXT[] := COALESCE(p_photos, '{}');
  v_path TEXT;
  v_id UUID;
  v_name TEXT;
  v_start DATE;
  v_end DATE;
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
    RAISE EXCEPTION 'วันที่เลือกเป็นวันหยุดหรือปิดเรียน ไม่ต้องยืนยัน' USING ERRCODE = 'P0001';
  END IF;

  -- The check window (cleaning_03.sql): no row or an empty date means no limit on that side.
  SELECT s.check_start, s.check_end INTO v_start, v_end FROM public.cleaning_settings s;
  IF v_start IS NOT NULL AND p_day < v_start THEN
    RAISE EXCEPTION 'ยังไม่ถึงวันเริ่มเช็กเขตทำความสะอาด' USING ERRCODE = 'P0001';
  END IF;
  IF v_end IS NOT NULL AND p_day > v_end THEN
    RAISE EXCEPTION 'สิ้นสุดช่วงเช็กเขตทำความสะอาดแล้ว' USING ERRCODE = 'P0001';
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

  -- The caller's name, read here (SECURITY DEFINER) so advisors never need access to profiles.
  SELECT p.full_name INTO v_name FROM public.profiles p WHERE p.id = v_uid;

  INSERT INTO public.cleaning_confirmations (classroom_id, day, confirmed_by, confirmed_by_name, is_late, photo_paths)
  VALUES (p_classroom, p_day, v_uid, v_name, p_day < v_today, v_photos)
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
-- 4. ชุดตรวจสอบ (CHECK BLOCK) — ทั้งหมดเป็นคอมเมนต์ ไม่ถูกรันพร้อมไฟล์
-- =====================================================================
-- วิธีใช้:
--   1) รันไฟล์นี้ให้เสร็จก่อน (ขึ้น Success)
--   2) แก้อีเมล 3 แบบนี้ให้เป็นบัญชีที่มีอยู่จริง คนละคนกัน (ใช้ Find & Replace ในหน้าจอได้):
--        ครูทดสอบ@lrp.ac.th      = ครูที่จะเป็นครูที่ปรึกษาของห้องทดสอบ (บัญชีครูธรรมดา)
--        ผู้ดูแลทดสอบ@lrp.ac.th   = บัญชี super_admin (ใช้ในชุด B)
--        หัวหน้าทดสอบ@lrp.ac.th  = บัญชีที่จะถูกตั้งเป็น head ชั่วคราวในชุด C (ต้องไม่ใช่ super_admin)
--      ดูอีเมลที่มีอยู่จริงได้ด้วย:  select email, role from public.profiles order by email;
--   3) คัดลอกทีละชุด (ทุกบรรทัดใต้หัวข้อชุด) ไปวางใน SQL Editor หน้าใหม่
--      ลบเครื่องหมาย "-- " หน้าบรรทัดออก (เลือกข้อความแล้วกด Ctrl+/ หรือ Cmd+/) แล้วกด Run
--   4) **ทุกชุดจบด้วยข้อความ ERROR เสมอ — ตั้งใจให้เป็นแบบนั้น** เพราะ error ทำให้ระบบยกเลิก
--      ทุกอย่างที่ชุดนั้นทำ (ห้องทดสอบ ครูที่ปรึกษา บทบาท head ชั่วคราว การยืนยันทดสอบ และการล้างค่าช่วงวันที่ที่ตั้งไว้จริง)
--      จึงไม่มีอะไรค้างในระบบ ค่าช่วงวันที่ที่ตั้งไว้จริงไม่เสียหาย ให้เทียบข้อความหลังคำว่า ERROR กับ "ผลที่ควรได้" ของชุดนั้น
--      - ชุดที่ทดสอบว่าระบบต้องปฏิเสธ: ผลทดสอบแสดงข้อความปฏิเสธของระบบ
--      - ชุดที่ทดสอบว่าทำได้: ข้อความขึ้นต้นด้วย "ผลทดสอบ:" ตามด้วยค่าที่วัดได้
--   5) ถ้าชุด D-G ขึ้น "คุณไม่ได้เป็นครูที่ปรึกษาของห้องนี้" ให้ตรวจว่าอีเมลที่แก้ตรงกับบัญชีจริงทุกตัวอักษร
--      ถ้าขึ้นข้อความเรื่องวันหยุด แปลว่าวันทดสอบ (วันจันทร์-ศุกร์ล่าสุด) ถูกตั้งเป็นวันหยุดไว้ ให้รันใหม่ในวันเรียนปกติ
--
-- ========== ชุด A: โครงสร้าง (RLS เปิด นโยบาย สิทธิ์ ตรีกเกอร์) ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: rls_on=true, policies=3, delete_policy=0, authenticated_privileges=INSERT,SELECT,UPDATE, anon_privileges=ไม่มี, service_role_privileges=SELECT, triggers=2, rows=ตามจริง
-- do $$ begin raise exception 'ผลทดสอบ: rls_on=%, policies=%, delete_policy=%, authenticated_privileges=%, anon_privileges=%, service_role_privileges=%, triggers=%, rows=%',
--   (select relrowsecurity from pg_class where oid = 'public.cleaning_settings'::regclass),
--   (select count(*) from pg_policies where schemaname = 'public' and tablename = 'cleaning_settings'),
--   (select count(*) from pg_policies where schemaname = 'public' and tablename = 'cleaning_settings' and cmd in ('DELETE', 'ALL')),
--   (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'cleaning_settings' and grantee = 'authenticated'),
--   coalesce((select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'cleaning_settings' and grantee = 'anon'), 'ไม่มี'),
--   (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'cleaning_settings' and grantee = 'service_role'),
--   (select count(*) from pg_trigger where tgrelid = 'public.cleaning_settings'::regclass and not tgisinternal),
--   (select count(*) from public.cleaning_settings); end $$;
--
-- ========== ชุด B: super_admin ตั้งช่วงวันที่ได้ และลบแถวไม่ได้ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: rows=1, check_end_after_update=ตรงกับวันนี้+60, updated_by_is_caller=true, delete=ถูกปฏิเสธ
-- delete from public.cleaning_settings;
-- select set_config('test.today', ((now() at time zone 'Asia/Bangkok')::date)::text, true);
-- select set_config('test.admin', (select id::text from public.profiles where email = 'ผู้ดูแลทดสอบ@lrp.ac.th'), true);
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.admin'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- insert into public.cleaning_settings (check_start, check_end) values (current_setting('test.today')::date, current_setting('test.today')::date + 30);
-- update public.cleaning_settings set check_end = current_setting('test.today')::date + 60;
-- do $$ declare r_del text := 'ไม่ถูกปฏิเสธ'; begin
--   begin delete from public.cleaning_settings; exception when others then r_del := 'ถูกปฏิเสธ'; end;
--   raise exception 'ผลทดสอบ: rows=%, check_end_after_update=%, updated_by_is_caller=%, delete=%',
--     (select count(*) from public.cleaning_settings),
--     (select check_end = current_setting('test.today')::date + 60 from public.cleaning_settings),
--     (select updated_by = current_setting('test.admin')::uuid from public.cleaning_settings), r_del; end $$;
--
-- ========== ชุด C: เจ้าหน้าที่/หัวหน้า (ไม่ใช่ super_admin) ตั้งช่วงวันที่ไม่ได้ แต่อ่านได้ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: insert=ถูกปฏิเสธ, update_rows=0, still_old_value=true, can_read=1
-- delete from public.cleaning_settings;
-- select set_config('test.today', ((now() at time zone 'Asia/Bangkok')::date)::text, true);
-- update public.profiles set role = 'head' where email = 'หัวหน้าทดสอบ@lrp.ac.th';
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'หัวหน้าทดสอบ@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare r_ins text := 'ไม่ถูกปฏิเสธ'; begin
--   begin insert into public.cleaning_settings (check_start) values (current_setting('test.today')::date);
--   exception when others then r_ins := 'ถูกปฏิเสธ'; end;
--   perform set_config('test.ins', r_ins, true); end $$;
-- reset role;
-- insert into public.cleaning_settings (check_start) values (current_setting('test.today')::date);
-- set local role authenticated;
-- do $$ declare n int; begin
--   update public.cleaning_settings set check_start = current_setting('test.today')::date + 5;
--   get diagnostics n = row_count;
--   raise exception 'ผลทดสอบ: insert=%, update_rows=%, still_old_value=%, can_read=%', current_setting('test.ins'), n,
--     (select check_start = current_setting('test.today')::date from public.cleaning_settings),
--     (select count(*) from public.cleaning_settings); end $$;
--
-- ========== ชุด D: ยืนยันก่อนวันเริ่มเช็ก ถูกปฏิเสธ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: result=ยังไม่ถึงวันเริ่มเช็กเขตทำความสะอาด, confirmations=0
-- insert into public.classrooms (term, name, zone) values ('9999/9', 'ห้องทดสอบ', 'เขตทดสอบ');
-- insert into public.classroom_advisors (classroom_id, user_id)
--   select c.id, p.id from public.classrooms c, public.profiles p
--   where c.term = '9999/9' and c.name = 'ห้องทดสอบ' and p.email = 'ครูทดสอบ@lrp.ac.th';
-- select set_config('test.classroom', (select id::text from public.classrooms where term = '9999/9' and name = 'ห้องทดสอบ'), true);
-- select set_config('test.day', (select (d - case extract(isodow from d)::int when 6 then 1 when 7 then 2 else 0 end)::text
--   from (select (now() at time zone 'Asia/Bangkok')::date as d) t), true);
-- delete from public.cleaning_settings;
-- insert into public.cleaning_settings (check_start) values (current_setting('test.day')::date + 1);
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare r text := 'ไม่ถูกปฏิเสธ'; begin
--   begin perform public.confirm_cleaning(current_setting('test.classroom')::uuid, current_setting('test.day')::date, '{}');
--   exception when sqlstate 'P0001' then r := sqlerrm; end;
--   raise exception 'ผลทดสอบ: result=%, confirmations=%', r,
--     (select count(*) from public.cleaning_confirmations where classroom_id = current_setting('test.classroom')::uuid); end $$;
--
-- ========== ชุด E: ยืนยันหลังวันสิ้นสุด ถูกปฏิเสธ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: result=สิ้นสุดช่วงเช็กเขตทำความสะอาดแล้ว, confirmations=0
-- insert into public.classrooms (term, name, zone) values ('9999/9', 'ห้องทดสอบ', 'เขตทดสอบ');
-- insert into public.classroom_advisors (classroom_id, user_id)
--   select c.id, p.id from public.classrooms c, public.profiles p
--   where c.term = '9999/9' and c.name = 'ห้องทดสอบ' and p.email = 'ครูทดสอบ@lrp.ac.th';
-- select set_config('test.classroom', (select id::text from public.classrooms where term = '9999/9' and name = 'ห้องทดสอบ'), true);
-- select set_config('test.day', (select (d - case extract(isodow from d)::int when 6 then 1 when 7 then 2 else 0 end)::text
--   from (select (now() at time zone 'Asia/Bangkok')::date as d) t), true);
-- delete from public.cleaning_settings;
-- insert into public.cleaning_settings (check_end) values (current_setting('test.day')::date - 1);
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare r text := 'ไม่ถูกปฏิเสธ'; begin
--   begin perform public.confirm_cleaning(current_setting('test.classroom')::uuid, current_setting('test.day')::date, '{}');
--   exception when sqlstate 'P0001' then r := sqlerrm; end;
--   raise exception 'ผลทดสอบ: result=%, confirmations=%', r,
--     (select count(*) from public.cleaning_confirmations where classroom_id = current_setting('test.classroom')::uuid); end $$;
--
-- ========== ชุด F: ยืนยันในช่วง (รวมวันแรกและวันสุดท้าย) ทำได้ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: result=confirmed, confirmations=1
-- insert into public.classrooms (term, name, zone) values ('9999/9', 'ห้องทดสอบ', 'เขตทดสอบ');
-- insert into public.classroom_advisors (classroom_id, user_id)
--   select c.id, p.id from public.classrooms c, public.profiles p
--   where c.term = '9999/9' and c.name = 'ห้องทดสอบ' and p.email = 'ครูทดสอบ@lrp.ac.th';
-- select set_config('test.classroom', (select id::text from public.classrooms where term = '9999/9' and name = 'ห้องทดสอบ'), true);
-- select set_config('test.day', (select (d - case extract(isodow from d)::int when 6 then 1 when 7 then 2 else 0 end)::text
--   from (select (now() at time zone 'Asia/Bangkok')::date as d) t), true);
-- delete from public.cleaning_settings;
-- insert into public.cleaning_settings (check_start, check_end) values (current_setting('test.day')::date, current_setting('test.day')::date);
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare r text; begin
--   r := public.confirm_cleaning(current_setting('test.classroom')::uuid, current_setting('test.day')::date, '{}');
--   raise exception 'ผลทดสอบ: result=%, confirmations=%', r,
--     (select count(*) from public.cleaning_confirmations where classroom_id = current_setting('test.classroom')::uuid); end $$;
--
-- ========== ชุด G: ไม่มีแถว หรือแถวที่วันที่ว่างทั้งคู่ = ทำงานเหมือนเดิม (เช็กทุกวันทำการ) ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: no_row=confirmed, both_empty=confirmed
-- insert into public.classrooms (term, name, zone) values ('9999/9', 'ห้องทดสอบ', 'เขตทดสอบ');
-- insert into public.classroom_advisors (classroom_id, user_id)
--   select c.id, p.id from public.classrooms c, public.profiles p
--   where c.term = '9999/9' and c.name = 'ห้องทดสอบ' and p.email = 'ครูทดสอบ@lrp.ac.th';
-- select set_config('test.classroom', (select id::text from public.classrooms where term = '9999/9' and name = 'ห้องทดสอบ'), true);
-- select set_config('test.day', (select (d - case extract(isodow from d)::int when 6 then 1 when 7 then 2 else 0 end)::text
--   from (select (now() at time zone 'Asia/Bangkok')::date as d) t), true);
-- delete from public.cleaning_settings;
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- select set_config('test.r1', public.confirm_cleaning(current_setting('test.classroom')::uuid, current_setting('test.day')::date, '{}'), true);
-- reset role;
-- delete from public.cleaning_confirmations where classroom_id = current_setting('test.classroom')::uuid;
-- insert into public.cleaning_settings (check_start, check_end) values (null, null);
-- set local role authenticated;
-- do $$ begin raise exception 'ผลทดสอบ: no_row=%, both_empty=%', current_setting('test.r1'),
--   public.confirm_cleaning(current_setting('test.classroom')::uuid, current_setting('test.day')::date, '{}'); end $$;
--
-- ========== ชุด H: วันสิ้นสุดก่อนวันเริ่ม ถูกปฏิเสธโดยข้อกำหนดของตาราง (วันเดียวกันได้) ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: end_before_start=ถูกปฏิเสธ, same_day=ได้
-- delete from public.cleaning_settings;
-- do $$ declare r1 text := 'ไม่ถูกปฏิเสธ'; r2 text := 'ไม่ได้'; begin
--   begin insert into public.cleaning_settings (check_start, check_end) values ('2030-01-10', '2030-01-09');
--   exception when check_violation then r1 := 'ถูกปฏิเสธ'; end;
--   begin insert into public.cleaning_settings (check_start, check_end) values ('2030-01-10', '2030-01-10'); r2 := 'ได้';
--   exception when others then r2 := sqlerrm; end;
--   raise exception 'ผลทดสอบ: end_before_start=%, same_day=%', r1, r2; end $$;
--
-- ========== ชุด I: anon อ่านหรือเขียนไม่ได้ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: anon_read=ถูกปฏิเสธ, anon_insert=ถูกปฏิเสธ
-- set local role anon;
-- do $$ declare r1 text := 'ไม่ถูกปฏิเสธ'; r2 text := 'ไม่ถูกปฏิเสธ'; begin
--   begin perform count(*) from public.cleaning_settings; exception when insufficient_privilege then r1 := 'ถูกปฏิเสธ'; end;
--   begin insert into public.cleaning_settings (check_start) values ('2030-01-10'); exception when insufficient_privilege then r2 := 'ถูกปฏิเสธ'; end;
--   raise exception 'ผลทดสอบ: anon_read=%, anon_insert=%', r1, r2; end $$;
