-- Budget deputy, part 02 of 02: read access to repair tickets, the comment thread on each ticket,
-- and per-user "last read" markers. Run AFTER budget_deputy_01_role.sql, as a separate run. Safe to run again.
-- Then run budget_deputy_03_share.sql (what the deputy may read), executive_summary.sql again (it now admits
-- budget_deputy), then the check blocks at the end of the files.
--
-- "head" passes every check that lists 'staff' (see current_role_is in facility_02_cleaning.sql), so the thread
-- policies name budget_deputy, staff and super_admin only.

-- 1. The deputy's read access to tickets and photos is NOT created here any more. budget_deputy_03_share.sql grants it
--    only for tickets that were sent to the deputy. (An earlier version of this file created read-all policies; running
--    this file again must never bring them back, so they are gone from it.)

-- Names on tickets: only people who reported a ticket, never the whole directory.
DROP POLICY IF EXISTS "profiles: budget deputy read reporters" ON public.profiles;
CREATE POLICY "profiles: budget deputy read reporters" ON public.profiles FOR SELECT TO authenticated
  USING (public.current_role_is('budget_deputy')
         AND EXISTS (SELECT 1 FROM public.repair_tickets t WHERE t.reporter_id = profiles.id));

-- 2. The thread. author_id has no foreign key on purpose (a second link to profiles would make the
--    reporter:profiles(...) embeds ambiguous, same reason as assignee_id); author_name is a copy taken
--    at post time. Comments cannot be edited: there is no UPDATE policy. Only the administrator deletes.
CREATE TABLE IF NOT EXISTS public.repair_ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.repair_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  author_name TEXT,
  body TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS repair_ticket_comments_ticket_idx ON public.repair_ticket_comments (ticket_id, created_at);

ALTER TABLE public.repair_ticket_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ticket comments: read" ON public.repair_ticket_comments;
CREATE POLICY "ticket comments: read" ON public.repair_ticket_comments FOR SELECT TO authenticated
  USING (public.current_role_is('budget_deputy', 'staff', 'super_admin')
         AND EXISTS (SELECT 1 FROM public.repair_tickets t WHERE t.id = ticket_id));

DROP POLICY IF EXISTS "ticket comments: post" ON public.repair_ticket_comments;
CREATE POLICY "ticket comments: post" ON public.repair_ticket_comments FOR INSERT TO authenticated
  WITH CHECK (public.current_role_is('budget_deputy', 'staff', 'super_admin')
              AND author_id = (SELECT auth.uid())
              AND EXISTS (SELECT 1 FROM public.repair_tickets t WHERE t.id = ticket_id));

DROP POLICY IF EXISTS "ticket comments: administrator deletes" ON public.repair_ticket_comments;
CREATE POLICY "ticket comments: administrator deletes" ON public.repair_ticket_comments FOR DELETE TO authenticated
  USING (public.current_role_is('super_admin'));

-- The author's name is stamped from the caller's profile, so nobody can post under another name through the API.
-- A write with no signed-in user (the restore script in the SQL editor) keeps the name it carries.
CREATE OR REPLACE FUNCTION public.stamp_comment_author() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL THEN
    NEW.author_name := (SELECT p.full_name FROM public.profiles p WHERE p.id = (SELECT auth.uid()));
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.stamp_comment_author() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS repair_ticket_comments_stamp_author ON public.repair_ticket_comments;
CREATE TRIGGER repair_ticket_comments_stamp_author BEFORE INSERT ON public.repair_ticket_comments
  FOR EACH ROW EXECUTE FUNCTION public.stamp_comment_author();

-- 3. When each person last opened each ticket. Own rows only.
CREATE TABLE IF NOT EXISTS public.repair_ticket_reads (
  ticket_id UUID NOT NULL REFERENCES public.repair_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, user_id)
);

ALTER TABLE public.repair_ticket_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ticket reads: own" ON public.repair_ticket_reads;
CREATE POLICY "ticket reads: own" ON public.repair_ticket_reads FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Cleaning staff look up advisors by email and must not see executives, because an advisor row opens a class roster
-- (cleaning_staff_02_policies.sql). Replaced here so the budget deputy is hidden too; do not run the old
-- version of that policy again after this file.
DROP POLICY IF EXISTS "profiles: cleaning staff read non-executives" ON public.profiles;
CREATE POLICY "profiles: cleaning staff read non-executives" ON public.profiles FOR SELECT TO authenticated
  USING (public.current_role_is('cleaning_staff')
         AND role NOT IN ('executive'::public.user_role, 'budget_deputy'::public.user_role));

