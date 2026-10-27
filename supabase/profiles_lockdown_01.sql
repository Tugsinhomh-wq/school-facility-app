-- Profiles lockdown: two fixes found in the review of the user-management work.
-- Run AFTER facility_02_cleaning.sql (current_role_is must already know the 'head' role) and consent_01.sql.
-- Safe to run again (DROP POLICY IF EXISTS / CREATE OR REPLACE). The whole file runs as one transaction
-- in the SQL editor: if any statement fails, none applies.
--
-- วิธีรัน: วางไฟล์นี้ทั้งไฟล์ใน SQL Editor กด Run ส่วน "ชุดตรวจสอบ" ท้ายไฟล์เป็นคอมเมนต์ทั้งหมด
-- ไม่ถูกรันไปด้วย ให้คัดลอกไปรันทีละชุดภายหลัง
--
-- 1. Nobody edits their own profile row any more.
--    The policy "profiles: update own" only protected `role`: every other column (email, full_name,
--    position, is_active, ...) could be changed by its owner through the API. The app never lets a user
--    edit their own profile (only super_admin updates profiles, via "profiles: super_admin update all"),
--    and accept_policy() (consent_01.sql) is SECURITY DEFINER, so neither needs the policy.
--    The risk it removes: profiles.email is how the app finds people (project owners, homeroom advisors,
--    Excel imports), so a user who rewrote their own email could be matched as someone else.
-- 2. A closed account (is_active = false) stops passing role checks at once.
--    Closing an account bans the sign-in at Supabase Auth, but a token issued before the ban stays valid
--    for up to about an hour. current_role_is() now also requires is_active, so within that hour the account
--    already has no staff/head/super_admin/executive powers. Policies that only compare "the row's owner is
--    me" are not affected: they work until the token expires.

-- 0. Stop early with a clear message if an earlier file has not been run yet.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_active'
  ) THEN
    RAISE EXCEPTION 'ไม่พบคอลัมน์ profiles.is_active — รันไฟล์ profiles_is_active.sql ก่อน';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = to_regprocedure('public.current_role_is(public.user_role[])')::oid
      AND p.prosrc LIKE '%head%'
  ) THEN
    RAISE EXCEPTION 'ยังไม่ได้รันไฟล์ facility_02_cleaning.sql — ฟังก์ชัน current_role_is ยังไม่รับบทบาท head (ถ้าเขียนทับตอนนี้จะทำให้ head เสียสิทธิ์)';
  END IF;
END $$;

-- =====================================================================
-- 1. No self-update of profiles
-- =====================================================================
DROP POLICY IF EXISTS "profiles: update own" ON public.profiles;

-- =====================================================================
-- 2. current_role_is ignores closed accounts
-- =====================================================================
-- Same function as facility_02_cleaning.sql section 1 (head passes every check that lists staff), plus
-- one more condition: the caller's profile must be active. COALESCE keeps a row with a NULL flag working
-- (schema.sql declares the column nullable with default true).
CREATE OR REPLACE FUNCTION public.current_role_is(VARIADIC roles public.user_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND COALESCE(p.is_active, TRUE)
      AND (p.role = ANY (roles)
           OR (p.role = 'head'::public.user_role AND 'staff'::public.user_role = ANY (roles)))
  );
