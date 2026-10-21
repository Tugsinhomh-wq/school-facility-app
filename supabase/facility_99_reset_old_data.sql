-- ============================================================
-- facility_99_reset_old_data.sql  (รันตอนสลับขึ้นระบบจริงเท่านั้น)
-- ล้างข้อมูลเก่า/ข้อมูลทดลอง "เฉพาะแถวข้อมูล" ตารางยังอยู่ครบ
-- ============================================================
-- ก่อนรัน:
--   1) สำรองข้อมูลก่อนทุกครั้ง: เปิด /api/cron/backup (ต้องมี CRON_SECRET) แล้วเก็บไฟล์ไว้
--   2) ลบแล้วย้อนกลับไม่ได้ ตรวจตัวเลขด้านล่างก่อน
--
-- ตรวจจำนวนแถวที่จะถูกลบ (เอา -- ออกแล้วรันทีละบรรทัด หรือรันทั้งก้อนนี้ก่อน):
-- select 'repair_tickets'       as ตาราง, count(*) from public.repair_tickets
-- union all select 'facility_reservations', count(*) from public.facility_reservations
-- union all select 'memorandums',           count(*) from public.memorandums
-- union all select 'approval_records',      count(*) from public.approval_records
-- union all select 'feedback',              count(*) from public.feedback
-- union all select 'push_subscriptions',    count(*) from public.push_subscriptions;
--
-- ไม่แตะ: profiles (บัญชีผู้ใช้), buildings, rooms, ตารางงานเวรทำความสะอาดใหม่ 4 ตาราง
-- (classrooms, classroom_advisors, school_off_days, cleaning_confirmations),
-- และ environment_inspections
-- ============================================================

begin;

-- งานแจ้งซ่อม (ลิงก์ "ซ้ำกับงานอื่น" duplicate_of เป็น FK ในตารางเดียวกัน
-- ลบทั้งตารางพร้อมกันจึงไม่ติด)
delete from public.repair_tickets;

-- การจองห้อง
delete from public.facility_reservations;

-- บันทึกข้อความ: approval_records ถูกลบตามอัตโนมัติ (ON DELETE CASCADE)
-- หมายเหตุ: memorandums.reference_id ชี้ไปที่งานซ่อม/การจองโดยไม่มี FK
-- จึงต้องลบบันทึกข้อความเองด้วย ไม่งั้นจะเหลือบันทึกที่ไม่มีต้นเรื่อง
delete from public.memorandums;

-- ข้อเสนอแนะจากผู้ใช้
delete from public.feedback;

-- การสมัครรับแจ้งเตือน Push (ระบบ Web Push ถูกถอดออกแล้ว)
delete from public.push_subscriptions;

commit;

-- ============================================================
-- ไฟล์รูปใน Storage (SQL นี้ไม่ลบไฟล์ให้) ถ้าต้องการล้าง ให้เข้า
-- Supabase > Storage แล้วเลือกลบไฟล์เองได้ที่ bucket เหล่านี้:
--   - repair-images    รูปแจ้งซ่อม/รูปหลังซ่อม (หลังลบงานซ่อมแล้วจะไม่มีงานอ้างถึง)
--   - feedback-images  รูปแนบข้อเสนอแนะ
-- ห้ามล้าง cleaning-photos ถ้ามีรูปยืนยันงานเวรจริงที่ต้องเก็บ
-- ============================================================
