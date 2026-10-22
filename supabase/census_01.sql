-- Student census module (สำมะโนผู้เรียน), part 01: the class roster, one row per student per term.
-- Run AFTER control_02.sql (and so after the files it lists; it needs facility_02_cleaning.sql for the classes).
-- This module stores ONLY the student ID (exactly 5 digits) and the full name, per term. Nothing else.
-- It deliberately reverses the "No student names or accounts" note on public.classrooms in
-- facility_02_cleaning.sql: that note no longer holds, and the privacy page says so. Students still have no accounts.
-- Everything here only adds; nothing existing is dropped or narrowed. Safe to run again
-- (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS / DROP TRIGGER IF EXISTS).
-- The whole file runs as one transaction in the SQL editor: if any statement fails, none applies.
--
-- วิธีรัน: รันไฟล์ control_02 ให้เสร็จก่อน แล้ววางไฟล์นี้ทั้งไฟล์ใน SQL Editor กด Run
-- ส่วน "ชุดตรวจสอบ" ท้ายไฟล์เป็นคอมเมนต์ทั้งหมด ไม่ถูกรันไปด้วย ให้คัดลอกไปรันทีละชุดภายหลัง
-- ต้องรันไฟล์นี้ก่อน deploy โค้ดที่สำรองข้อมูล (src/lib/backup.ts) ไม่งั้นการสำรองคืนถัดไปจะ error เพราะหาตาราง census_students ไม่เจอ
-- ข้อมูลในตารางนี้เป็นข้อมูลส่วนบุคคลของเด็ก ผู้ดูแลข้อมูลส่วนบุคคลของโรงเรียนควรอนุมัติก่อนนำเข้าข้อมูลจริง
--
-- Who may do what:
--   officers  = public.current_role_is('staff', 'super_admin'), i.e. staff, head and super_admin: read and write every room.
--   advisor   = a teacher listed in classroom_advisors for that room: reads that room's rows only, writes nothing.
--   anyone else (executive, an ordinary user, a teacher who is not that room's advisor) sees and writes nothing.

-- 0. Stop early with a clear message if an earlier file has not been run yet.
DO $$
BEGIN
  IF to_regclass('public.classrooms') IS NULL OR to_regclass('public.classroom_advisors') IS NULL THEN
    RAISE EXCEPTION 'ยังไม่ได้รันไฟล์ facility_02_cleaning.sql — ยังไม่มีตาราง classrooms / classroom_advisors';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = to_regprocedure('public.current_role_is(public.user_role[])')::oid
      AND p.prosrc LIKE '%head%'
  ) THEN
    RAISE EXCEPTION 'ยังไม่ได้รันไฟล์ facility_02_cleaning.sql — ฟังก์ชัน current_role_is ยังไม่รับบทบาท head';
  END IF;
END $$;

-- =====================================================================
-- 1. Table
--    One row per student per term, tied to that term's class. term is copied from the class by the trigger
--    below (never trusted from the client), so (term, student_code) can be unique: a student ID appears once
--    per term. Deleting a class deletes its roster. A student moving class is a re-import, not an edit.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.census_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  student_code TEXT NOT NULL CHECK (student_code ~ '^[0-9]{5}$'),
  full_name TEXT NOT NULL CHECK (btrim(full_name) <> '' AND char_length(full_name) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (term, student_code)
);
CREATE INDEX IF NOT EXISTS census_students_classroom_idx ON public.census_students (classroom_id);

-- Only the signed-in roles and the backup job touch the table; anon gets nothing. RLS below limits the rows.
-- service_role only reads (the nightly backup).
REVOKE ALL ON public.census_students FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.census_students TO authenticated;
GRANT SELECT ON public.census_students TO service_role;

-- Guard, same style as control_assessments_guard in control_02: SECURITY INVOKER (never DEFINER, or the
-- caller below would always read as the function owner). term is always the class's term, whatever the
-- client sent; a class the caller cannot see (or that does not exist) is refused.
CREATE OR REPLACE FUNCTION public.census_students_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  NEW.term := (SELECT c.term FROM public.classrooms c WHERE c.id = NEW.classroom_id);
  IF NEW.term IS NULL THEN
    RAISE EXCEPTION 'ไม่พบห้องเรียนนี้' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.census_students_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS census_students_guard ON public.census_students;
CREATE TRIGGER census_students_guard BEFORE INSERT OR UPDATE ON public.census_students
  FOR EACH ROW EXECUTE FUNCTION public.census_students_guard();

