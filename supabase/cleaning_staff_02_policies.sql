-- Role "cleaning_staff" (เจ้าหน้าที่เขตทำความสะอาด), part 02 of 02: what the role may do.
-- Run AFTER cleaning_staff_01_role.sql, as a separate run, and after cleaning_02.sql / cleaning_03.sql.
-- Everything here only adds policies; nothing existing is dropped or narrowed. Safe to run again
-- (DROP POLICY IF EXISTS before each CREATE POLICY). The whole file runs as one transaction in the
-- SQL editor: if any statement fails, none applies.
--
-- วิธีรัน: รัน cleaning_staff_01_role.sql ให้เสร็จก่อน แล้ววางไฟล์นี้ทั้งไฟล์ใน SQL Editor กด Run
-- ส่วน "ชุดตรวจสอบ" ท้ายไฟล์เป็นคอมเมนต์ทั้งหมด ไม่ถูกรันไปด้วย ให้คัดลอกไปรันทีละชุดภายหลัง
--
-- What the role is: the manager of the cleaning-zone module, and nothing else extra.
--   Can  : manage classrooms, zones, advisors and off days; read every confirmation, cancellation and photo.
--   Cannot: set the check window (cleaning_settings stays super_admin only); see repair tickets, memos,
--           census rosters or control projects beyond what an ordinary signed-in user sees.
-- It is deliberately NOT added to current_role_is('staff', ...): every other staff policy stays closed to it.
-- confirm_cleaning() / cancel_cleaning() need no change: they check the classroom_advisors row, not the role.

-- 0. Stop early with a clear message if an earlier file has not been run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'user_role' AND e.enumlabel = 'cleaning_staff'
  ) THEN
    RAISE EXCEPTION 'ยังไม่ได้รันไฟล์ cleaning_staff_01_role.sql — รันไฟล์นั้นแยกก่อน แล้วค่อยรันไฟล์นี้';
  END IF;
  IF to_regclass('public.classrooms') IS NULL
     OR to_regclass('public.classroom_advisors') IS NULL
     OR to_regclass('public.school_off_days') IS NULL
     OR to_regclass('public.cleaning_confirmations') IS NULL THEN
    RAISE EXCEPTION 'ยังไม่ได้รันไฟล์ facility_02_cleaning.sql — รันไฟล์นั้นก่อน';
  END IF;
  IF to_regclass('public.cleaning_cancellations') IS NULL THEN
    RAISE EXCEPTION 'ยังไม่ได้รันไฟล์ cleaning_02.sql — รันไฟล์นั้นก่อน';
  END IF;
END $$;

-- =====================================================================
-- 1. Cleaning tables: manage the setup, read the records
-- =====================================================================
DROP POLICY IF EXISTS "classrooms: cleaning staff manage" ON public.classrooms;
CREATE POLICY "classrooms: cleaning staff manage" ON public.classrooms FOR ALL TO authenticated
  USING (public.current_role_is('cleaning_staff'))
  WITH CHECK (public.current_role_is('cleaning_staff'));

DROP POLICY IF EXISTS "classroom advisors: cleaning staff manage" ON public.classroom_advisors;
CREATE POLICY "classroom advisors: cleaning staff manage" ON public.classroom_advisors FOR ALL TO authenticated
  USING (public.current_role_is('cleaning_staff'))
  WITH CHECK (public.current_role_is('cleaning_staff'));

DROP POLICY IF EXISTS "off days: cleaning staff manage" ON public.school_off_days;
CREATE POLICY "off days: cleaning staff manage" ON public.school_off_days FOR ALL TO authenticated
  USING (public.current_role_is('cleaning_staff'))
  WITH CHECK (public.current_role_is('cleaning_staff'));

-- Read only: confirmations and cancellations are written by confirm_cleaning() / cancel_cleaning() alone.
DROP POLICY IF EXISTS "cleaning confirmations: cleaning staff read" ON public.cleaning_confirmations;
CREATE POLICY "cleaning confirmations: cleaning staff read" ON public.cleaning_confirmations FOR SELECT TO authenticated
  USING (public.current_role_is('cleaning_staff'));

