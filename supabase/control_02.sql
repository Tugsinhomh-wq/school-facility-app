-- Internal control module (การควบคุมภายใน), round 2: the ปค.4 assessment results (one row per fiscal year
-- and group). Run AFTER control_01.sql (and so after the files it lists).
-- Everything here only adds; nothing existing is dropped or narrowed. Safe to run again
-- (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS / DROP TRIGGER IF EXISTS).
-- The whole file runs as one transaction in the SQL editor: if any statement fails, none applies.
--
-- วิธีรัน: รันไฟล์ control_01 ให้เสร็จก่อน แล้ววางไฟล์นี้ทั้งไฟล์ใน SQL Editor กด Run
-- ส่วน "ชุดตรวจสอบ" ท้ายไฟล์เป็นคอมเมนต์ทั้งหมด ไม่ถูกรันไปด้วย ให้คัดลอกไปรันทีละชุดภายหลัง
-- ต้องรันไฟล์นี้ก่อน deploy โค้ดที่สำรองข้อมูล (src/lib/backup.ts) ไม่งั้นการสำรองคืนถัดไปจะ error เพราะหาตาราง control_assessments ไม่เจอ
--
-- Who may do what (mirrors canReview in src/lib/control/access.ts):
--   officers  = public.current_role_is('staff', 'super_admin'), i.e. staff, head and super_admin: read and write.
--   executive = can read, no write path.
--   anyone else (including a project owner) sees and writes nothing. There is no DELETE policy.

-- 0. Stop early with a clear message if an earlier file has not been run yet.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'user_role' AND e.enumlabel = 'executive'
  ) THEN
    RAISE EXCEPTION 'ยังไม่ได้รันไฟล์ executive_role.sql — รันไฟล์นั้นแยกก่อน แล้วค่อยรันไฟล์นี้';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = to_regprocedure('public.current_role_is(public.user_role[])')::oid
      AND p.prosrc LIKE '%head%'
  ) THEN
    RAISE EXCEPTION 'ยังไม่ได้รันไฟล์ facility_02_cleaning.sql — ฟังก์ชัน current_role_is ยังไม่รับบทบาท head';
  END IF;
  IF to_regprocedure('public.touch_updated_at()') IS NULL THEN
    RAISE EXCEPTION 'ไม่พบฟังก์ชัน public.touch_updated_at() (อยู่ใน schema.sql ข้อ 9.2)';
  END IF;
  IF to_regclass('public.control_missions') IS NULL THEN
    RAISE EXCEPTION 'ยังไม่ได้รันไฟล์ control_01.sql — รันไฟล์นั้นก่อน แล้วค่อยรันไฟล์นี้';
  END IF;
END $$;

-- =====================================================================
-- 1. Table
--    group_key values are the keys of GROUPS in src/lib/control/forms.ts (same list as control_01).
--    items holds the whole form of one group in one year:
--      {"principles": {"1": {"result": "full|partial|none", "text": "..."}, ... "17": {...}},
--       "summaries":  {"1": "...", ... "5": "..."}}
--    principle keys are 1-17, summary keys 1-5 (the PK4_COMPONENTS in forms.ts). The app validates all of
--    that when it reads and writes; the database only guarantees that items is a JSON object.
--    updated_by and updated_at are stamped by the triggers below (the app also sends updated_by, and
--    matches updated_at to refuse a save over a newer one); updated_by has no ON DELETE cascade, a
--    deleted profile just clears it.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.control_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year INT NOT NULL,
  group_key TEXT NOT NULL CHECK (group_key IN ('finance', 'student', 'personnel', 'academic', 'general', 'royal')),
  items JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(items) = 'object'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (fiscal_year, group_key)
);

GRANT SELECT, INSERT, UPDATE ON public.control_assessments TO authenticated, service_role;