-- =====================================================================
-- 2. Row Level Security
-- =====================================================================
ALTER TABLE public.census_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "census students: officers or advisors read" ON public.census_students;
CREATE POLICY "census students: officers or advisors read" ON public.census_students FOR SELECT TO authenticated
  USING (public.current_role_is('staff', 'super_admin') OR EXISTS (
    SELECT 1 FROM public.classroom_advisors a
    WHERE a.classroom_id = census_students.classroom_id AND a.user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "census students: officers create" ON public.census_students;
CREATE POLICY "census students: officers create" ON public.census_students FOR INSERT TO authenticated
  WITH CHECK (public.current_role_is('staff', 'super_admin'));

DROP POLICY IF EXISTS "census students: officers update" ON public.census_students;
CREATE POLICY "census students: officers update" ON public.census_students FOR UPDATE TO authenticated
  USING (public.current_role_is('staff', 'super_admin'))
  WITH CHECK (public.current_role_is('staff', 'super_admin'));

DROP POLICY IF EXISTS "census students: officers delete" ON public.census_students;
CREATE POLICY "census students: officers delete" ON public.census_students FOR DELETE TO authenticated
  USING (public.current_role_is('staff', 'super_admin'));

-- =====================================================================
-- 3. ชุดตรวจสอบ (CHECK BLOCK) — ทั้งหมดเป็นคอมเมนต์ ไม่ถูกรันพร้อมไฟล์
-- =====================================================================
-- วิธีใช้:
--   1) รันไฟล์นี้ให้เสร็จก่อน (ขึ้น Success)
--   2) แก้อีเมล 4 แบบนี้ให้เป็นบัญชีที่มีอยู่จริง คนละคนกัน (ใช้ Find & Replace ในหน้าจอได้):
--        เจ้าหน้าที่ทดสอบ@lrp.ac.th = บัญชี staff, head หรือ super_admin
--        ครูที่ปรึกษาทดสอบ@lrp.ac.th = บัญชีธรรมดา ไม่ใช่ staff/head/super_admin/executive (ชุดตรวจจะตั้งให้เป็นครูที่ปรึกษาห้องทดสอบ ก)
--        ครูทดสอบ@lrp.ac.th        = บัญชีธรรมดา เหมือนข้างบน แต่ไม่เป็นครูที่ปรึกษาห้องใดเลย
--        ผู้บริหารทดสอบ@lrp.ac.th    = บัญชี executive
--      ดูอีเมลที่มีอยู่จริงได้ด้วย:  select email, role from public.profiles order by email;
--   3) ชุด 1 เป็นคำสั่ง select ธรรมดา ผลขึ้นเป็นตาราง
--      ชุด 2-7 คัดลอกทีละชุด เฉพาะบรรทัดคำสั่ง (ข้ามบรรทัดหัวข้อ "========== ชุด" และบรรทัด "ผลที่ควรได้")
--      ไปวางใน SQL Editor หน้าใหม่ ลบเครื่องหมาย "-- " หน้าบรรทัดออก (เลือกข้อความแล้วกด Ctrl+/ หรือ Cmd+/) แล้วกด Run
--   4) **ชุด 2-7 จบด้วยข้อความ ERROR เสมอ — ตั้งใจให้เป็นแบบนั้น** เพราะ error ทำให้ระบบยกเลิก (ROLLBACK)
--      ทุกอย่างที่ชุดนั้นทำ (ห้องและนักเรียนทดสอบ) จึงไม่มีอะไรค้างในระบบ ข้อความขึ้นต้นด้วย "ผลทดสอบ:" ตามด้วยค่าที่วัดได้
--      ให้เทียบข้อความหลังคำว่า ERROR กับ "ผลที่ควรได้" ของชุดนั้น
--   5) ถ้าขึ้น "invalid input syntax for type uuid" แปลว่าอีเมลที่แก้ไม่ตรงกับบัญชีจริงทุกตัวอักษร
--
-- ทุกชุดสร้างห้องทดสอบในภาคเรียน 9999/9 (และ 9999/8 ในชุด 7) ชื่อ "ทดสอบ ก" "ทดสอบ ข" กับนักเรียนที่ชื่อ
-- "นักเรียนทดสอบ ก" รหัส 9xxxx จึงไม่ชนกับข้อมูลจริง แล้วสลับเป็นผู้ใช้จริงด้วย set local role authenticated
-- + request.jwt.claims เหมือน control_02 (ถ้าข้ามบรรทัด set local role ไป ชุดจะรันเป็นผู้ดูแลฐานข้อมูล
-- ซึ่งไม่ถูกจำกัดสิทธิ์ ผลจะผิด) ชุด 6-7 ตรวจกฎของตาราง จึงรันเป็นผู้ดูแลฐานข้อมูลโดยตั้งใจ
--
-- ========== ชุด 1: ตารางเปิด RLS และมี policy / trigger ครบ (policy 4 ตัว: อ่าน เพิ่ม แก้ ลบ, trigger 1 ตัว: guard) ==========
-- ผลที่ควรได้: 1 แถว — census_students true 4 1 (คอลัมน์ rowsecurity, policies, triggers)
-- select t.tablename, t.rowsecurity,
--   (select count(*) from pg_policies p where p.schemaname = t.schemaname and p.tablename = t.tablename) as policies,
--   (select count(*) from pg_trigger g where g.tgrelid = ('public.' || t.tablename)::regclass and not g.tgisinternal) as triggers
-- from pg_tables t
-- where t.schemaname = 'public' and t.tablename = 'census_students';
--
-- ========== ชุด 2: เจ้าหน้าที่เพิ่ม แก้ อ่าน ลบได้ทุกห้อง ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: staff_insert_rows=2, staff_update_rows=1, staff_sees=2, name_after_update=นักเรียนทดสอบ ก (แก้แล้ว), staff_delete_rows=1
-- insert into public.classrooms (term, name, zone) values ('9999/9', 'ทดสอบ ก', 'เขตทดสอบ'), ('9999/9', 'ทดสอบ ข', 'เขตทดสอบ');
-- select set_config('test.staff', (select id::text from public.profiles where email = 'เจ้าหน้าที่ทดสอบ@lrp.ac.th'), true);
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.staff'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare ins int; upd int; del int; seen int; nm text; begin
--   insert into public.census_students (classroom_id, term, student_code, full_name)
--     select c.id, c.term, case c.name when 'ทดสอบ ก' then '90001' else '90002' end, 'นักเรียนทดสอบ ' || right(c.name, 1)
--     from public.classrooms c where c.term = '9999/9';
--   get diagnostics ins = row_count;
--   update public.census_students set full_name = 'นักเรียนทดสอบ ก (แก้แล้ว)' where student_code = '90001';
--   get diagnostics upd = row_count;
--   select count(*) into seen from public.census_students where term = '9999/9';
--   select full_name into nm from public.census_students where student_code = '90001';
--   delete from public.census_students where student_code = '90002';
--   get diagnostics del = row_count;
--   raise exception 'ผลทดสอบ: staff_insert_rows=%, staff_update_rows=%, staff_sees=%, name_after_update=%, staff_delete_rows=%', ins, upd, seen, nm, del; end $$;
--
-- ========== ชุด 3: ครูที่ปรึกษาเห็นเฉพาะห้องตัวเอง เขียนไม่ได้ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: advisor_sees=1, own_room=1, other_room=0, advisor_insert=ถูกปฏิเสธ, advisor_update_rows=0, advisor_delete_rows=0
-- insert into public.classrooms (term, name, zone) values ('9999/9', 'ทดสอบ ก', 'เขตทดสอบ'), ('9999/9', 'ทดสอบ ข', 'เขตทดสอบ');
-- insert into public.classroom_advisors (classroom_id, user_id)
--   select c.id, p.id from public.classrooms c, public.profiles p
--   where c.term = '9999/9' and c.name = 'ทดสอบ ก' and p.email = 'ครูที่ปรึกษาทดสอบ@lrp.ac.th';
-- insert into public.census_students (classroom_id, student_code, full_name)
--   select c.id, case c.name when 'ทดสอบ ก' then '90001' else '90002' end, 'นักเรียนทดสอบ ' || right(c.name, 1)
--   from public.classrooms c where c.term = '9999/9';
-- select set_config('test.advisor', (select id::text from public.profiles where email = 'ครูที่ปรึกษาทดสอบ@lrp.ac.th'), true);
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.advisor'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare upd int; del int; r_ins text := 'ไม่ถูกปฏิเสธ'; seen int; own int; other int; begin
--   select count(*) into seen from public.census_students where term = '9999/9';
--   select count(*) into own from public.census_students where student_code = '90001';
--   select count(*) into other from public.census_students where student_code = '90002';
--   begin
--     insert into public.census_students (classroom_id, student_code, full_name)
--       select id, '90003', 'นักเรียนทดสอบ ค' from public.classrooms where term = '9999/9' and name = 'ทดสอบ ก';
--   exception when others then r_ins := 'ถูกปฏิเสธ'; end;
--   update public.census_students set full_name = 'แก้โดยครูที่ปรึกษา' where term = '9999/9';
--   get diagnostics upd = row_count;
--   delete from public.census_students where term = '9999/9';
--   get diagnostics del = row_count;
--   raise exception 'ผลทดสอบ: advisor_sees=%, own_room=%, other_room=%, advisor_insert=%, advisor_update_rows=%, advisor_delete_rows=%', seen, own, other, r_ins, upd, del; end $$;
--
-- ========== ชุด 4: ครูที่ไม่ได้เป็นที่ปรึกษาห้องนั้นไม่เห็น เขียนไม่ได้ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: teacher_sees=0, teacher_insert=ถูกปฏิเสธ, teacher_update_rows=0, teacher_delete_rows=0
-- insert into public.classrooms (term, name, zone) values ('9999/9', 'ทดสอบ ก', 'เขตทดสอบ');
-- insert into public.census_students (classroom_id, student_code, full_name)
--   select id, '90001', 'นักเรียนทดสอบ ก' from public.classrooms where term = '9999/9' and name = 'ทดสอบ ก';
-- select set_config('test.user', (select id::text from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), true);
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare upd int; del int; r_ins text := 'ไม่ถูกปฏิเสธ'; seen int; begin
--   select count(*) into seen from public.census_students where term = '9999/9';
--   begin
--     insert into public.census_students (classroom_id, student_code, full_name)
--       select id, '90003', 'นักเรียนทดสอบ ค' from public.classrooms where term = '9999/9' and name = 'ทดสอบ ก';
--   exception when others then r_ins := 'ถูกปฏิเสธ'; end;
--   update public.census_students set full_name = 'แก้โดยครู' where term = '9999/9';
--   get diagnostics upd = row_count;
--   delete from public.census_students where term = '9999/9';
--   get diagnostics del = row_count;
--   raise exception 'ผลทดสอบ: teacher_sees=%, teacher_insert=%, teacher_update_rows=%, teacher_delete_rows=%', seen, r_ins, upd, del; end $$;
--
-- ========== ชุด 5: ผู้บริหารไม่เห็น เขียนไม่ได้ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: executive_sees=0, executive_insert=ถูกปฏิเสธ, executive_update_rows=0, executive_delete_rows=0
-- insert into public.classrooms (term, name, zone) values ('9999/9', 'ทดสอบ ก', 'เขตทดสอบ');
-- insert into public.census_students (classroom_id, student_code, full_name)
--   select id, '90001', 'นักเรียนทดสอบ ก' from public.classrooms where term = '9999/9' and name = 'ทดสอบ ก';
-- select set_config('test.executive', (select id::text from public.profiles where email = 'ผู้บริหารทดสอบ@lrp.ac.th'), true);
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.executive'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare upd int; del int; r_ins text := 'ไม่ถูกปฏิเสธ'; seen int; begin
--   select count(*) into seen from public.census_students where term = '9999/9';
--   begin
--     insert into public.census_students (classroom_id, student_code, full_name)
--       select id, '90003', 'นักเรียนทดสอบ ค' from public.classrooms where term = '9999/9' and name = 'ทดสอบ ก';
--   exception when others then r_ins := 'ถูกปฏิเสธ'; end;
--   update public.census_students set full_name = 'แก้โดยผู้บริหาร' where term = '9999/9';
--   get diagnostics upd = row_count;
--   delete from public.census_students where term = '9999/9';
--   get diagnostics del = row_count;
--   raise exception 'ผลทดสอบ: executive_sees=%, executive_insert=%, executive_update_rows=%, executive_delete_rows=%', seen, r_ins, upd, del; end $$;
--
-- ========== ชุด 6: รหัสซ้ำในภาคเดียวกันไม่ได้ รหัสต้องเป็นเลข 5 หลัก ชื่อห้ามว่าง ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: duplicate=ถูกปฏิเสธ, code_4_digits=ถูกปฏิเสธ, code_6_digits=ถูกปฏิเสธ, code_letter=ถูกปฏิเสธ, blank_name=ถูกปฏิเสธ, code_valid=ไม่ถูกปฏิเสธ
-- insert into public.classrooms (term, name, zone) values ('9999/9', 'ทดสอบ ก', 'เขตทดสอบ'), ('9999/9', 'ทดสอบ ข', 'เขตทดสอบ');
-- insert into public.census_students (classroom_id, student_code, full_name)
--   select id, '90001', 'นักเรียนทดสอบ ก' from public.classrooms where term = '9999/9' and name = 'ทดสอบ ก';
-- do $$ declare r_dup text := 'ไม่ถูกปฏิเสธ'; r_4 text := 'ไม่ถูกปฏิเสธ'; r_6 text := 'ไม่ถูกปฏิเสธ'; r_ch text := 'ไม่ถูกปฏิเสธ'; r_nm text := 'ไม่ถูกปฏิเสธ'; r_ok text := 'ถูกปฏิเสธ'; room uuid; begin
--   select id into room from public.classrooms where term = '9999/9' and name = 'ทดสอบ ข';
--   begin   -- รหัสเดิมในห้องอื่นของภาคเดียวกัน ก็ซ้ำ
--     insert into public.census_students (classroom_id, student_code, full_name) values (room, '90001', 'นักเรียนทดสอบ ข');
--   exception when unique_violation then r_dup := 'ถูกปฏิเสธ'; end;
--   begin
--     insert into public.census_students (classroom_id, student_code, full_name) values (room, '9002', 'นักเรียนทดสอบ ข');
--   exception when check_violation then r_4 := 'ถูกปฏิเสธ'; end;
--   begin
--     insert into public.census_students (classroom_id, student_code, full_name) values (room, '900022', 'นักเรียนทดสอบ ข');
--   exception when check_violation then r_6 := 'ถูกปฏิเสธ'; end;
--   begin
--     insert into public.census_students (classroom_id, student_code, full_name) values (room, '9002a', 'นักเรียนทดสอบ ข');
--   exception when check_violation then r_ch := 'ถูกปฏิเสธ'; end;
--   begin
--     insert into public.census_students (classroom_id, student_code, full_name) values (room, '90002', '   ');
--   exception when check_violation then r_nm := 'ถูกปฏิเสธ'; end;
--   begin
--     insert into public.census_students (classroom_id, student_code, full_name) values (room, '90002', 'นักเรียนทดสอบ ข');
--     r_ok := 'ไม่ถูกปฏิเสธ';
--   exception when others then r_ok := 'ถูกปฏิเสธ'; end;
--   raise exception 'ผลทดสอบ: duplicate=%, code_4_digits=%, code_6_digits=%, code_letter=%, blank_name=%, code_valid=%', r_dup, r_4, r_6, r_ch, r_nm, r_ok; end $$;
--
-- ========== ชุด 7: guard — term มาจากห้องเสมอ แม้ฝั่งแอปส่งค่าอื่นมา และห้องที่ไม่มีอยู่ถูกปฏิเสธ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: term_on_insert=9999/9, term_after_move=9999/8, missing_room=ถูกปฏิเสธ (ไม่พบห้องเรียนนี้)
-- insert into public.classrooms (term, name, zone) values ('9999/9', 'ทดสอบ ก', 'เขตทดสอบ'), ('9999/8', 'ทดสอบ ข', 'เขตทดสอบ');
-- do $$ declare t1 text; t2 text; r_room text := 'ไม่ถูกปฏิเสธ'; begin
--   insert into public.census_students (classroom_id, term, student_code, full_name)
--     select id, '1111/1', '90001', 'นักเรียนทดสอบ ก' from public.classrooms where term = '9999/9' and name = 'ทดสอบ ก';
--   select term into t1 from public.census_students where student_code = '90001';
--   update public.census_students set classroom_id = (select id from public.classrooms where term = '9999/8' and name = 'ทดสอบ ข'), term = '1111/1'
--     where student_code = '90001';
--   select term into t2 from public.census_students where student_code = '90001';
--   begin
--     insert into public.census_students (classroom_id, student_code, full_name) values (gen_random_uuid(), '90002', 'นักเรียนทดสอบ ข');
--   exception when sqlstate 'P0001' then r_room := 'ถูกปฏิเสธ (' || sqlerrm || ')'; end;
--   raise exception 'ผลทดสอบ: term_on_insert=%, term_after_move=%, missing_room=%', t1, t2, r_room; end $$;
--
-- ตรวจว่าไม่มีอะไรค้างหลังรันชุด 2-7 (ผลที่ควรได้: 0 แถว ทั้งสองคำสั่ง)
-- select student_code from public.census_students where student_code like '9000_';
-- select name from public.classrooms where term in ('9999/9', '9999/8');
