-- Internal control module (การควบคุมภายใน), round 1: missions with their CSA, projects with their risk
-- scoring, and follow-up actions. Run AFTER facility_01_head_role.sql, executive_role.sql and
-- facility_02_cleaning.sql (each of those as its own run, so the new role values are committed).
-- Everything here only adds; nothing existing is dropped or narrowed. Safe to run again
-- (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS / DROP TRIGGER IF EXISTS).
-- The whole file runs as one transaction in the SQL editor: if any statement fails, none applies.
--
-- วิธีรัน: รันไฟล์ facility_01, executive_role และ facility_02 ให้เสร็จก่อน แล้ววางไฟล์นี้ทั้งไฟล์ใน SQL Editor กด Run
-- ส่วน "ชุดตรวจสอบ" ท้ายไฟล์เป็นคอมเมนต์ทั้งหมด ไม่ถูกรันไปด้วย ให้คัดลอกไปรันทีละชุดภายหลัง
-- ต้องรันไฟล์นี้ก่อน deploy โค้ดที่สำรองข้อมูล (src/lib/backup.ts) ไม่งั้นการสำรองคืนถัดไปจะ error เพราะหาตารางไม่เจอ
--
-- Who may do what (mirrors canEditProject in src/lib/control/access.ts):
--   officers  = public.current_role_is('staff', 'super_admin'), i.e. staff, head and super_admin.
--   executive = can read everything, but is given no write path by the app: /control is closed to executives
--               in round 1. At the database level an executive who is also the owner of a project can
--               still write the rows they own (the owner rules below ignore the role). Accepted for round 1.
--   owner     = the account in control_projects.owner_id: edits its own project until an officer confirms it.
--   anyone else sees nothing of someone else's project.

-- 0. Stop early with a clear message if an earlier file has not been run yet.
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
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'user_role' AND e.enumlabel = 'executive'
  ) THEN
    RAISE EXCEPTION 'ยังไม่ได้รันไฟล์ executive_role.sql — รันไฟล์นั้นแยกก่อน แล้วค่อยรันไฟล์นี้';
  END IF;
  -- facility_02 section 1 is what makes current_role_is('staff', ...) admit the head role.
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
END $$;

-- =====================================================================
-- 1. Tables
--    group_key values are the keys of GROUPS in src/lib/control/forms.ts; changing one is a schema change.
--    Text columns are NOT NULL DEFAULT '' (the app never has to tell "empty" from "missing").
-- =====================================================================
-- A mission of one group in one fiscal year, with its five CSA steps (control self-assessment).
CREATE TABLE IF NOT EXISTS public.control_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year INT NOT NULL,
  group_key TEXT NOT NULL CHECK (group_key IN ('finance', 'student', 'personnel', 'academic', 'general', 'royal')),
  name TEXT NOT NULL DEFAULT '',
  objective TEXT NOT NULL DEFAULT '',     -- CSA step 1
  procedures TEXT NOT NULL DEFAULT '',    -- CSA step 2
  practice TEXT NOT NULL DEFAULT '',      -- CSA step 3
  assessment TEXT NOT NULL DEFAULT '',    -- CSA step 4
  improvement TEXT NOT NULL DEFAULT '',   -- CSA step 5
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One project (or activity) of the school's action plan and the risk the owner scored for it.
-- owner_id has no ON DELETE action, like repair_tickets.reporter_id: accounts are deactivated, not
-- deleted, and deleting an owner must not silently delete the school's internal-control records.
-- likelihood/impact are the owner's 1-5 scores, head_likelihood/head_impact the head's override.
-- confirmed_at is set by an officer; from then on the owner can no longer change the project.
CREATE TABLE IF NOT EXISTS public.control_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year INT NOT NULL,
  group_key TEXT NOT NULL CHECK (group_key IN ('finance', 'student', 'personnel', 'academic', 'general', 'royal')),
  name TEXT NOT NULL DEFAULT '',
  budget NUMERIC NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id),
  mission_id UUID NULL REFERENCES public.control_missions(id) ON DELETE SET NULL,
  objective TEXT NOT NULL DEFAULT '',
  risk_issue TEXT NOT NULL DEFAULT '',
  risk_cause TEXT NOT NULL DEFAULT '',
  risk_impact TEXT NOT NULL DEFAULT '',
  risk_type TEXT NULL CHECK (risk_type IN ('F', 'C', 'O')),   -- F financial, C compliance, O operational
  likelihood SMALLINT NULL CHECK (likelihood BETWEEN 1 AND 5),
  impact SMALLINT NULL CHECK (impact BETWEEN 1 AND 5),
  head_likelihood SMALLINT NULL CHECK (head_likelihood BETWEEN 1 AND 5),
  head_impact SMALLINT NULL CHECK (head_impact BETWEEN 1 AND 5),
  existing_controls TEXT NOT NULL DEFAULT '',
  assessment TEXT NOT NULL DEFAULT '',
  residual_risk TEXT NOT NULL DEFAULT '',
  confirmed_at TIMESTAMPTZ NULL,
  confirmed_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Improvement measures of a project (who does what by when). Deleted together with the project.
