-- Budget deputy, part 03: the deputy sees only the repair tickets that head/staff/super_admin sent to them.
-- Run AFTER budget_deputy_02_comments.sql. Safe to run again. Then run the check block at the end.
-- Keep this order when setting up a database again: 01, 02, 03. File 02 no longer creates the read-all policies,
-- so running it again is harmless; do not bring back the old "tickets: budget deputy read all" policy.
--
-- Why a table and not a column on repair_tickets: every UPDATE of a ticket moves updated_at (touch_updated_at), and
-- the summary page reads updated_at for "done today" and the average repair time. Sharing must not disturb them.
-- The comment policies (file 02), the reporter-name policy and unread_comment_tickets() all follow which tickets the
-- caller can read, so they narrow to shared tickets by themselves once the ticket policy below changes.

-- 1. One row per shared ticket. Un-sharing deletes the row; sharing again inserts a new one.
CREATE TABLE IF NOT EXISTS public.repair_ticket_shares (
  ticket_id UUID PRIMARY KEY REFERENCES public.repair_tickets(id) ON DELETE CASCADE,
  shared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  shared_by UUID NOT NULL, -- no foreign key, same reason as assignee_id and author_id
  shared_by_name TEXT      -- a copy of the name at share time
);

ALTER TABLE public.repair_ticket_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ticket shares: read" ON public.repair_ticket_shares;
CREATE POLICY "ticket shares: read" ON public.repair_ticket_shares FOR SELECT TO authenticated
  USING (public.current_role_is('budget_deputy', 'staff', 'super_admin'));

DROP POLICY IF EXISTS "ticket shares: share" ON public.repair_ticket_shares;
CREATE POLICY "ticket shares: share" ON public.repair_ticket_shares FOR INSERT TO authenticated
  WITH CHECK (public.current_role_is('staff', 'super_admin') AND shared_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "ticket shares: unshare" ON public.repair_ticket_shares;
CREATE POLICY "ticket shares: unshare" ON public.repair_ticket_shares FOR DELETE TO authenticated
  USING (public.current_role_is('staff', 'super_admin'));

-- 2. The deputy reads only shared tickets. Replaces the read-all policy of file 02.
DROP POLICY IF EXISTS "tickets: budget deputy read all" ON public.repair_tickets;
DROP POLICY IF EXISTS "tickets: budget deputy read shared" ON public.repair_tickets;
CREATE POLICY "tickets: budget deputy read shared" ON public.repair_tickets FOR SELECT TO authenticated
  USING (public.current_role_is('budget_deputy')
         AND EXISTS (SELECT 1 FROM public.repair_ticket_shares s WHERE s.ticket_id = repair_tickets.id));

-- 3. Photos: only those of tickets the deputy can read (the subquery already sees shared tickets only).
DROP POLICY IF EXISTS "repair images: budget deputy read" ON storage.objects;
CREATE POLICY "repair images: budget deputy read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'repair-images' AND public.current_role_is('budget_deputy')
         AND EXISTS (SELECT 1 FROM public.repair_tickets t
                     WHERE storage.objects.name = ANY (t.image_urls) OR storage.objects.name = ANY (t.after_image_urls)));

-- 4. Share a ticket together with its first comment, in one transaction. SECURITY INVOKER: the policies decide who
--    may do it. Sharing a ticket that is already shared fails on the primary key (23505); a bad message fails the
--    CHECK on the comment, and then the share row is rolled back too.
CREATE OR REPLACE FUNCTION public.share_ticket_with_budget(p_ticket UUID, p_message TEXT) RETURNS VOID
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  INSERT INTO public.repair_ticket_shares (ticket_id, shared_by, shared_by_name)
  VALUES (p_ticket, (SELECT auth.uid()), (SELECT p.full_name FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
  INSERT INTO public.repair_ticket_comments (ticket_id, author_id, body)
  VALUES (p_ticket, (SELECT auth.uid()), p_message);
END $$;
REVOKE EXECUTE ON FUNCTION public.share_ticket_with_budget(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.share_ticket_with_budget(UUID, TEXT) TO authenticated;

-- =====================================================================
-- Check block. Run each query after the file above; the result should look like the comment says.
-- B to F run as a given person, inside one BEGIN ... ROLLBACK block, after
--   SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = '{"sub":"<profile id>"}';
-- Put a real ticket id in place of <ticket id>.
-- =====================================================================

-- A. The table, the function and the new policies exist, and the old read-all policy is gone. Expect: 1 table row, 1 function row,
--    5 policy rows, and 0 for the last query. The photo policy must mention image_urls.
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'repair_ticket_shares';
-- SELECT proname FROM pg_proc WHERE proname = 'share_ticket_with_budget';
-- SELECT policyname FROM pg_policies WHERE policyname LIKE 'ticket shares:%' OR policyname IN ('tickets: budget deputy read shared', 'repair images: budget deputy read');
-- SELECT count(*) FROM pg_policies WHERE policyname = 'tickets: budget deputy read all';
-- SELECT qual FROM pg_policies WHERE policyname = 'repair images: budget deputy read';

-- B. As the deputy, with nothing shared: no tickets, no comments, no photos, and no profiles other than their own. Expect: 0, 0, 0, 1.
--    (A deputy who was a teacher before still sees the tickets they reported themselves; that is the ordinary "own tickets" rule.)
-- SELECT count(*) FROM public.repair_tickets;
-- SELECT count(*) FROM public.repair_ticket_comments;
-- SELECT count(*) FROM storage.objects WHERE bucket_id = 'repair-images';
-- SELECT count(*) FROM public.profiles;

-- C. As staff, share <ticket id> with a message; then as the deputy: exactly that ticket, its first comment and its reporter. Expect: 1, 1, 2.
-- SELECT public.share_ticket_with_budget('<ticket id>'::uuid, 'ขอซื้อก๊อกน้ำ ประมาณ 2,500 บาท');
-- SELECT count(*) FROM public.repair_tickets;   -- as the deputy
-- SELECT count(*) FROM public.repair_ticket_comments;   -- as the deputy
-- SELECT count(*) FROM public.profiles;   -- as the deputy: themselves plus the reporter (1 if they reported it)

-- D. As staff, delete the share row: the deputy sees 0 tickets and 0 comments again, staff still read the comment; share again: the old thread is back.
-- DELETE FROM public.repair_ticket_shares WHERE ticket_id = '<ticket id>'::uuid;

-- E. Sharing leaves updated_at alone. Expect: the same value before and after the share.
-- SELECT updated_at FROM public.repair_tickets WHERE id = '<ticket id>'::uuid;

-- F. As staff, each statement raises an error and leaves no share row and no comment: a blank message, 1001 characters,
--    and sharing a ticket that is already shared (error 23505). An error aborts the transaction, so run each one after its
--    own SAVEPOINT and undo it with ROLLBACK TO SAVEPOINT s; then count the rows.
-- SAVEPOINT s; SELECT public.share_ticket_with_budget('<ticket id>'::uuid, '   ');  ROLLBACK TO SAVEPOINT s;
-- SAVEPOINT s; SELECT public.share_ticket_with_budget('<ticket id>'::uuid, repeat('ก', 1001));  ROLLBACK TO SAVEPOINT s;
-- SAVEPOINT s; SELECT public.share_ticket_with_budget('<ticket id>'::uuid, 'ซ้ำ');  ROLLBACK TO SAVEPOINT s;   -- after the ticket is already shared
-- SELECT count(*) FROM public.repair_ticket_shares WHERE ticket_id = '<ticket id>'::uuid;   -- 1 if it was shared before, else 0
