-- Repair ticket owner and history. Run once in the Supabase SQL editor, after schema.sql,
-- profiles_is_active.sql, duplicate_tickets.sql and trash_tickets.sql. Safe to run again. Run the check block at the end,
-- then merge the code that uses it.
--
-- Adds: repair_tickets.assignee_id (who is handling it), repair_tickets.completed_at (when it was closed),
-- and repair_ticket_events (who changed the status, owner or urgency, and when).

-- 1. Columns. assignee_id has no foreign key on purpose: a second link to profiles would make the
--    reporter:profiles(...) embeds in the app ambiguous (same reason as deleted_by in trash_tickets.sql).
ALTER TABLE public.repair_tickets
  ADD COLUMN IF NOT EXISTS assignee_id UUID,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS repair_tickets_assignee_idx ON public.repair_tickets (assignee_id) WHERE assignee_id IS NOT NULL;

-- 2. Existing completed tickets: the best guess for when they closed is their last update. The
--    updated_at trigger is switched off for this one statement, otherwise every completed ticket would
--    get today's date as updated_at and the dashboard's average repair time would be wrong.
--    (The editor runs this whole file as one transaction, so a failure puts the trigger back.)
ALTER TABLE public.repair_tickets DISABLE TRIGGER repair_tickets_touch;
UPDATE public.repair_tickets SET completed_at = updated_at WHERE status = 'completed' AND completed_at IS NULL;
ALTER TABLE public.repair_tickets ENABLE TRIGGER repair_tickets_touch;

-- 3. Field rules, enforced by the database whichever way a row is written:
--    - a ticket inserted by a signed-in user never starts with an owner or a completion time (teachers
--      insert their own tickets). Inserts with no signed-in user, such as scripts/restore-backup.mjs run
--      in the SQL editor, keep the values they carry, so a restore does not lose owners or close dates;
--    - an owner must be an active staff member, head or administrator;
--    - completed_at is stamped when the status becomes 'completed' and cleared when it leaves it.
CREATE OR REPLACE FUNCTION public.guard_ticket_fields() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (SELECT auth.uid()) IS NOT NULL THEN
      NEW.assignee_id := NULL;
      NEW.completed_at := NULL;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
     AND NOT EXISTS (SELECT 1 FROM public.profiles p
                     WHERE p.id = NEW.assignee_id AND p.is_active AND p.role IN ('staff', 'head', 'super_admin')) THEN
    RAISE EXCEPTION 'assignee must be an active staff member' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'completed' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_ticket_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS repair_tickets_guard_fields ON public.repair_tickets;
CREATE TRIGGER repair_tickets_guard_fields BEFORE INSERT OR UPDATE ON public.repair_tickets
  FOR EACH ROW EXECUTE FUNCTION public.guard_ticket_fields();

-- 4. The history. Rows are written only by the trigger below. The names are copied in as text because a
--    teacher cannot read other people's profiles, and a name should not change when a profile does.
CREATE TABLE IF NOT EXISTS public.repair_ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.repair_tickets(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('status', 'assignee', 'urgency')),
  from_value TEXT, -- status / urgency value, or the previous owner's name
  to_value TEXT,   -- status / urgency value, or the new owner's name (NULL = owner removed)
  actor_id UUID,
  actor_name TEXT, -- NULL when the change did not come from a signed-in user
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp() -- not now(): keeps events of one save in order
);
CREATE INDEX IF NOT EXISTS repair_ticket_events_ticket_idx ON public.repair_ticket_events (ticket_id, created_at);

ALTER TABLE public.repair_ticket_events ENABLE ROW LEVEL SECURITY;

-- Whoever can read the ticket can read its history (the ticket's own policies decide: a teacher sees
-- their own tickets, staff see all, trashed tickets are hidden). No insert, update or delete policy.
DROP POLICY IF EXISTS "ticket events: read what the ticket allows" ON public.repair_ticket_events;
CREATE POLICY "ticket events: read what the ticket allows" ON public.repair_ticket_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.repair_tickets t WHERE t.id = ticket_id));

CREATE OR REPLACE FUNCTION public.log_ticket_changes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  who UUID := (SELECT auth.uid());
  who_name TEXT;
  old_owner TEXT;
  new_owner TEXT;
BEGIN
  SELECT full_name INTO who_name FROM public.profiles WHERE id = who;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.repair_ticket_events (ticket_id, kind, from_value, to_value, actor_id, actor_name)
    VALUES (NEW.id, 'status', OLD.status::text, NEW.status::text, who, who_name);
  END IF;
  IF NEW.urgency IS DISTINCT FROM OLD.urgency THEN
    INSERT INTO public.repair_ticket_events (ticket_id, kind, from_value, to_value, actor_id, actor_name)
    VALUES (NEW.id, 'urgency', OLD.urgency::text, NEW.urgency::text, who, who_name);
  END IF;
  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    SELECT full_name INTO old_owner FROM public.profiles WHERE id = OLD.assignee_id;
    SELECT full_name INTO new_owner FROM public.profiles WHERE id = NEW.assignee_id;
    INSERT INTO public.repair_ticket_events (ticket_id, kind, from_value, to_value, actor_id, actor_name)
    VALUES (NEW.id, 'assignee', old_owner, new_owner, who, who_name);
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.log_ticket_changes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS repair_tickets_log_changes ON public.repair_tickets;
CREATE TRIGGER repair_tickets_log_changes AFTER UPDATE ON public.repair_tickets
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status
                  OR OLD.urgency IS DISTINCT FROM NEW.urgency
                  OR OLD.assignee_id IS DISTINCT FROM NEW.assignee_id)
  EXECUTE FUNCTION public.log_ticket_changes();

-- =====================================================================
-- Check block. Run it after the file above; each query should look like the comment says.
-- =====================================================================

-- A. Both columns exist, and every completed ticket has a completion time. Expect: 2 rows; missing = 0.
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'repair_tickets' AND column_name IN ('assignee_id', 'completed_at');
-- SELECT count(*) FILTER (WHERE status = 'completed' AND completed_at IS NULL) AS missing FROM public.repair_tickets;

-- B. The two triggers and the history policy exist. Expect: 2 trigger rows, 1 policy row.
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.repair_tickets'::regclass AND tgname IN ('repair_tickets_guard_fields', 'repair_tickets_log_changes');
-- SELECT policyname FROM pg_policies WHERE tablename = 'repair_ticket_events';

-- C. Behaviour test that undoes itself: closes one ticket, then reads what the triggers did, then raises an
--    error on purpose so nothing is kept. Expect an ERROR whose message reads
--    "ผลทดสอบ: completed_at_set=t, events=1". Needs at least one ticket that is not completed.
-- DO $$
-- DECLARE tid UUID; done_at TIMESTAMPTZ; n INT;
-- BEGIN
--   SELECT id INTO tid FROM public.repair_tickets WHERE status <> 'completed' AND duplicate_of IS NULL ORDER BY created_at LIMIT 1;
--   IF tid IS NULL THEN RAISE EXCEPTION 'ผลทดสอบ: ไม่มีงานที่ยังไม่ปิดให้ทดสอบ'; END IF;
--   UPDATE public.repair_tickets SET status = 'completed' WHERE id = tid;
--   SELECT completed_at INTO done_at FROM public.repair_tickets WHERE id = tid;
--   SELECT count(*) INTO n FROM public.repair_ticket_events WHERE ticket_id = tid AND kind = 'status' AND to_value = 'completed';
--   RAISE EXCEPTION 'ผลทดสอบ: completed_at_set=%, events=%', done_at IS NOT NULL, n;
-- END $$;