CREATE TABLE IF NOT EXISTS public.control_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.control_projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  responsible TEXT NOT NULL DEFAULT '',
  due DATE NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'doing', 'done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS control_missions_year_group_idx ON public.control_missions (fiscal_year, group_key);
CREATE INDEX IF NOT EXISTS control_projects_year_group_idx ON public.control_projects (fiscal_year, group_key);
CREATE INDEX IF NOT EXISTS control_projects_owner_idx ON public.control_projects (owner_id);
CREATE INDEX IF NOT EXISTS control_projects_mission_idx ON public.control_projects (mission_id);
CREATE INDEX IF NOT EXISTS control_actions_project_idx ON public.control_actions (project_id);

-- Table privileges for the API roles. Supabase normally grants these by default to tables created in
-- public; stating them keeps this file working if that default is switched off. Row Level Security
-- below still decides which rows each signed-in user can touch; anon is not granted anything here.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.control_missions, public.control_projects, public.control_actions
  TO authenticated, service_role;

-- =====================================================================
-- 2. Guard trigger on control_projects (created before the triggers that use it)
-- =====================================================================
-- Row Level Security decides WHICH rows an owner may change; it cannot say which COLUMNS. This trigger
-- does: for everyone who is not an officer,
--   INSERT: owner_id must be the caller, and head_likelihood, head_impact, mission_id and confirmed_by
--           must be empty (confirmed_at must be empty too, which the INSERT policy below already checks);
--   UPDATE: owner_id, fiscal_year, group_key, mission_id, head_likelihood, head_impact, confirmed_at and
--           confirmed_by must keep their old values (confirm / unconfirm, the head's score and the
--           mission are decisions of the head).
-- Every insert and update also stamps updated_at, whoever does it.
--
-- SECURITY INVOKER on purpose: current_user is then the role of the caller, and the check below skips
-- only the database's own administrative roles (SQL editor, backup restore script, service key,
-- and the foreign-key actions that clear confirmed_by / mission_id when a profile or mission is deleted,
-- which run as the table owner). An API user is always 'authenticated' (or 'anon') and is never skipped.
-- Do NOT turn this into SECURITY DEFINER: current_user would then always be the function owner and
-- the guard would be skipped for everybody.
CREATE OR REPLACE FUNCTION public.control_projects_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_uid UUID := (SELECT auth.uid());
BEGIN
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin')
     AND NOT public.current_role_is('staff', 'super_admin') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.owner_id IS DISTINCT FROM v_uid
         OR NEW.head_likelihood IS NOT NULL
         OR NEW.head_impact IS NOT NULL
         OR NEW.mission_id IS NOT NULL
         OR NEW.confirmed_by IS NOT NULL THEN
        RAISE EXCEPTION 'สร้างโครงการได้เฉพาะในชื่อของตัวเอง และกำหนดคะแนนของหัวหน้า ภารกิจ หรือการยืนยันเองไม่ได้' USING ERRCODE = 'P0001';
      END IF;
    ELSIF NEW.owner_id IS DISTINCT FROM OLD.owner_id
       OR NEW.fiscal_year IS DISTINCT FROM OLD.fiscal_year
       OR NEW.group_key IS DISTINCT FROM OLD.group_key
       OR NEW.mission_id IS DISTINCT FROM OLD.mission_id
       OR NEW.head_likelihood IS DISTINCT FROM OLD.head_likelihood
       OR NEW.head_impact IS DISTINCT FROM OLD.head_impact
       OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at
       OR NEW.confirmed_by IS DISTINCT FROM OLD.confirmed_by THEN
      RAISE EXCEPTION 'เจ้าของโครงการเปลี่ยนเจ้าของ ปีงบประมาณ กลุ่มงาน ภารกิจ คะแนนของหัวหน้า หรือการยืนยันไม่ได้ (เฉพาะเจ้าหน้าที่)' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.control_projects_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS control_projects_guard ON public.control_projects;
