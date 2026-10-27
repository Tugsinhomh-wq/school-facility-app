-- Cleaning module, part 02: undo a cleaning confirmation (ยกเลิกการยืนยัน). Run AFTER facility_02_cleaning.sql.
-- Everything here only adds; nothing existing is dropped or narrowed. Safe to run again
-- (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS before each CREATE POLICY).
-- The whole file runs as one transaction in the SQL editor: if any statement fails, none applies.
--
-- วิธีรัน: วางไฟล์นี้ทั้งไฟล์ใน SQL Editor กด Run ส่วน "ชุดตรวจสอบ" ท้ายไฟล์เป็นคอมเมนต์ทั้งหมด ไม่ถูกรันไปด้วย ให้คัดลอกไปรันทีละชุดภายหลัง
-- ต้องรันไฟล์นี้ก่อน deploy โค้ดที่สำรองข้อมูล (src/lib/backup.ts) ไม่งั้นการสำรองคืนถัดไปจะ error เพราะหาตาราง cleaning_cancellations ไม่เจอ
-- (และปุ่ม "ยกเลิกการยืนยัน" จะขึ้นข้อความว่าระบบยังไม่พร้อมจนกว่าจะรัน)
--
-- Who may do what:
--   Only the room's own advisor can cancel, through cancel_cleaning(). Officers (staff, head, super_admin) and
--   executives deliberately cannot: a cancellation is the teacher undoing their own mistake (a wrong tap, a wrong
--   photo), and an officer who could erase a confirmation could also erase the record that a room was cleaned.
--   Only today and yesterday (Bangkok calendar) can be cancelled; older days stay as they were.
--   The confirmation row is deleted so the teacher can confirm the day again. History is kept in
--   cleaning_cancellations (who cancelled, when, who had confirmed it and when, how many photos); officers and the
--   room's advisors can read it, nobody can write it except cancel_cleaning() (there is no insert/update/delete policy).
--   The function returns the deleted row's photo paths; the app removes those files from the storage bucket.

-- 0. Stop early with a clear message if facility_02_cleaning.sql has not been run.
DO $$
BEGIN
  IF to_regclass('public.cleaning_confirmations') IS NULL
     OR to_regclass('public.classroom_advisors') IS NULL
     OR to_regclass('public.classrooms') IS NULL
     OR to_regprocedure('public.confirm_cleaning(uuid, date, text[])') IS NULL THEN
    RAISE EXCEPTION 'ยังไม่ได้รันไฟล์ facility_02_cleaning.sql — รันไฟล์นั้นก่อน แล้วค่อยรันไฟล์นี้';
  END IF;
END $$;