$$;
REVOKE EXECUTE ON FUNCTION public.current_role_is(public.user_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_role_is(public.user_role[]) TO authenticated;

-- =====================================================================
-- 3. ชุดตรวจสอบ (CHECK BLOCK) — ทั้งหมดเป็นคอมเมนต์ ไม่ถูกรันพร้อมไฟล์
-- =====================================================================
-- วิธีใช้:
--   1) รันไฟล์นี้ให้เสร็จก่อน (ขึ้น Success)
--   2) แก้อีเมล 3 แบบนี้ให้เป็นบัญชีที่มีอยู่จริง คนละคนกัน (ใช้ Find & Replace ในหน้าจอได้):
--        เจ้าหน้าที่ทดสอบ@lrp.ac.th = บัญชี staff, head หรือ super_admin ที่ไม่ใช่ตัวคุณ (ใช้บัญชีจริงได้ ชุดตรวจจะยกเลิกทุกอย่างเอง)
--        ครูทดสอบ@lrp.ac.th        = บัญชีธรรมดา ไม่ใช่ staff/head/super_admin/executive
--        ผู้ดูแลทดสอบ@lrp.ac.th     = บัญชี super_admin
--      ดูอีเมลที่มีอยู่จริงได้ด้วย:  select email, role from public.profiles order by email;
--   3) ชุด 1 เป็นคำสั่ง select ธรรมดา ผลขึ้นเป็นตาราง
--      ชุด 2-5 คัดลอกทีละชุด เฉพาะบรรทัดคำสั่ง (ข้ามบรรทัดหัวข้อ "========== ชุด" และบรรทัด "ผลที่ควรได้")
--      ไปวางใน SQL Editor หน้าใหม่ ลบเครื่องหมาย "-- " หน้าบรรทัดออก (เลือกข้อความแล้วกด Ctrl+/ หรือ Cmd+/) แล้วกด Run
--   4) **ชุด 2-5 จบด้วยข้อความ ERROR เสมอ — ตั้งใจให้เป็นแบบนั้น** เพราะ error ทำให้ระบบยกเลิก (ROLLBACK)
--      ทุกอย่างที่ชุดนั้นทำ จึงไม่มีอะไรค้างในระบบ ข้อความขึ้นต้นด้วย "ผลทดสอบ:" ตามด้วยค่าที่วัดได้
--      ให้เทียบข้อความหลังคำว่า ERROR กับ "ผลที่ควรได้" ของชุดนั้น
--   5) ถ้าขึ้น "invalid input syntax for type uuid" แปลว่าอีเมลที่แก้ไม่ตรงกับบัญชีจริงทุกตัวอักษร
--   (ถ้าข้ามบรรทัด set local role ไป ชุดจะรันเป็นผู้ดูแลฐานข้อมูลซึ่งไม่ถูกจำกัดสิทธิ์ ผลจะผิด)
--
-- ========== ชุด 1: ไม่มีนโยบายแก้แถวตัวเองเหลืออยู่ ==========
-- ผลที่ควรได้: ไม่มีแถวชื่อ "profiles: update own" เหลืออยู่ (เหลือ "profiles: super_admin update all" แถวเดียวที่เป็น UPDATE)
-- select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'profiles' order by policyname;
--
-- ========== ชุด 2: ผู้ใช้ทั่วไปแก้โปรไฟล์ตัวเองไม่ได้ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: self_update_rows=0
-- select set_config('test.user', (select id::text from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), true);
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare n int; begin
--   update public.profiles set full_name = full_name || ' x', position = 'x', is_active = true where id = (select auth.uid());
--   get diagnostics n = row_count;
--   raise exception 'ผลทดสอบ: self_update_rows=%', n; end $$;
--
-- ========== ชุด 3: ผู้ดูแลระบบยังแก้โปรไฟล์ผู้อื่นได้ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: admin_update_rows=1
-- select set_config('test.admin', (select id::text from public.profiles where email = 'ผู้ดูแลทดสอบ@lrp.ac.th'), true);
-- select set_config('test.target', (select id::text from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), true);
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.admin'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare n int; begin
--   update public.profiles set position = position where id = current_setting('test.target')::uuid;
--   get diagnostics n = row_count;
--   raise exception 'ผลทดสอบ: admin_update_rows=%', n; end $$;
--
-- ========== ชุด 4: บัญชีเจ้าหน้าที่ที่ปิดแล้วเสียสิทธิ์ทันที และที่เปิดอยู่ยังใช้ได้ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: staff_active=true, staff_after_close=false
-- select set_config('test.staff', (select id::text from public.profiles where email = 'เจ้าหน้าที่ทดสอบ@lrp.ac.th'), true);
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.staff'), 'role', 'authenticated')::text, true);
-- do $$ declare a boolean; b boolean; begin
--   set local role authenticated;
--   a := public.current_role_is('staff', 'super_admin');
--   reset role;
--   update public.profiles set is_active = false where id = current_setting('test.staff')::uuid;
--   set local role authenticated;
--   b := public.current_role_is('staff', 'super_admin');
--   raise exception 'ผลทดสอบ: staff_active=%, staff_after_close=%', a, b; end $$;
--
-- ========== ชุด 5: ผู้ใช้ทั่วไปยังบันทึกการยอมรับนโยบายของตัวเองได้ (accept_policy ไม่พึ่งนโยบายที่ลบ) ==========
-- (ต้องรัน consent_01.sql แล้ว) ผลที่ควรได้: ERROR: ผลทดสอบ: consent_version=2569-10-27
-- select set_config('test.user', (select id::text from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), true);
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ begin
--   perform public.accept_policy('2569-10-27');
--   raise exception 'ผลทดสอบ: consent_version=%', (select consent_version from public.profiles where id = (select auth.uid())); end $$;