-- 4. Tickets that hold a comment from someone else newer than the caller's last read. SECURITY INVOKER on
--    purpose: the policies above decide which comments the caller can see at all.
CREATE OR REPLACE FUNCTION public.unread_comment_tickets() RETURNS SETOF UUID
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT DISTINCT c.ticket_id
  FROM public.repair_ticket_comments c
  LEFT JOIN public.repair_ticket_reads r ON r.ticket_id = c.ticket_id AND r.user_id = (SELECT auth.uid())
  WHERE c.author_id <> (SELECT auth.uid())
    AND c.created_at > COALESCE(r.last_read_at, '-infinity'::timestamptz);
$$;
REVOKE EXECUTE ON FUNCTION public.unread_comment_tickets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unread_comment_tickets() TO authenticated;

-- =====================================================================
-- Check block. Run each query after the file above; the result should look like the comment says.
-- Queries B to G run as a given person: in the SQL editor put
--   SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = '{"sub":"<profile id>"}';
-- in front of the query, inside one BEGIN ... ROLLBACK block.
-- =====================================================================

-- A. Tables, function and policies exist. Expect: 2 table rows, 2 function rows, 7 policy rows.
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('repair_ticket_comments', 'repair_ticket_reads');
-- SELECT proname FROM pg_proc WHERE proname IN ('unread_comment_tickets', 'stamp_comment_author');
-- SELECT policyname FROM pg_policies WHERE policyname LIKE 'ticket comments:%' OR policyname LIKE 'ticket reads:%' OR policyname LIKE '%budget deputy%';

-- B. As the deputy, the ticket count equals the count of tickets that are not in the trash.
-- SELECT (SELECT count(*) FROM public.repair_tickets) AS seen, (SELECT count(*) FROM public.repair_tickets_live) AS expected;  -- run the first as the deputy, the second as the administrator

-- C. As the deputy, a trashed ticket is invisible. Expect: 0.
-- SELECT count(*) FROM public.repair_tickets WHERE deleted_at IS NOT NULL;

-- D. As a user, room_staff and executive: reading the thread returns 0 rows, and this insert is refused with an RLS error.
--    Put the id of a real ticket in place of <ticket id>: these roles cannot read tickets, so a SELECT-based insert would add 0 rows without an error.
-- SELECT count(*) FROM public.repair_ticket_comments;
-- INSERT INTO public.repair_ticket_comments (ticket_id, author_id, body) VALUES ('<ticket id>'::uuid, (SELECT auth.uid()), 'x');

-- E. As the deputy, an insert that names another person as author is refused with an RLS error. After a normal insert by the deputy,
--    author_name is the deputy's profile name whatever the insert says.
-- INSERT INTO public.repair_ticket_comments (ticket_id, author_id, body) VALUES ('<ticket id>'::uuid, gen_random_uuid(), 'x');
-- INSERT INTO public.repair_ticket_comments (ticket_id, author_id, author_name, body) VALUES ('<ticket id>'::uuid, (SELECT auth.uid()), 'ชื่อปลอม', 'ทดสอบชื่อ') RETURNING author_name;  -- expect the real name

-- F. As the deputy, both inserts fail the CHECK (new row violates check constraint).
-- INSERT INTO public.repair_ticket_comments (ticket_id, author_id, body) VALUES ('<ticket id>'::uuid, (SELECT auth.uid()), '   ');
-- INSERT INTO public.repair_ticket_comments (ticket_id, author_id, body) VALUES ('<ticket id>'::uuid, (SELECT auth.uid()), repeat('ก', 1001));

-- G. The deputy posts a comment, then reads the unread list: the ticket is not in it. Run the same list as staff: the ticket is in it.
-- INSERT INTO public.repair_ticket_comments (ticket_id, author_id, body) VALUES ('<ticket id>'::uuid, (SELECT auth.uid()), 'ทดสอบ');
-- SELECT * FROM public.unread_comment_tickets();

-- H. As cleaning staff, the deputy's profile row is hidden like an executive's. Expect: 0.
-- SELECT count(*) FROM public.profiles WHERE role IN ('executive', 'budget_deputy');