-- touch_updated_at is the schema.sql 9.2 helper (same as control_missions).
DROP TRIGGER IF EXISTS control_assessments_touch ON public.control_assessments;
CREATE TRIGGER control_assessments_touch BEFORE UPDATE ON public.control_assessments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Guard, same style as control_projects_guard in control_01: SECURITY INVOKER (never DEFINER, or the
-- caller below would always read as the function owner). updated_by is whoever is signed in, whatever
-- the client sent (a server-side job with no auth.uid() keeps what it sets); the year and group of a
-- row never change, because the app's optimistic lock and the document export key on them.
CREATE OR REPLACE FUNCTION public.control_assessments_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
BEGIN
  IF v_uid IS NOT NULL THEN
    NEW.updated_by := v_uid;
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.fiscal_year IS DISTINCT FROM OLD.fiscal_year OR NEW.group_key IS DISTINCT FROM OLD.group_key) THEN
    RAISE EXCEPTION 'เปลี่ยนปีงบประมาณหรือกลุ่มงานของผลประเมินไม่ได้' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.control_assessments_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS control_assessments_guard ON public.control_assessments;
CREATE TRIGGER control_assessments_guard BEFORE INSERT OR UPDATE ON public.control_assessments
  FOR EACH ROW EXECUTE FUNCTION public.control_assessments_guard();

-- =====================================================================
-- 2. Row Level Security
-- =====================================================================
ALTER TABLE public.control_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "control assessments: officers or executives read" ON public.control_assessments;
CREATE POLICY "control assessments: officers or executives read" ON public.control_assessments FOR SELECT TO authenticated
  USING (public.current_role_is('staff', 'super_admin', 'executive'));

DROP POLICY IF EXISTS "control assessments: officers create" ON public.control_assessments;
CREATE POLICY "control assessments: officers create" ON public.control_assessments FOR INSERT TO authenticated
  WITH CHECK (public.current_role_is('staff', 'super_admin'));

DROP POLICY IF EXISTS "control assessments: officers update" ON public.control_assessments;
CREATE POLICY "control assessments: officers update" ON public.control_assessments FOR UPDATE TO authenticated
  USING (public.current_role_is('staff', 'super_admin'))
  WITH CHECK (public.current_role_is('staff', 'super_admin'));

