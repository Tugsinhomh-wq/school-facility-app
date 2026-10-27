-- Policy-consent gate (หน้ายอมรับนโยบาย): records which version of the privacy policy and terms each user
-- accepted. Run AFTER census_01.sql (it needs only schema.sql, but keep the order in README).
-- Everything here only adds; nothing existing is dropped or narrowed. Safe to run again
-- (ADD COLUMN IF NOT EXISTS / CREATE OR REPLACE). The whole file runs as one transaction in the SQL editor.
--
-- วิธีรัน: วางไฟล์นี้ทั้งไฟล์ใน SQL Editor กด Run ส่วน "ชุดตรวจสอบ" ท้ายไฟล์เป็นคอมเมนต์ทั้งหมด ไม่ถูกรันไปด้วย ให้คัดลอกไปรันทีละชุดภายหลัง
-- ควรรันก่อน deploy โค้ดหน้ายอมรับนโยบาย แต่ถ้ายังไม่ได้รัน ระบบจะปล่อยผ่าน (gate fails open) ไม่มีใครถูกถาม และไม่มีอะไรพัง
-- (แล้วแต่รันไฟล์นี้เมื่อไรผู้ใช้ทุกคนจะถูกถามหนึ่งครั้งในการเข้าใช้งานครั้งถัดไป)
--
-- Who may do what:
--   The RPC accept_policy(p_version) lets any signed-in user stamp consent_version and consented_at on their OWN
--   profile row, and nothing else. No policy on profiles changes: "profiles: update own" still refuses a role
--   change (WITH CHECK role = current_user_role()), and there is no other trigger on profiles apart from
--   profiles_touch (BEFORE UPDATE, sets updated_at only), which is fine for this update.
--   The gate in the app is a consent record and a UX step, not an authorization boundary.

-- 0. Stop early with a clear message if schema.sql has not been run.
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'ไม่พบตาราง public.profiles (อยู่ใน schema.sql)';
  END IF;
END $$;

-- =====================================================================
-- 1. Columns
--    consent_version is the POLICY_VERSION of src/lib/policy.ts that the user accepted, e.g. '2569-10-27'.
--    Users who signed up by email already carry the version in their auth metadata; those profiles stay
--    NULL here until the user next accepts (the app treats the metadata as accepted too).
-- =====================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consent_version TEXT,
  ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ;