DROP POLICY IF EXISTS "cleaning cancellations: cleaning staff read" ON public.cleaning_cancellations;
CREATE POLICY "cleaning cancellations: cleaning staff read" ON public.cleaning_cancellations FOR SELECT TO authenticated
  USING (public.current_role_is('cleaning_staff'));

-- =====================================================================
-- 2. Photos: read every confirmation photo (upload/delete rules are unchanged)
-- =====================================================================
DROP POLICY IF EXISTS "cleaning photos: cleaning staff read" ON storage.objects;
CREATE POLICY "cleaning photos: cleaning staff read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cleaning-photos' AND public.current_role_is('cleaning_staff'));

-- =====================================================================
-- 3. Profiles: look up advisors by email, never the executives
-- =====================================================================
-- The manage page finds a teacher by email and lists active teachers to pick from. Executives stay hidden
-- (an advisor row opens a class roster, which executives must not see), so an executive's email there reads
-- "ไม่พบบัญชี" instead of "เป็นผู้บริหาร". Closed accounts stay visible so the "ถูกปิดใช้งาน" message still works.
DROP POLICY IF EXISTS "profiles: cleaning staff read non-executives" ON public.profiles;
CREATE POLICY "profiles: cleaning staff read non-executives" ON public.profiles FOR SELECT TO authenticated
  USING (public.current_role_is('cleaning_staff') AND role <> 'executive'::public.user_role);