-- =====================================================================
-- 3. ชุดตรวจสอบ (CHECK BLOCK) — ทั้งหมดเป็นคอมเมนต์ ไม่ถูกรันพร้อมไฟล์
-- =====================================================================
-- วิธีใช้:
--   1) รันไฟล์นี้ให้เสร็จก่อน (ขึ้น Success)
--   2) แก้อีเมล 3 แบบนี้ให้เป็นบัญชีที่มีอยู่จริง คนละคนกัน (ใช้ Find & Replace ในหน้าจอได้):
--        เจ้าหน้าที่ทดสอบ@lrp.ac.th = บัญชี staff, head หรือ super_admin
--        ครูทดสอบ@lrp.ac.th        = บัญชีธรรมดา ไม่ใช่ staff/head/super_admin/executive
--        ผู้บริหารทดสอบ@lrp.ac.th    = บัญชี executive
--      ดูอีเมลที่มีอยู่จริงได้ด้วย:  select email, role from public.profiles order by email;
--   3) ชุด 1 เป็นคำสั่ง select ธรรมดา ผลขึ้นเป็นตาราง
--      ชุด 2-6 คัดลอกทีละชุด เฉพาะบรรทัดคำสั่ง (ข้ามบรรทัดหัวข้อ "========== ชุด" และบรรทัด "ผลที่ควรได้")
--      ไปวางใน SQL Editor หน้าใหม่ ลบเครื่องหมาย "-- " หน้าบรรทัดออก (เลือกข้อความแล้วกด Ctrl+/ หรือ Cmd+/) แล้วกด Run
--   4) **ชุด 2-6 จบด้วยข้อความ ERROR เสมอ — ตั้งใจให้เป็นแบบนั้น** เพราะ error ทำให้ระบบยกเลิก (ROLLBACK)
--      ทุกอย่างที่ชุดนั้นทำ (แถวทดสอบ) จึงไม่มีอะไรค้างในระบบ ข้อความขึ้นต้นด้วย "ผลทดสอบ:" ตามด้วยค่าที่วัดได้
--      ให้เทียบข้อความหลังคำว่า ERROR กับ "ผลที่ควรได้" ของชุดนั้น
--   5) ถ้าขึ้น "invalid input syntax for type uuid" แปลว่าอีเมลที่แก้ไม่ตรงกับบัญชีจริงทุกตัวอักษร
--
-- ทุกชุดใช้ปีงบประมาณ 9999 กลุ่ม general เป็นแถวทดสอบ จึงไม่ชนกับข้อมูลจริง
-- แล้วสลับเป็นผู้ใช้จริงด้วย set local role authenticated + request.jwt.claims เหมือน control_01
-- (ถ้าข้ามบรรทัด set local role ไป ชุดจะรันเป็นผู้ดูแลฐานข้อมูลซึ่งไม่ถูกจำกัดสิทธิ์ ผลจะผิด)
--
-- ========== ชุด 1: ตารางเปิด RLS และมี policy / trigger ครบ (trigger 2 ตัว: touch และ guard) ==========
-- ผลที่ควรได้: 1 แถว — control_assessments true 3 2 (คอลัมน์ rowsecurity, policies, triggers)
-- select t.tablename, t.rowsecurity,
--   (select count(*) from pg_policies p where p.schemaname = t.schemaname and p.tablename = t.tablename) as policies,
--   (select count(*) from pg_trigger g where g.tgrelid = ('public.' || t.tablename)::regclass and not g.tgisinternal) as triggers
-- from pg_tables t
-- where t.schemaname = 'public' and t.tablename = 'control_assessments';
--
-- ========== ชุด 2: เจ้าหน้าที่เขียนและอ่านได้ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: staff_insert_rows=1, staff_update_rows=1, staff_sees=1, items_after_update={"summaries": {"1": "แก้แล้ว"}}
-- select set_config('test.staff', (select id::text from public.profiles where email = 'เจ้าหน้าที่ทดสอบ@lrp.ac.th'), true);
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.staff'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare ins int; upd int; begin
--   insert into public.control_assessments (fiscal_year, group_key, items, updated_by) values (9999, 'general', '{}', (select auth.uid()));
--   get diagnostics ins = row_count;
--   update public.control_assessments set items = '{"summaries": {"1": "แก้แล้ว"}}' where fiscal_year = 9999 and group_key = 'general';
--   get diagnostics upd = row_count;
--   raise exception 'ผลทดสอบ: staff_insert_rows=%, staff_update_rows=%, staff_sees=%, items_after_update=%', ins, upd,
--     (select count(*) from public.control_assessments where fiscal_year = 9999),
--     (select items from public.control_assessments where fiscal_year = 9999 and group_key = 'general'); end $$;
--
-- ========== ชุด 3: ผู้ใช้ทั่วไปและเจ้าของโครงการไม่เห็น เขียนไม่ได้ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: user_sees=0, user_insert=ถูกปฏิเสธ, user_update_rows=0
-- insert into public.control_assessments (fiscal_year, group_key) values (9999, 'general');
-- select set_config('test.user', (select id::text from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), true);
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare upd int; r_ins text := 'ไม่ถูกปฏิเสธ'; seen int; begin
--   select count(*) into seen from public.control_assessments where fiscal_year = 9999;
--   begin
--     insert into public.control_assessments (fiscal_year, group_key) values (9999, 'finance');
--   exception when others then r_ins := 'ถูกปฏิเสธ'; end;
--   update public.control_assessments set items = '{"summaries": {"1": "แก้โดยผู้ใช้"}}' where fiscal_year = 9999;
--   get diagnostics upd = row_count;
--   raise exception 'ผลทดสอบ: user_sees=%, user_insert=%, user_update_rows=%', seen, r_ins, upd; end $$;
--
-- ========== ชุด 4: ผู้บริหารอ่านได้แต่เขียนไม่ได้ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: executive_sees=1, executive_insert=ถูกปฏิเสธ, executive_update_rows=0
-- insert into public.control_assessments (fiscal_year, group_key) values (9999, 'general');
-- select set_config('test.executive', (select id::text from public.profiles where email = 'ผู้บริหารทดสอบ@lrp.ac.th'), true);
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.executive'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare upd int; r_ins text := 'ไม่ถูกปฏิเสธ'; seen int; begin
--   select count(*) into seen from public.control_assessments where fiscal_year = 9999;
--   begin
--     insert into public.control_assessments (fiscal_year, group_key) values (9999, 'finance');
--   exception when others then r_ins := 'ถูกปฏิเสธ'; end;
--   update public.control_assessments set items = '{"summaries": {"1": "แก้โดยผู้บริหาร"}}' where fiscal_year = 9999;
--   get diagnostics upd = row_count;
--   raise exception 'ผลทดสอบ: executive_sees=%, executive_insert=%, executive_update_rows=%', seen, r_ins, upd; end $$;
--
-- ========== ชุด 5: ปีเดียวกันกลุ่มเดียวกันซ้ำไม่ได้ และ items ต้องเป็น object ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: duplicate=ถูกปฏิเสธ, items_array=ถูกปฏิเสธ
-- insert into public.control_assessments (fiscal_year, group_key) values (9999, 'general');
-- do $$ declare r_dup text := 'ไม่ถูกปฏิเสธ'; r_arr text := 'ไม่ถูกปฏิเสธ'; begin
--   begin
--     insert into public.control_assessments (fiscal_year, group_key) values (9999, 'general');
--   exception when unique_violation then r_dup := 'ถูกปฏิเสธ'; end;
--   begin
--     insert into public.control_assessments (fiscal_year, group_key, items) values (9999, 'finance', '[]');
--   exception when check_violation then r_arr := 'ถูกปฏิเสธ'; end;
--   raise exception 'ผลทดสอบ: duplicate=%, items_array=%', r_dup, r_arr; end $$;
--
-- ========== ชุด 6: guard — เปลี่ยนกลุ่มงานไม่ได้ และ updated_by เป็นผู้บันทึกจริงเสมอ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: change_group=ถูกปฏิเสธ (เปลี่ยนปีงบประมาณหรือกลุ่มงานของผลประเมินไม่ได้), updated_by_is_caller=true
-- select set_config('test.staff', (select id::text from public.profiles where email = 'เจ้าหน้าที่ทดสอบ@lrp.ac.th'), true);
-- select set_config('test.other', (select id::text from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), true);
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.staff'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare r_grp text := 'ไม่ถูกปฏิเสธ'; by_ok boolean; begin
--   insert into public.control_assessments (fiscal_year, group_key, updated_by) values (9999, 'general', current_setting('test.other')::uuid);
--   update public.control_assessments set items = '{"summaries": {"1": "แก้แล้ว"}}', updated_by = current_setting('test.other')::uuid where fiscal_year = 9999 and group_key = 'general';
--   select updated_by = current_setting('test.staff')::uuid into by_ok from public.control_assessments where fiscal_year = 9999 and group_key = 'general';
--   begin
--     update public.control_assessments set group_key = 'finance' where fiscal_year = 9999 and group_key = 'general';
--   exception when sqlstate 'P0001' then r_grp := 'ถูกปฏิเสธ (' || sqlerrm || ')'; end;
--   raise exception 'ผลทดสอบ: change_group=%, updated_by_is_caller=%', r_grp, by_ok; end $$;
--
-- ตรวจว่าไม่มีอะไรค้างหลังรันชุด 2-6 (ผลที่ควรได้: 0 แถว)
-- select fiscal_year, group_key from public.control_assessments where fiscal_year = 9999;