CREATE TRIGGER control_projects_guard BEFORE INSERT OR UPDATE ON public.control_projects
  FOR EACH ROW EXECUTE FUNCTION public.control_projects_guard();

-- Missions only need updated_at kept (touch_updated_at is the schema.sql 9.2 helper).
DROP TRIGGER IF EXISTS control_missions_touch ON public.control_missions;
CREATE TRIGGER control_missions_touch BEFORE UPDATE ON public.control_missions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================================
-- 3. Row Level Security
--    "officers" = current_role_is('staff', 'super_admin'), i.e. staff, head and super_admin.
-- =====================================================================
ALTER TABLE public.control_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_actions  ENABLE ROW LEVEL SECURITY;

-- control_missions: any signed-in user reads (a project form shows the CSA of its mission); officers manage.
DROP POLICY IF EXISTS "control missions: read" ON public.control_missions;
CREATE POLICY "control missions: read" ON public.control_missions FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "control missions: officers manage" ON public.control_missions;
CREATE POLICY "control missions: officers manage" ON public.control_missions FOR ALL TO authenticated
  USING (public.current_role_is('staff', 'super_admin'))
  WITH CHECK (public.current_role_is('staff', 'super_admin'));

-- control_projects: officers and executives see every project, an owner sees their own.
DROP POLICY IF EXISTS "control projects: officers, executives or owner read" ON public.control_projects;
CREATE POLICY "control projects: officers, executives or owner read" ON public.control_projects FOR SELECT TO authenticated
  USING (public.current_role_is('staff', 'super_admin', 'executive') OR owner_id = (SELECT auth.uid()));