-- =====================================================================
-- 1. Table: the cancellation history
--    cancelled_by is kept as history: deleting the teacher's account clears it instead of blocking.
--    The names are copied at cancel time (same reason as confirmed_by_name: a co-advisor reads them
--    without being allowed to read other teachers' profiles).
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.cleaning_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_by_name TEXT NOT NULL,
  cancelled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  original_confirmed_by_name TEXT NOT NULL,
  original_confirmed_at TIMESTAMPTZ NOT NULL,
  photo_count INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS cleaning_cancellations_room_day_idx ON public.cleaning_cancellations (classroom_id, day);

-- Read only for the app roles; service_role reads it for the nightly backup (src/lib/backup.ts).
REVOKE ALL ON public.cleaning_cancellations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.cleaning_cancellations TO authenticated, service_role;

-- =====================================================================
-- 2. Row Level Security: same read rule as cleaning_confirmations, no write policy at all
-- =====================================================================
ALTER TABLE public.cleaning_cancellations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cleaning cancellations: officers or advisors read" ON public.cleaning_cancellations;
CREATE POLICY "cleaning cancellations: officers or advisors read" ON public.cleaning_cancellations FOR SELECT TO authenticated
  USING (public.current_role_is('staff', 'super_admin') OR EXISTS (
    SELECT 1 FROM public.classroom_advisors a
    WHERE a.classroom_id = cleaning_cancellations.classroom_id AND a.user_id = (SELECT auth.uid())));

-- =====================================================================
-- 3. cancel_cleaning(): the only way to remove a confirmation
-- =====================================================================
-- Returns the deleted confirmation's photo paths (possibly empty) so the app can delete the files.
-- Two presses at the same moment: the second DELETE waits for the first, finds no row and raises
-- 'ไม่พบการยืนยันของวันนั้น' (a friendly message, nothing is written twice).
-- "Today" is the Bangkok calendar day, as in confirm_cleaning().
CREATE OR REPLACE FUNCTION public.cancel_cleaning(p_classroom UUID, p_day DATE)
RETURNS TEXT[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
  v_today DATE := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  v_row public.cleaning_confirmations%ROWTYPE;
  v_name TEXT;
BEGIN
  -- Same message whether the class does not exist, is inactive or belongs to someone else,
  -- so guessing ids reveals nothing. Officers who are not this room's advisor land here too.
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.classroom_advisors a
    JOIN public.classrooms c ON c.id = a.classroom_id
    WHERE a.classroom_id = p_classroom AND a.user_id = v_uid AND c.is_active
  ) THEN
    RAISE EXCEPTION 'คุณไม่ได้เป็นครูที่ปรึกษาของห้องนี้' USING ERRCODE = 'P0001';
  END IF;

  IF p_day IS NULL OR p_day NOT IN (v_today, v_today - 1) THEN
    RAISE EXCEPTION 'ยกเลิกได้เฉพาะวันนี้และเมื่อวาน' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.cleaning_confirmations
   WHERE classroom_id = p_classroom AND day = p_day
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ไม่พบการยืนยันของวันนั้น' USING ERRCODE = 'P0001';
  END IF;

  -- The caller's name, read here (SECURITY DEFINER) exactly as confirm_cleaning() does.
  SELECT p.full_name INTO v_name FROM public.profiles p WHERE p.id = v_uid;

  INSERT INTO public.cleaning_cancellations
    (classroom_id, day, cancelled_by, cancelled_by_name, original_confirmed_by_name, original_confirmed_at, photo_count)
  VALUES
    (p_classroom, p_day, v_uid, v_name, v_row.confirmed_by_name, v_row.confirmed_at, cardinality(v_row.photo_paths));

  RETURN v_row.photo_paths;
END $$;

REVOKE EXECUTE ON FUNCTION public.cancel_cleaning(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_cleaning(UUID, DATE) TO authenticated;

-- =====================================================================
-- 4. ชุดตรวจสอบ (CHECK BLOCK) — ทั้งหมดเป็นคอมเมนต์ ไม่ถูกรันพร้อมไฟล์
-- =====================================================================
-- วิธีใช้:
--   1) รันไฟล์นี้ให้เสร็จก่อน (ขึ้น Success)
--   2) แก้อีเมล 3 แบบนี้ให้เป็นบัญชีที่มีอยู่จริง คนละคนกัน (ใช้ Find & Replace ในหน้าจอได้):
--        ครูทดสอบ@lrp.ac.th         = ครูที่จะเป็นครูที่ปรึกษาของห้องทดสอบ (บัญชีครูธรรมดา)
--        ครูคนอื่น@lrp.ac.th        = ครูอีกคน ที่ไม่ใช่ครูที่ปรึกษา (บัญชีครูธรรมดา)
--        เจ้าหน้าที่ทดสอบ@lrp.ac.th = บัญชี staff, head หรือ super_admin ที่ไม่ได้เป็นครูที่ปรึกษาของห้องทดสอบ
--      ดูอีเมลที่มีอยู่จริงได้ด้วย:  select email, role from public.profiles order by email;
--   3) ชุด 1 เป็นคำสั่ง select ธรรมดา ผลขึ้นเป็นตาราง
--      ชุด A-H คัดลอกทีละชุด เฉพาะบรรทัดคำสั่ง (ข้ามบรรทัดหัวข้อ "========== ชุด" และบรรทัด "ผลที่ควรได้")
--      ไปวางใน SQL Editor หน้าใหม่ ลบเครื่องหมาย "-- " หน้าบรรทัดออก (เลือกข้อความแล้วกด Ctrl+/ หรือ Cmd+/) แล้วกด Run
--   4) **ชุด A-H จบด้วยข้อความ ERROR เสมอ — ตั้งใจให้เป็นแบบนั้น** เพราะ error ทำให้ระบบยกเลิก (ROLLBACK)
--      ทุกอย่างที่ชุดนั้นทำ (ห้องทดสอบ การยืนยันทดสอบ ประวัติการยกเลิก) จึงไม่มีอะไรค้างในระบบ
--      ข้อความขึ้นต้นด้วย "ผลทดสอบ:" ตามด้วยค่าที่วัดได้ ให้เทียบข้อความหลังคำว่า ERROR กับ "ผลที่ควรได้" ของชุดนั้น
--      (ชุดที่ทดสอบว่าระบบต้องปฏิเสธ: ข้อความ error คือคำปฏิเสธจากระบบเอง)
--   5) ถ้าขึ้น "invalid input syntax for type uuid" แปลว่าอีเมลที่แก้ไม่ตรงกับบัญชีจริงทุกตัวอักษร
--
-- ทุกชุดสร้างห้องทดสอบ 'ห้องทดสอบ' ภาค 9999/9 และใส่การยืนยันทดสอบด้วยการ insert ตรงๆ (รันเป็นผู้ดูแลฐานข้อมูล)
-- แล้วสลับเป็นผู้ใช้จริงด้วย set local role authenticated + request.jwt.claims
-- (ถ้าข้ามบรรทัด set local role ไป ชุดจะรันเป็นผู้ดูแลฐานข้อมูลซึ่งไม่ถูกจำกัดสิทธิ์ ผลจะผิด)
-- วันที่ใช้ตามเวลาไทย (test.today) และไม่เกี่ยวกับวันหยุด จึงรันได้ทุกวัน
--
-- ========== ชุด 1: ตารางเปิด RLS มี policy อ่าน 1 ตัว และไม่มี policy เขียน ==========
-- ผลที่ควรได้: 1 แถว — cleaning_cancellations true 1 0 (คอลัมน์ rowsecurity, read_policies, write_policies)
-- select t.tablename, t.rowsecurity,
--   (select count(*) from pg_policies p where p.schemaname = t.schemaname and p.tablename = t.tablename and p.cmd = 'SELECT') as read_policies,
--   (select count(*) from pg_policies p where p.schemaname = t.schemaname and p.tablename = t.tablename and p.cmd <> 'SELECT') as write_policies
-- from pg_tables t
-- where t.schemaname = 'public' and t.tablename = 'cleaning_cancellations';
--
-- ========== ชุด A: ครูที่ปรึกษายกเลิกการยืนยันของวันนี้ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: returned_paths=2, confirmations_left=0, log_rows=1, log_photo_count=2, log_by_is_caller=true, log_original_name=ผู้ยืนยันเดิม
-- insert into public.classrooms (term, name, zone) values ('9999/9', 'ห้องทดสอบ', 'เขตทดสอบ');
-- insert into public.classroom_advisors (classroom_id, user_id)
--   select c.id, p.id from public.classrooms c, public.profiles p
--   where c.term = '9999/9' and c.name = 'ห้องทดสอบ' and p.email = 'ครูทดสอบ@lrp.ac.th';
-- select set_config('test.classroom', (select id::text from public.classrooms where term = '9999/9' and name = 'ห้องทดสอบ'), true);
-- select set_config('test.today', ((now() at time zone 'Asia/Bangkok')::date)::text, true);
-- select set_config('test.advisor', (select id::text from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), true);
-- insert into public.cleaning_confirmations (classroom_id, day, confirmed_by, confirmed_by_name, is_late, photo_paths)
--   values (current_setting('test.classroom')::uuid, current_setting('test.today')::date, null, 'ผู้ยืนยันเดิม', false, array['x/1.jpg', 'x/2.jpg']);
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.advisor'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- select set_config('test.paths', cardinality(public.cancel_cleaning(current_setting('test.classroom')::uuid, current_setting('test.today')::date))::text, true);
-- do $$ begin raise exception 'ผลทดสอบ: returned_paths=%, confirmations_left=%, log_rows=%, log_photo_count=%, log_by_is_caller=%, log_original_name=%',
--   current_setting('test.paths'),
--   (select count(*) from public.cleaning_confirmations where classroom_id = current_setting('test.classroom')::uuid),
--   (select count(*) from public.cleaning_cancellations where classroom_id = current_setting('test.classroom')::uuid),
--   (select photo_count from public.cleaning_cancellations where classroom_id = current_setting('test.classroom')::uuid),
--   (select cancelled_by = current_setting('test.advisor')::uuid from public.cleaning_cancellations where classroom_id = current_setting('test.classroom')::uuid),
--   (select original_confirmed_by_name from public.cleaning_cancellations where classroom_id = current_setting('test.classroom')::uuid); end $$;
--
-- ========== ชุด B: ครูที่ไม่ใช่ครูที่ปรึกษายกเลิก ==========
-- ผลที่ควรได้: ERROR: คุณไม่ได้เป็นครูที่ปรึกษาของห้องนี้
-- insert into public.classrooms (term, name, zone) values ('9999/9', 'ห้องทดสอบ', 'เขตทดสอบ');
-- insert into public.classroom_advisors (classroom_id, user_id)
--   select c.id, p.id from public.classrooms c, public.profiles p
--   where c.term = '9999/9' and c.name = 'ห้องทดสอบ' and p.email = 'ครูทดสอบ@lrp.ac.th';
-- select set_config('test.classroom', (select id::text from public.classrooms where term = '9999/9' and name = 'ห้องทดสอบ'), true);
-- select set_config('test.today', ((now() at time zone 'Asia/Bangkok')::date)::text, true);
-- insert into public.cleaning_confirmations (classroom_id, day, confirmed_by, confirmed_by_name, is_late, photo_paths)
--   values (current_setting('test.classroom')::uuid, current_setting('test.today')::date, null, 'ผู้ยืนยันเดิม', false, '{}');
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'ครูคนอื่น@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- select public.cancel_cleaning(current_setting('test.classroom')::uuid, current_setting('test.today')::date);
--
-- ========== ชุด C: เจ้าหน้าที่ (staff/head/super_admin) ที่ไม่ใช่ครูที่ปรึกษายกเลิกไม่ได้ ==========
-- ผลที่ควรได้: ERROR: คุณไม่ได้เป็นครูที่ปรึกษาของห้องนี้
-- insert into public.classrooms (term, name, zone) values ('9999/9', 'ห้องทดสอบ', 'เขตทดสอบ');
-- insert into public.classroom_advisors (classroom_id, user_id)
--   select c.id, p.id from public.classrooms c, public.profiles p
--   where c.term = '9999/9' and c.name = 'ห้องทดสอบ' and p.email = 'ครูทดสอบ@lrp.ac.th';
-- select set_config('test.classroom', (select id::text from public.classrooms where term = '9999/9' and name = 'ห้องทดสอบ'), true);
-- select set_config('test.today', ((now() at time zone 'Asia/Bangkok')::date)::text, true);
-- insert into public.cleaning_confirmations (classroom_id, day, confirmed_by, confirmed_by_name, is_late, photo_paths)
--   values (current_setting('test.classroom')::uuid, current_setting('test.today')::date, null, 'ผู้ยืนยันเดิม', false, '{}');
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'เจ้าหน้าที่ทดสอบ@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- select public.cancel_cleaning(current_setting('test.classroom')::uuid, current_setting('test.today')::date);
--
-- ========== ชุด D: ยกเลิกของ 2 วันก่อน และของพรุ่งนี้ไม่ได้ (แม้เป็นครูที่ปรึกษา) ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: two_days_ago=ยกเลิกได้เฉพาะวันนี้และเมื่อวาน, tomorrow=ยกเลิกได้เฉพาะวันนี้และเมื่อวาน, confirmation_still_there=1
-- insert into public.classrooms (term, name, zone) values ('9999/9', 'ห้องทดสอบ', 'เขตทดสอบ');
-- insert into public.classroom_advisors (classroom_id, user_id)
--   select c.id, p.id from public.classrooms c, public.profiles p
--   where c.term = '9999/9' and c.name = 'ห้องทดสอบ' and p.email = 'ครูทดสอบ@lrp.ac.th';
-- select set_config('test.classroom', (select id::text from public.classrooms where term = '9999/9' and name = 'ห้องทดสอบ'), true);
-- select set_config('test.today', ((now() at time zone 'Asia/Bangkok')::date)::text, true);
-- insert into public.cleaning_confirmations (classroom_id, day, confirmed_by, confirmed_by_name, is_late, photo_paths)
--   values (current_setting('test.classroom')::uuid, current_setting('test.today')::date - 2, null, 'ผู้ยืนยันเดิม', true, '{}');
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare r1 text := 'ไม่ถูกปฏิเสธ'; r2 text := 'ไม่ถูกปฏิเสธ'; begin
--   begin perform public.cancel_cleaning(current_setting('test.classroom')::uuid, current_setting('test.today')::date - 2);
--   exception when sqlstate 'P0001' then r1 := sqlerrm; end;
--   begin perform public.cancel_cleaning(current_setting('test.classroom')::uuid, current_setting('test.today')::date + 1);
--   exception when sqlstate 'P0001' then r2 := sqlerrm; end;
--   raise exception 'ผลทดสอบ: two_days_ago=%, tomorrow=%, confirmation_still_there=%', r1, r2,
--     (select count(*) from public.cleaning_confirmations where classroom_id = current_setting('test.classroom')::uuid); end $$;
--
-- ========== ชุด E: กดซ้ำ — ครั้งที่สองถูกปฏิเสธด้วยข้อความที่อ่านรู้เรื่อง และมีประวัติแค่ 1 แถว ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: first_call_paths=0, second_call=ไม่พบการยืนยันของวันนั้น, log_rows=1
-- insert into public.classrooms (term, name, zone) values ('9999/9', 'ห้องทดสอบ', 'เขตทดสอบ');
-- insert into public.classroom_advisors (classroom_id, user_id)
--   select c.id, p.id from public.classrooms c, public.profiles p
--   where c.term = '9999/9' and c.name = 'ห้องทดสอบ' and p.email = 'ครูทดสอบ@lrp.ac.th';
-- select set_config('test.classroom', (select id::text from public.classrooms where term = '9999/9' and name = 'ห้องทดสอบ'), true);
-- select set_config('test.today', ((now() at time zone 'Asia/Bangkok')::date)::text, true);
-- insert into public.cleaning_confirmations (classroom_id, day, confirmed_by, confirmed_by_name, is_late, photo_paths)
--   values (current_setting('test.classroom')::uuid, current_setting('test.today')::date, null, 'ผู้ยืนยันเดิม', false, '{}');
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare r1 int; r2 text := 'ไม่ถูกปฏิเสธ'; begin
--   r1 := cardinality(public.cancel_cleaning(current_setting('test.classroom')::uuid, current_setting('test.today')::date));
--   begin perform public.cancel_cleaning(current_setting('test.classroom')::uuid, current_setting('test.today')::date);
--   exception when sqlstate 'P0001' then r2 := sqlerrm; end;
--   raise exception 'ผลทดสอบ: first_call_paths=%, second_call=%, log_rows=%', r1, r2,
--     (select count(*) from public.cleaning_cancellations where classroom_id = current_setting('test.classroom')::uuid); end $$;
--
-- ========== ชุด F: ยกเลิกของเมื่อวานได้ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: returned_paths=0, confirmations_left=0, log_rows=1, log_day_is_yesterday=true
-- insert into public.classrooms (term, name, zone) values ('9999/9', 'ห้องทดสอบ', 'เขตทดสอบ');
-- insert into public.classroom_advisors (classroom_id, user_id)
--   select c.id, p.id from public.classrooms c, public.profiles p
--   where c.term = '9999/9' and c.name = 'ห้องทดสอบ' and p.email = 'ครูทดสอบ@lrp.ac.th';
-- select set_config('test.classroom', (select id::text from public.classrooms where term = '9999/9' and name = 'ห้องทดสอบ'), true);
-- select set_config('test.today', ((now() at time zone 'Asia/Bangkok')::date)::text, true);
-- insert into public.cleaning_confirmations (classroom_id, day, confirmed_by, confirmed_by_name, is_late, photo_paths)
--   values (current_setting('test.classroom')::uuid, current_setting('test.today')::date - 1, null, 'ผู้ยืนยันเดิม', true, '{}');
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- select set_config('test.paths', cardinality(public.cancel_cleaning(current_setting('test.classroom')::uuid, current_setting('test.today')::date - 1))::text, true);
-- do $$ begin raise exception 'ผลทดสอบ: returned_paths=%, confirmations_left=%, log_rows=%, log_day_is_yesterday=%',
--   current_setting('test.paths'),
--   (select count(*) from public.cleaning_confirmations where classroom_id = current_setting('test.classroom')::uuid),
--   (select count(*) from public.cleaning_cancellations where classroom_id = current_setting('test.classroom')::uuid),
--   (select day = current_setting('test.today')::date - 1 from public.cleaning_cancellations where classroom_id = current_setting('test.classroom')::uuid); end $$;
--
-- ========== ชุด G: anon เรียกไม่ได้ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: anon=ถูกปฏิเสธ
-- set local role anon;
-- do $$ declare r text := 'ไม่ถูกปฏิเสธ'; begin
--   begin
--     perform public.cancel_cleaning(gen_random_uuid(), (now() at time zone 'Asia/Bangkok')::date);
--   exception when insufficient_privilege then r := 'ถูกปฏิเสธ'; end;
--   raise exception 'ผลทดสอบ: anon=%', r; end $$;
--
-- ========== ชุด H: ครูที่ปรึกษาเห็นประวัติของห้องตัวเอง แต่เขียน/ลบตารางประวัติตรงๆ ไม่ได้ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: advisor_sees=1, direct_insert=ถูกปฏิเสธ, direct_delete=ถูกปฏิเสธ, other_teacher_sees=0
-- insert into public.classrooms (term, name, zone) values ('9999/9', 'ห้องทดสอบ', 'เขตทดสอบ');
-- insert into public.classroom_advisors (classroom_id, user_id)
--   select c.id, p.id from public.classrooms c, public.profiles p
--   where c.term = '9999/9' and c.name = 'ห้องทดสอบ' and p.email = 'ครูทดสอบ@lrp.ac.th';
-- select set_config('test.classroom', (select id::text from public.classrooms where term = '9999/9' and name = 'ห้องทดสอบ'), true);
-- select set_config('test.other', (select id::text from public.profiles where email = 'ครูคนอื่น@lrp.ac.th'), true);
-- insert into public.cleaning_cancellations (classroom_id, day, cancelled_by_name, original_confirmed_by_name, original_confirmed_at)
--   values (current_setting('test.classroom')::uuid, (now() at time zone 'Asia/Bangkok')::date, 'ผู้ยกเลิกเดิม', 'ผู้ยืนยันเดิม', now());
-- select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare seen int; r_ins text := 'ไม่ถูกปฏิเสธ'; r_del text := 'ไม่ถูกปฏิเสธ'; other_seen int; begin
--   select count(*) into seen from public.cleaning_cancellations where classroom_id = current_setting('test.classroom')::uuid;
--   begin
--     insert into public.cleaning_cancellations (classroom_id, day, cancelled_by_name, original_confirmed_by_name, original_confirmed_at)
--       values (current_setting('test.classroom')::uuid, (now() at time zone 'Asia/Bangkok')::date, 'x', 'y', now());
--   exception when others then r_ins := 'ถูกปฏิเสธ'; end;
--   begin
--     delete from public.cleaning_cancellations where classroom_id = current_setting('test.classroom')::uuid;
--   exception when others then r_del := 'ถูกปฏิเสธ'; end;
--   perform set_config('request.jwt.claims', json_build_object('sub', current_setting('test.other'), 'role', 'authenticated')::text, true);
--   select count(*) into other_seen from public.cleaning_cancellations where classroom_id = current_setting('test.classroom')::uuid;
--   raise exception 'ผลทดสอบ: advisor_sees=%, direct_insert=%, direct_delete=%, other_teacher_sees=%', seen, r_ins, r_del, other_seen; end $$;