-- =====================================================================
-- 2. RPC: record the caller's acceptance
--    SECURITY DEFINER so no self-update policy has to be widened; it writes only the two columns above for
--    auth.uid(), so the caller can never touch another row or any other column (role included).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.accept_policy(p_version TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid UUID := (SELECT auth.uid());
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'ต้องเข้าสู่ระบบก่อน' USING ERRCODE = '28000';
  END IF;
  IF p_version IS NULL OR p_version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RAISE EXCEPTION 'รูปแบบเวอร์ชันนโยบายไม่ถูกต้อง' USING ERRCODE = '22023';
  END IF;
  UPDATE public.profiles
     SET consent_version = p_version, consented_at = now()
   WHERE id = uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ไม่พบโปรไฟล์ผู้ใช้' USING ERRCODE = 'P0002';
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.accept_policy(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_policy(TEXT) TO authenticated;

-- =====================================================================
-- ชุดตรวจสอบ (check sets): คอมเมนต์ทั้งหมด คัดลอกไปรันทีละชุดใน SQL Editor
-- แต่ละชุดจบด้วย ERROR ตั้งใจ (raise exception) เพื่อให้ rollback ไม่ทิ้งอะไรไว้ในฐานข้อมูล
-- แทนอีเมลทดสอบ 'ครูทดสอบ@lrp.ac.th' และ 'ครูอื่นทดสอบ@lrp.ac.th' ด้วยบัญชี role = user สองบัญชีที่มีอยู่จริง
-- =====================================================================
--
-- ========== ชุด 1: ผู้ใช้ทั่วไปเรียกได้ เปลี่ยนเฉพาะสองคอลัมน์ role ไม่เปลี่ยน แถวคนอื่นไม่ถูกแตะ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: version=2569-10-27, consented_at_set=true, role_unchanged=true, other_untouched=true
-- select set_config('test.user', (select id::text from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), true);
-- select set_config('test.other', (select id::text from public.profiles where email = 'ครูอื่นทดสอบ@lrp.ac.th'), true);
-- select set_config('test.role_before', (select role::text from public.profiles where id = current_setting('test.user')::uuid), true);
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare v text; ts boolean; same_role boolean; untouched boolean; begin
--   perform public.accept_policy('2569-10-27');
--   select consent_version, consented_at is not null, role::text = current_setting('test.role_before')
--     into v, ts, same_role from public.profiles where id = current_setting('test.user')::uuid;
--   -- the caller cannot read other rows under RLS (a plain user sees only their own), so check as the owner afterwards
--   reset role;
--   select consent_version is null and consented_at is null into untouched
--     from public.profiles where id = current_setting('test.other')::uuid;
--   raise exception 'ผลทดสอบ: version=%, consented_at_set=%, role_unchanged=%, other_untouched=%', v, ts, same_role, untouched; end $$;
--
-- ========== ชุด 2: anon เรียกไม่ได้ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: anon=ถูกปฏิเสธ
-- set local role anon;
-- do $$ declare r text := 'ไม่ถูกปฏิเสธ'; begin
--   begin
--     perform public.accept_policy('2569-10-27');
--   exception when insufficient_privilege then r := 'ถูกปฏิเสธ'; end;
--   raise exception 'ผลทดสอบ: anon=%', r; end $$;
--
-- ========== ชุด 3: รูปแบบเวอร์ชันผิดถูกปฏิเสธ และไม่มีอะไรถูกเขียน ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: empty=ถูกปฏิเสธ, text=ถูกปฏิเสธ, injection=ถูกปฏิเสธ, null=ถูกปฏิเสธ, version_still_null=true
-- select set_config('test.user', (select id::text from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), true);
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare a text := 'ไม่ถูกปฏิเสธ'; b text := 'ไม่ถูกปฏิเสธ'; c text := 'ไม่ถูกปฏิเสธ'; d text := 'ไม่ถูกปฏิเสธ'; still_null boolean; begin
--   begin perform public.accept_policy(''); exception when sqlstate '22023' then a := 'ถูกปฏิเสธ'; end;
--   begin perform public.accept_policy('latest'); exception when sqlstate '22023' then b := 'ถูกปฏิเสธ'; end;
--   begin perform public.accept_policy('2569-10-27; drop table x'); exception when sqlstate '22023' then c := 'ถูกปฏิเสธ'; end;
--   begin perform public.accept_policy(null); exception when sqlstate '22023' then d := 'ถูกปฏิเสธ'; end;
--   select consent_version is null into still_null from public.profiles where id = current_setting('test.user')::uuid;
--   raise exception 'ผลทดสอบ: empty=%, text=%, injection=%, null=%, version_still_null=%', a, b, c, d, still_null; end $$;
--   (ถ้าบัญชีทดสอบเคยยอมรับแล้ว version_still_null จะเป็น false: ให้ดูว่าค่าไม่เปลี่ยนจากก่อนรันแทน)
--
-- ========== ชุด 4: เรียกแล้วกระทบได้เฉพาะแถวของตัวเอง (ไม่มีพารามิเตอร์ระบุผู้ใช้) และยังแก้ role ตัวเองตรงๆ ไม่ได้ ==========
-- ผลที่ควรได้: ERROR: ผลทดสอบ: other_row_changed=false, direct_role_update_rows=0
-- select set_config('test.user', (select id::text from public.profiles where email = 'ครูทดสอบ@lrp.ac.th'), true);
-- select set_config('test.other', (select id::text from public.profiles where email = 'ครูอื่นทดสอบ@lrp.ac.th'), true);
-- select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.user'), 'role', 'authenticated')::text, true);
-- set local role authenticated;
-- do $$ declare changed boolean; upd int; begin
--   perform public.accept_policy('2569-10-27');
--   reset role;
--   select consent_version is not null into changed from public.profiles where id = current_setting('test.other')::uuid;
--   set local role authenticated;
--   begin
--     update public.profiles set role = 'super_admin' where id = current_setting('test.user')::uuid;
--     get diagnostics upd = row_count;
--   exception when others then upd := 0; end;
--   raise exception 'ผลทดสอบ: other_row_changed=%, direct_role_update_rows=%', changed, upd; end $$;
--   (ถ้าบัญชี "อื่น" เคยยอมรับแล้ว other_row_changed จะเป็น true อยู่ก่อน: ให้เทียบกับค่าก่อนรัน)
--
-- ตรวจว่าไม่มีอะไรค้าง: ทุกชุดจบด้วย ERROR จึง rollback ทั้งหมด ผลที่ควรได้ของคำสั่งนี้คือค่าเดิมก่อนรันชุดทดสอบ
-- select email, role, consent_version, consented_at from public.profiles where email in ('ครูทดสอบ@lrp.ac.th', 'ครูอื่นทดสอบ@lrp.ac.th');
