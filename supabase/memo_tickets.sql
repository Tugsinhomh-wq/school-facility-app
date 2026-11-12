-- บันทึกข้อความขอซ่อมแซมรวมหลายงาน (อาคารเดียวกัน) เสนอผู้อำนวยการครั้งเดียว
-- ตาราง memo_tickets ผูกบันทึกหนึ่งฉบับกับหลายงานซ่อม และฟังก์ชัน create_combined_repair_memo
-- สร้างบันทึก + ลิงก์ใน transaction เดียว ถ้าเงื่อนไขข้อใดไม่ผ่านจะไม่สร้างอะไรเลย
-- บันทึกเดี่ยวเดิม (memorandums.reference_id) ไม่เปลี่ยน
-- รันซ้ำได้ปลอดภัย: IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS
-- วิธีรัน: วางไฟล์นี้ใน Supabase SQL Editor แล้วกด Run (ต้องรันก่อน merge โค้ดที่อ่านตารางนี้)

CREATE TABLE IF NOT EXISTS public.memo_tickets (
  memo_id   UUID NOT NULL REFERENCES public.memorandums(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES public.repair_tickets(id) ON DELETE CASCADE,
  position  INT  NOT NULL CHECK (position >= 1),
  PRIMARY KEY (memo_id, ticket_id),
  -- one ticket belongs to at most one combined memo (also stops two people combining it at once)
  UNIQUE (ticket_id)
);

ALTER TABLE public.memo_tickets ENABLE ROW LEVEL SECURITY;

-- Same people as the memorandums policies: staff (head counts as staff) and the administrator.
-- No UPDATE/DELETE policy on purpose: links go away with their memo (ON DELETE CASCADE).
DROP POLICY IF EXISTS "memo_tickets: staff read" ON public.memo_tickets;
CREATE POLICY "memo_tickets: staff read" ON public.memo_tickets FOR SELECT TO authenticated
  USING (public.current_role_is('staff', 'super_admin'));
DROP POLICY IF EXISTS "memo_tickets: staff create" ON public.memo_tickets;
CREATE POLICY "memo_tickets: staff create" ON public.memo_tickets FOR INSERT TO authenticated
  WITH CHECK (public.current_role_is('staff', 'super_admin'));

GRANT SELECT, INSERT ON public.memo_tickets TO authenticated;

-- Creates one repair memo covering 2-20 open tickets of one building. Runs as the caller (SECURITY
-- INVOKER), so row policies still apply: a ticket in the trash is hidden and counts as missing.
-- Errors are the codes below; a clash with someone combining the same ticket at the same moment
-- surfaces as unique_violation (23505) and rolls everything back.
CREATE OR REPLACE FUNCTION public.create_combined_repair_memo(
  p_ticket_ids UUID[], p_subject TEXT, p_recipient TEXT, p_body TEXT, p_proposal TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  ids UUID[];
  n INT;
  found_n INT;
  building_n INT;
  open_n INT;
  new_id UUID;
BEGIN
  IF NOT public.current_role_is('staff', 'super_admin') THEN
    RAISE EXCEPTION 'not_staff' USING ERRCODE = '42501';
  END IF;

  SELECT array_agg(DISTINCT x) INTO ids FROM unnest(p_ticket_ids) AS x;
  n := COALESCE(cardinality(ids), 0);
  IF n < 2 OR n > 20 THEN
    RAISE EXCEPTION 'count_range';
  END IF;

  SELECT count(*), count(DISTINCT building_id), count(*) FILTER (WHERE status IN ('pending', 'in_progress'))
    INTO found_n, building_n, open_n
  FROM repair_tickets WHERE id = ANY (ids);
  IF found_n <> n THEN RAISE EXCEPTION 'missing_ticket'; END IF;
  IF building_n <> 1 THEN RAISE EXCEPTION 'mixed_buildings'; END IF;
  IF open_n <> n THEN RAISE EXCEPTION 'not_open'; END IF;

  IF EXISTS (SELECT 1 FROM memo_tickets WHERE ticket_id = ANY (ids))
     OR EXISTS (SELECT 1 FROM memorandums WHERE origin_module = 'repair' AND reference_id = ANY (ids)) THEN
    RAISE EXCEPTION 'already_has_memo';
  END IF;

  -- doc_ref_no '' lets the existing trigger issue MEMO-YYYYMM-XXXX until the records office numbers it.
  INSERT INTO memorandums (doc_ref_no, origin_module, reference_id, author_id, subject, recipient, body_content, proposal, approval_mode)
  VALUES ('', 'repair', NULL, auth.uid(), p_subject, p_recipient, p_body, COALESCE(p_proposal, ''), 'paper_hybrid')
  RETURNING id INTO new_id;

  INSERT INTO memo_tickets (memo_id, ticket_id, position)
  SELECT new_id, t.id, (row_number() OVER (ORDER BY t.created_at, t.id))::INT
  FROM repair_tickets t WHERE t.id = ANY (ids);

  RETURN new_id;
END $$;

REVOKE ALL ON FUNCTION public.create_combined_repair_memo(UUID[], TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_combined_repair_memo(UUID[], TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- CHECK BLOCK (ไม่ได้รันอัตโนมัติ) — รันใน SQL Editor ด้วยผู้ใช้เจ้าหน้าที่จริง หรือจำลองสิทธิ์:
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<uuid ของเจ้าหน้าที่>","role":"authenticated"}';
-- ใช้ id งานซ่อมจริง: A1, A2 = งานเปิดอยู่ในอาคารเดียวกัน; B1 = งานเปิดอยู่ในอาคารอื่น;
-- C1 = งานที่ completed/cancelled; D1 = งานที่มีบันทึกเดี่ยวอยู่แล้ว
--
-- 1) รวม 1 งาน               select create_combined_repair_memo(array['A1']::uuid[], 's','r','b','');  → error count_range
-- 2) รวมต่างอาคาร             ... array['A1','B1'] ...                                                     → error mixed_buildings
-- 3) รวมงานที่ปิดแล้ว          ... array['A1','C1'] ...                                                     → error not_open
-- 4) รวมงานที่มีบันทึกเดี่ยว    ... array['A1','D1'] ...                                                     → error already_has_memo
-- 5) id ที่ไม่มีอยู่/ในถังขยะ    ... array['A1', gen_random_uuid()] ...                                       → error missing_ticket
-- 6) สำเร็จ                   select create_combined_repair_memo(array['A1','A2']::uuid[], 's','r','b',''); → ได้ uuid 1 ตัว
--      select * from memo_tickets where memo_id = '<uuid>' order by position;  → 2 แถว position 1, 2
--      select doc_ref_no, origin_module, reference_id from memorandums where id = '<uuid>';  → MEMO-…, repair, NULL
-- 7) รวมซ้ำงานเดิมอีกครั้ง      select create_combined_repair_memo(array['A1','A2']::uuid[], ...);          → error already_has_memo
--      (ถ้าสองคนกดพร้อมกันจริง ผู้แพ้ได้ unique_violation 23505 และไม่เหลือบันทึกค้าง)
-- 8) ลบบันทึก (service role: delete from memorandums where id = '<uuid>');
--      select count(*) from memo_tickets where memo_id = '<uuid>';  → 0  แล้ว A1, A2 รวมใหม่ได้
-- 9) ผู้ใช้ทั่วไป (role user)    → error not_staff (42501)
-- ---------------------------------------------------------------------------