-- =====================================================================
-- 4. ชุดตรวจสอบ (CHECK BLOCK) — ทั้งหมดเป็นคอมเมนต์ ไม่ถูกรันพร้อมไฟล์
-- =====================================================================
-- วิธีใช้:
--   1) รันไฟล์นี้ให้เสร็จก่อน (ขึ้น Success)
--   2) แก้อีเมล 2 แบบนี้ให้เป็นบัญชีที่มีอยู่จริง คนละคนกัน (ใช้ Find & Replace ในหน้าจอได้):
--        เจ้าหน้าที่ทดสอบ@lrp.ac.th = บัญชีที่จะถูกตั้งเป็น cleaning_staff ชั่วคราว (ต้องไม่ใช่ super_admin และไม่ใช่ตัวคุณ)
--        ผู้บริหารทดสอบ@lrp.ac.th    = บัญชีที่มีบทบาท executive อยู่แล้ว (ใช้ในชุด C)
--      ดูอีเมลที่มีอยู่จริงได้ด้วย:  select email, role from public.profiles order by email;
--   3) ชุด 1 เป็นคำสั่ง select ธรรมดา ผลขึ้นเป็นตาราง
--      ชุด A-D คัดลอกทีละชุด เฉพาะบรรทัดคำสั่ง (ข้ามบรรทัดหัวข้อ "========== ชุด" และบรรทัด "ผลที่ควรได้")
--      ไปวางใน SQL Editor หน้าใหม่ ลบเครื่องหมาย "-- " หน้าบรรทัดออก (เลือกข้อความแล้วกด Ctrl+/ หรือ Cmd+/) แล้วกด Run
--   4) **ชุด A-D จบด้วยข้อความ ERROR เสมอ — ตั้งใจให้เป็นแบบนั้น** เพราะ error ทำให้ระบบยกเลิก (ROLLBACK)
--      ทุกอย่างที่ชุดนั้นทำ (ห้องทดสอบ บทบาทชั่วคราว) จึงไม่มีอะไรค้างในระบบ
--      ข้อความขึ้นต้นด้วย "ผลทดสอบ:" ตามด้วยค่าที่วัดได้ ให้เทียบข้อความหลังคำว่า ERROR กับ "ผลที่ควรได้" ของชุดนั้น
--   5) ถ้าขึ้น "invalid input syntax for type uuid" แปลว่าอีเมลที่แก้ไม่ตรงกับบัญชีจริงทุกตัวอักษร
--   (ถ้าข้ามบรรทัด set local role ไป ชุดจะรันเป็นผู้ดูแลฐานข้อมูลซึ่งไม่ถูกจำกัดสิทธิ์ ผลจะผิด)
--
-- ========== ชุด 1: policy ของ cleaning_staff ครบ 8 ตัว ==========
-- ผลที่ควรได้: 8 แถว — classrooms, classroom_advisors, school_off_days (cmd ALL) / cleaning_confirmations,
--   cleaning_cancellations, profiles (cmd SELECT) / objects (cmd SELECT) — และต้องไม่มีแถวของ cleaning_settings
-- select tablename, policyname, cmd from pg_policies
--   where policyname like '%cleaning staff%' order by tablename, policyname;
--
-- ========== ชุด A: จัดการห้อง เขต ครูที่ปรึกษา วันหยุดได้ และอ่านรายงานการยืนยันได้ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: room_rows=1, advisor_rows=1, off_day_rows=1, confirmations_seen=1
-- update public.profiles set role = 'cleaning_staff' where email = 'เจ้าหน้าที่ทดสอบ@lrp.ac.th';
-- insert into public.classrooms (term, name, zone) values ('9999/9', 'ห้องทดสอบ', 'เขตทดสอบ');
-- insert into public.cleaning_confirmations (classroom_id, day, confirmed_by_name, is_late)
--   select id, current_date, 'ทดสอบ', false from public.classrooms where term = '9999/9' and name = 'ห้องทดสอบ';
-- select set_config('test.room', (select id::text from public.classrooms where term = '9999/9' and name = 'ห้องทดสอบ'), true);
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'เจ้าหน้าที่ทดสอบ@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare r int; a int; o int; begin
--   update public.classrooms set zone = 'เขตทดสอบ 2' where id = current_setting('test.room')::uuid;
--   get diagnostics r = row_count;
--   insert into public.classroom_advisors (classroom_id, user_id) values (current_setting('test.room')::uuid, (select auth.uid()));
--   get diagnostics a = row_count;
--   insert into public.school_off_days (day, reason) values ('2099-01-01', 'ทดสอบ');
--   get diagnostics o = row_count;
--   raise exception 'ผลทดสอบ: room_rows=%, advisor_rows=%, off_day_rows=%, confirmations_seen=%', r, a, o,
--     (select count(*) from public.cleaning_confirmations where classroom_id = current_setting('test.room')::uuid); end $$;
--
-- ========== ชุด B: ไม่ได้สิทธิ์งานอื่นของ staff และตั้งช่วงวันที่เช็กไม่ได้ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: others_tickets=0, memos_seen=0, census_seen=0, is_staff=f, settings_insert_blocked=t
-- update public.profiles set role = 'cleaning_staff' where email = 'เจ้าหน้าที่ทดสอบ@lrp.ac.th';
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'เจ้าหน้าที่ทดสอบ@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare blocked boolean := false; begin
--   begin
--     insert into public.cleaning_settings (check_start) values ('2099-01-01');
--   exception when others then blocked := true; end;
--   raise exception 'ผลทดสอบ: others_tickets=%, memos_seen=%, census_seen=%, is_staff=%, settings_insert_blocked=%',
--     (select count(*) from public.repair_tickets where reporter_id <> (select auth.uid())),
--     (select count(*) from public.memorandums),
--     (select count(*) from public.census_students),
--     public.current_role_is('staff'), blocked; end $$;
--
-- ========== ชุด C: ค้นบัญชีครูได้ แต่ไม่เห็นผู้บริหาร ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: executive_seen=0, others_seen=จำนวนบัญชีที่ไม่ใช่ผู้บริหาร (มากกว่า 0)
-- update public.profiles set role = 'cleaning_staff' where email = 'เจ้าหน้าที่ทดสอบ@lrp.ac.th';
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'เจ้าหน้าที่ทดสอบ@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ begin raise exception 'ผลทดสอบ: executive_seen=%, others_seen=%',
--   (select count(*) from public.profiles where email = 'ผู้บริหารทดสอบ@lrp.ac.th'),
--   (select count(*) from public.profiles where role <> 'executive'); end $$;
--
-- ========== ชุด D: บัญชีที่ปิดแล้วเสียสิทธิ์ทันที ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: rooms_seen_when_closed=0
-- update public.profiles set role = 'cleaning_staff', is_active = false where email = 'เจ้าหน้าที่ทดสอบ@lrp.ac.th';
-- insert into public.classrooms (term, name, zone) values ('9999/9', 'ห้องทดสอบ', 'เขตทดสอบ');
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'เจ้าหน้าที่ทดสอบ@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ begin raise exception 'ผลทดสอบ: rooms_seen_when_closed=%', (select count(*) from public.classrooms where term = '9999/9'); end $$;