-- Officers create for anyone; anyone else only in their own name and not already confirmed
-- (the guard trigger also keeps the head's fields and the mission empty on insert).
DROP POLICY IF EXISTS "control projects: officers or owner create" ON public.control_projects;
CREATE POLICY "control projects: officers or owner create" ON public.control_projects FOR INSERT TO authenticated
  WITH CHECK (public.current_role_is('staff', 'super_admin')
    OR (owner_id = (SELECT auth.uid()) AND confirmed_at IS NULL));

-- Officers change and delete every project; an owner only while it is not confirmed. The new row must
-- pass too, so an owner cannot hand the project to someone else or confirm it (the guard trigger
-- spells out the columns an owner may not touch).
DROP POLICY IF EXISTS "control projects: officers or owner update" ON public.control_projects;
CREATE POLICY "control projects: officers or owner update" ON public.control_projects FOR UPDATE TO authenticated
  USING (public.current_role_is('staff', 'super_admin')
    OR (owner_id = (SELECT auth.uid()) AND confirmed_at IS NULL))
  WITH CHECK (public.current_role_is('staff', 'super_admin')
    OR (owner_id = (SELECT auth.uid()) AND confirmed_at IS NULL));
DROP POLICY IF EXISTS "control projects: officers or owner delete" ON public.control_projects;
CREATE POLICY "control projects: officers or owner delete" ON public.control_projects FOR DELETE TO authenticated
  USING (public.current_role_is('staff', 'super_admin')
    OR (owner_id = (SELECT auth.uid()) AND confirmed_at IS NULL));

-- control_actions follow their project: officers and executives read all, an owner reads their projects'.
DROP POLICY IF EXISTS "control actions: officers, executives or owner read" ON public.control_actions;
CREATE POLICY "control actions: officers, executives or owner read" ON public.control_actions FOR SELECT TO authenticated
  USING (public.current_role_is('staff', 'super_admin', 'executive') OR EXISTS (
    SELECT 1 FROM public.control_projects p
    WHERE p.id = control_actions.project_id AND p.owner_id = (SELECT auth.uid())));

-- Officers and the project's owner write measures. The owner may do so even after the project is
-- confirmed, because the status (open / doing / done) is updated during follow-up, after confirmation.
DROP POLICY IF EXISTS "control actions: officers or owner manage" ON public.control_actions;
CREATE POLICY "control actions: officers or owner manage" ON public.control_actions FOR ALL TO authenticated
  USING (public.current_role_is('staff', 'super_admin') OR EXISTS (
    SELECT 1 FROM public.control_projects p
    WHERE p.id = control_actions.project_id AND p.owner_id = (SELECT auth.uid())))
  WITH CHECK (public.current_role_is('staff', 'super_admin') OR EXISTS (
    SELECT 1 FROM public.control_projects p
    WHERE p.id = control_actions.project_id AND p.owner_id = (SELECT auth.uid())));

-- =====================================================================
-- 4. ชุดตรวจสอบ (CHECK BLOCK) — ทั้งหมดเป็นคอมเมนต์ ไม่ถูกรันพร้อมไฟล์
-- =====================================================================
-- วิธีใช้:
--   1) รันไฟล์นี้ให้เสร็จก่อน (ขึ้น Success)
--   2) แก้อีเมล 3 แบบนี้ให้เป็นบัญชีที่มีอยู่จริง คนละคนกัน (ใช้ Find & Replace ในหน้าจอได้):
--        ครูทดสอบ@lrp.ac.th     = เจ้าของโครงการทดสอบ (บัญชีธรรมดา ไม่ใช่ staff/head/super_admin/executive)
--        ครูคนอื่น@lrp.ac.th    = ผู้ใช้อีกคนที่ไม่ใช่เจ้าของ (บัญชีธรรมดา ไม่ใช่ staff/head/super_admin/executive)
--        หัวหน้าทดสอบ@lrp.ac.th = บัญชีที่จะถูกตั้งเป็น head ชั่วคราวในชุด 5 (ต้องไม่ใช่ super_admin)
--      ดูอีเมลที่มีอยู่จริงได้ด้วย:  select email, role from public.profiles order by email;
--   3) ชุด 1 เป็นคำสั่ง select ธรรมดา ผลขึ้นเป็นตาราง
--      ชุด 2-6 คัดลอกทีละชุด เฉพาะบรรทัดคำสั่ง (ข้ามบรรทัดหัวข้อ "========== ชุด" และบรรทัด "ผลที่ควรได้")
--      ไปวางใน SQL Editor หน้าใหม่ ลบเครื่องหมาย "-- " หน้าบรรทัดออก (เลือกข้อความแล้วกด Ctrl+/ หรือ Cmd+/) แล้วกด Run
--   4) **ชุด 2-6 จบด้วยข้อความ ERROR เสมอ — ตั้งใจให้เป็นแบบนั้น** เพราะ error ทำให้ระบบยกเลิก (ROLLBACK)
--      ทุกอย่างที่ชุดนั้นทำ (โครงการทดสอบ บทบาท head ชั่วคราว) จึงไม่มีอะไรค้างในระบบ
--      (SQL Editor แสดงผลเฉพาะคำสั่งสุดท้าย จึงใช้ข้อความ error นำค่าที่วัดได้ออกมาแสดง)
--      ให้เทียบข้อความหลังคำว่า ERROR กับ "ผลที่ควรได้" ของชุดนั้น
--      - ชุดที่ทดสอบว่าระบบต้องปฏิเสธ: ข้อความ error คือคำปฏิเสธจากระบบ
--      - ชุดที่วัดค่า: ข้อความขึ้นต้นด้วย "ผลทดสอบ:" ตามด้วยค่าที่วัดได้
--   5) ถ้าขึ้น "invalid input syntax for type uuid" แปลว่าอีเมลที่แก้ไม่ตรงกับบัญชีจริงทุกตัวอักษร
--
-- ทุกชุดสร้างโครงการ/ภารกิจชื่อ 'ทดสอบ RLS ควบคุมภายใน' (ปี 2569 กลุ่ม general) ในธุรกรรมของชุดนั้นเอง
-- แล้วสลับเป็นผู้ใช้จริงด้วย set local role authenticated + request.jwt.claims เหมือน facility_02
-- (ถ้าข้ามบรรทัด set local role ไป ชุดจะรันเป็นผู้ดูแลฐานข้อมูลซึ่งไม่ถูกจำกัดสิทธิ์ ผลจะผิด)
--
-- ========== ชุด 1: ทั้งสามตารางเปิด RLS และมี policy / trigger ครบ ==========
-- ผลที่ควรได้: 3 แถว — control_actions true 2 0, control_missions true 2 1, control_projects true 4 1 (คอลัมน์ rowsecurity, policies, triggers)
-- select t.tablename, t.rowsecurity,
--   (select count(*) from pg_policies p where p.schemaname = t.schemaname and p.tablename = t.tablename) as policies,
--   (select count(*) from pg_trigger g where g.tgrelid = ('public.' || t.tablename)::regclass and not g.tgisinternal) as triggers
-- from pg_tables t
-- where t.schemaname = 'public' and t.tablename in ('control_missions', 'control_projects', 'control_actions')
-- order by t.tablename;
--
-- ========== ชุด 2: ผู้ใช้ทั่วไปไม่เห็นโครงการและมาตรการของคนอื่น ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: owner_sees=1, other_sees_projects=0, other_sees_actions=0
-- select set_config('test.owner', (select id::text from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), true);
-- select set_config('test.other', (select id::text from public.profiles where email = 'ครูคนอื่น@lrp.ac.th'), true);
-- insert into public.control_projects (fiscal_year, group_key, name, owner_id) values (2569, 'general', 'ทดสอบ RLS ควบคุมภายใน', current_setting('test.owner')::uuid);
-- insert into public.control_actions (project_id, description) select id, 'มาตรการทดสอบ' from public.control_projects where name = 'ทดสอบ RLS ควบคุมภายใน';
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.owner'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- select set_config('test.owner_sees', (select count(*)::text from public.control_projects where name = 'ทดสอบ RLS ควบคุมภายใน'), true);
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.other'), 'role', 'authenticated')::text, true);
-- do $$ begin raise exception 'ผลทดสอบ: owner_sees=%, other_sees_projects=%, other_sees_actions=%', current_setting('test.owner_sees'),
--   (select count(*) from public.control_projects where name = 'ทดสอบ RLS ควบคุมภายใน'),
--   (select count(*) from public.control_actions where description = 'มาตรการทดสอบ'); end $$;
--
-- ========== ชุด 3: เจ้าของแก้คะแนนของหัวหน้า (head_likelihood) ของโครงการตัวเอง ==========
-- ผลที่ควรได้: ERROR: เจ้าของโครงการเปลี่ยนเจ้าของ ปีงบประมาณ กลุ่มงาน ภารกิจ คะแนนของหัวหน้า หรือการยืนยันไม่ได้ (เฉพาะเจ้าหน้าที่)
-- select set_config('test.owner', (select id::text from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), true);
-- insert into public.control_projects (fiscal_year, group_key, name, owner_id) values (2569, 'general', 'ทดสอบ RLS ควบคุมภายใน', current_setting('test.owner')::uuid);
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.owner'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare n int; begin
--   update public.control_projects set head_likelihood = 5 where name = 'ทดสอบ RLS ควบคุมภายใน';
--   get diagnostics n = row_count;
--   raise exception 'ผลทดสอบ: ไม่ถูกปฏิเสธ (rows_updated=%) ซึ่งผิดคาด', n; end $$;
--
-- ========== ชุด 4: เจ้าของแก้/ลบโครงการที่หัวหน้ายืนยันแล้ว (แต่ยังแก้มาตรการได้) ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: owner_sees=1, project_rows_updated=0, project_rows_deleted=0, action_rows_updated=1
-- select set_config('test.owner', (select id::text from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), true);
-- select set_config('test.head', (select id::text from public.profiles where email = 'หัวหน้าทดสอบ@lrp.ac.th'), true);
-- insert into public.control_projects (fiscal_year, group_key, name, owner_id, confirmed_at, confirmed_by) values (2569, 'general', 'ทดสอบ RLS ควบคุมภายใน', current_setting('test.owner')::uuid, now(), current_setting('test.head')::uuid);
-- insert into public.control_actions (project_id, description) select id, 'มาตรการทดสอบ' from public.control_projects where name = 'ทดสอบ RLS ควบคุมภายใน';
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.owner'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare seen int; upd int; del int; act int; begin
--   select count(*) into seen from public.control_projects where name = 'ทดสอบ RLS ควบคุมภายใน';
--   update public.control_projects set residual_risk = 'แก้โดยเจ้าของ' where name = 'ทดสอบ RLS ควบคุมภายใน';
--   get diagnostics upd = row_count;
--   delete from public.control_projects where name = 'ทดสอบ RLS ควบคุมภายใน';
--   get diagnostics del = row_count;
--   update public.control_actions set status = 'doing' where description = 'มาตรการทดสอบ';
--   get diagnostics act = row_count;
--   raise exception 'ผลทดสอบ: owner_sees=%, project_rows_updated=%, project_rows_deleted=%, action_rows_updated=%', seen, upd, del, act; end $$;
--
-- ========== ชุด 5: หัวหน้าแก้ได้ทั้งหมด (ตั้ง head ชั่วคราว) แล้วเจ้าของแก้ได้อีกหลังยกเลิกยืนยัน ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: head_rows_updated=1, head_likelihood=4, head_impact=5, mission_linked=1, still_confirmed=0, owner_rows_updated_after_unconfirm=1
-- select set_config('test.owner', (select id::text from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), true);
-- select set_config('test.head', (select id::text from public.profiles where email = 'หัวหน้าทดสอบ@lrp.ac.th'), true);
-- update public.profiles set role = 'head' where id = current_setting('test.head')::uuid;
-- insert into public.control_missions (fiscal_year, group_key, name) values (2569, 'general', 'ทดสอบ RLS ควบคุมภายใน');
-- insert into public.control_projects (fiscal_year, group_key, name, owner_id, confirmed_at, confirmed_by) values (2569, 'general', 'ทดสอบ RLS ควบคุมภายใน', current_setting('test.owner')::uuid, now(), current_setting('test.head')::uuid);
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.head'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare n int; begin
--   update public.control_projects set head_likelihood = 4, head_impact = 5, confirmed_at = null, confirmed_by = null,
--     mission_id = (select id from public.control_missions where name = 'ทดสอบ RLS ควบคุมภายใน')
--   where name = 'ทดสอบ RLS ควบคุมภายใน';
--   get diagnostics n = row_count;
--   perform set_config('test.head_rows', n::text, true); end $$;
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.owner'), 'role', 'authenticated')::text, true);
-- do $$ declare n int; begin
--   update public.control_projects set residual_risk = 'แก้โดยเจ้าของ' where name = 'ทดสอบ RLS ควบคุมภายใน';
--   get diagnostics n = row_count;
--   raise exception 'ผลทดสอบ: head_rows_updated=%, head_likelihood=%, head_impact=%, mission_linked=%, still_confirmed=%, owner_rows_updated_after_unconfirm=%',
--     current_setting('test.head_rows'),
--     (select head_likelihood from public.control_projects where name = 'ทดสอบ RLS ควบคุมภายใน'),
--     (select head_impact from public.control_projects where name = 'ทดสอบ RLS ควบคุมภายใน'),
--     (select count(*) from public.control_projects where name = 'ทดสอบ RLS ควบคุมภายใน' and mission_id is not null),
--     (select count(*) from public.control_projects where name = 'ทดสอบ RLS ควบคุมภายใน' and confirmed_at is not null),
--     n; end $$;
--
-- ========== ชุด 6: เจ้าของสร้างโครงการใหม่ — ในชื่อตัวเองได้ แต่ตั้งคะแนนหัวหน้าหรือสร้างให้คนอื่นไม่ได้ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: own_insert_rows=1, with_head_likelihood=ถูกปฏิเสธ, for_another_owner=ถูกปฏิเสธ
-- select set_config('test.owner', (select id::text from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), true);
-- select set_config('test.other', (select id::text from public.profiles where email = 'ครูคนอื่น@lrp.ac.th'), true);
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.owner'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare n int; r_head text := 'ไม่ถูกปฏิเสธ'; r_other text := 'ไม่ถูกปฏิเสธ'; begin
--   insert into public.control_projects (fiscal_year, group_key, name, owner_id) values (2569, 'general', 'ทดสอบ RLS ควบคุมภายใน', (select auth.uid()));
--   get diagnostics n = row_count;
--   begin
--     insert into public.control_projects (fiscal_year, group_key, name, owner_id, head_likelihood) values (2569, 'general', 'ทดสอบ RLS ควบคุมภายใน', (select auth.uid()), 5);
--   exception when others then r_head := 'ถูกปฏิเสธ'; end;
--   begin
--     insert into public.control_projects (fiscal_year, group_key, name, owner_id) values (2569, 'general', 'ทดสอบ RLS ควบคุมภายใน', current_setting('test.other')::uuid);
--   exception when others then r_other := 'ถูกปฏิเสธ'; end;
--   raise exception 'ผลทดสอบ: own_insert_rows=%, with_head_likelihood=%, for_another_owner=%', n, r_head, r_other; end $$;
--
-- ตรวจว่าไม่มีอะไรค้างหลังรันชุด 2-6 (ผลที่ควรได้: 0 แถว) และบัญชี หัวหน้าทดสอบ ยังมีบทบาทเดิม (ดูจาก select email, role from public.profiles)
-- select 'project' as kind, name from public.control_projects where name = 'ทดสอบ RLS ควบคุมภายใน'
-- union all select 'mission', name from public.control_missions where name = 'ทดสอบ RLS ควบคุมภายใน';
