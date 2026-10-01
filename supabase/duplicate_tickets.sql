-- Duplicate repair reports.
-- A report that repeats an open ticket is linked to it (duplicate_of). The link copies the main
-- ticket's number and mirrors its status, so the teacher who filed it sees real progress.
-- Staff queues and statistics skip rows where duplicate_of is set. Existing data is untouched.

ALTER TABLE repair_tickets
  ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES repair_tickets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duplicate_of_number TEXT;

ALTER TABLE repair_tickets
  ADD CONSTRAINT repair_tickets_not_own_duplicate CHECK (duplicate_of IS NULL OR duplicate_of <> id);

CREATE INDEX IF NOT EXISTS repair_tickets_duplicate_idx ON repair_tickets (duplicate_of) WHERE duplicate_of IS NOT NULL;

-- On link: validate the target, copy its number, take its status. Runs as owner so a teacher can
-- link to a ticket they cannot read; a new report may only join a ticket that is still open.
CREATE OR REPLACE FUNCTION sync_duplicate_link() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m RECORD;
BEGIN
  IF NEW.duplicate_of IS NULL THEN
    NEW.duplicate_of_number := NULL;
    RETURN NEW;
  END IF;
  SELECT ticket_number, status, duplicate_of, building_id INTO m FROM repair_tickets WHERE id = NEW.duplicate_of;
  IF NOT FOUND OR m.duplicate_of IS NOT NULL THEN
    RAISE EXCEPTION 'invalid duplicate target';
  END IF;
  IF TG_OP = 'INSERT' AND m.status NOT IN ('pending', 'in_progress') THEN
    RAISE EXCEPTION 'ticket is already closed';
  END IF;
  NEW.duplicate_of_number := m.ticket_number;
  NEW.status := m.status;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS repair_tickets_sync_duplicate ON repair_tickets;
CREATE TRIGGER repair_tickets_sync_duplicate BEFORE INSERT OR UPDATE OF duplicate_of ON repair_tickets
  FOR EACH ROW EXECUTE FUNCTION sync_duplicate_link();

-- When the main ticket's status changes, linked reports follow.
CREATE OR REPLACE FUNCTION mirror_duplicate_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE repair_tickets SET status = NEW.status WHERE duplicate_of = NEW.id AND status IS DISTINCT FROM NEW.status;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS repair_tickets_mirror_status ON repair_tickets;
CREATE TRIGGER repair_tickets_mirror_status AFTER UPDATE OF status ON repair_tickets
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.duplicate_of IS NULL)
  EXECUTE FUNCTION mirror_duplicate_status();

-- The open tickets in a building, with who reported them, so a teacher can see a likely duplicate
-- before sending. Signed-in users only.
CREATE OR REPLACE FUNCTION similar_open_tickets(p_building UUID)
RETURNS TABLE (id UUID, ticket_number TEXT, title TEXT, location_detail TEXT, status ticket_status, created_at TIMESTAMPTZ, reporter_name TEXT, report_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.ticket_number, t.title, t.location_detail, t.status, t.created_at, p.full_name,
         1 + (SELECT count(*) FROM repair_tickets d WHERE d.duplicate_of = t.id)
  FROM repair_tickets t
  LEFT JOIN profiles p ON p.id = t.reporter_id
  WHERE auth.uid() IS NOT NULL
    AND t.building_id = p_building
    AND t.status IN ('pending', 'in_progress')
    AND t.duplicate_of IS NULL
  ORDER BY t.created_at DESC
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION similar_open_tickets(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION similar_open_tickets(UUID) TO authenticated;
REVOKE ALL ON FUNCTION sync_duplicate_link() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mirror_duplicate_status() FROM PUBLIC, anon, authenticated;
