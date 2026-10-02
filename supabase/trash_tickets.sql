-- Trash for repair tickets: only the administrator moves tickets there, restores them or deletes them for good.
-- Trashed tickets are hidden from every normal query by the restrictive policy below.
ALTER TABLE public.repair_tickets
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID; -- no foreign key: a second link to profiles would make the profiles embeds ambiguous
CREATE INDEX IF NOT EXISTS repair_tickets_deleted_idx ON public.repair_tickets (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE POLICY "tickets: hide trashed" ON public.repair_tickets AS RESTRICTIVE FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

-- Live tickets for the SECURITY DEFINER functions (which bypass row policies). Not reachable by app users.
CREATE OR REPLACE VIEW public.repair_tickets_live AS SELECT * FROM public.repair_tickets WHERE deleted_at IS NULL;
REVOKE ALL ON public.repair_tickets_live FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.similar_open_tickets(p_building UUID)
RETURNS TABLE (id UUID, ticket_number TEXT, title TEXT, location_detail TEXT, status ticket_status, created_at TIMESTAMPTZ, reporter_name TEXT, report_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.ticket_number, t.title, t.location_detail, t.status, t.created_at, p.full_name,
         1 + (SELECT count(*) FROM repair_tickets_live d WHERE d.duplicate_of = t.id)
  FROM repair_tickets_live t
  LEFT JOIN profiles p ON p.id = t.reporter_id
  WHERE auth.uid() IS NOT NULL
    AND t.building_id = p_building
    AND t.status IN ('pending', 'in_progress')
    AND t.duplicate_of IS NULL
  ORDER BY t.created_at DESC
  LIMIT 20;
$$;

CREATE OR REPLACE FUNCTION public.list_trashed_tickets()
RETURNS TABLE (id UUID, ticket_number TEXT, title TEXT, building TEXT, urgency urgency_level, status ticket_status, reporter_name TEXT,
               deleted_at TIMESTAMPTZ, deleted_by_name TEXT, memo_count BIGINT, duplicate_of_number TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.current_role_is('super_admin') THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
    SELECT t.id, t.ticket_number, t.title, b.name, t.urgency, t.status, r.full_name, t.deleted_at, d.full_name,
           (SELECT count(*) FROM memorandums m WHERE m.origin_module = 'repair' AND m.reference_id = t.id),
           t.duplicate_of_number
    FROM repair_tickets t
    JOIN buildings b ON b.id = t.building_id
    LEFT JOIN profiles r ON r.id = t.reporter_id
    LEFT JOIN profiles d ON d.id = t.deleted_by
    WHERE t.deleted_at IS NOT NULL
    ORDER BY t.deleted_at DESC;
END $$;

-- Moving a main ticket to the trash takes the reports merged into it along.
CREATE OR REPLACE FUNCTION public.trash_tickets(p_ids UUID[])
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  IF NOT public.current_role_is('super_admin') THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  UPDATE repair_tickets SET deleted_at = now(), deleted_by = auth.uid()
  WHERE deleted_at IS NULL AND (id = ANY (p_ids) OR duplicate_of = ANY (p_ids));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.restore_tickets(p_ids UUID[])
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  IF NOT public.current_role_is('super_admin') THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  UPDATE repair_tickets SET deleted_at = NULL, deleted_by = NULL
  WHERE deleted_at IS NOT NULL AND (id = ANY (p_ids) OR duplicate_of = ANY (p_ids));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.list_trashed_tickets(), public.trash_tickets(UUID[]), public.restore_tickets(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_trashed_tickets(), public.trash_tickets(UUID[]), public.restore_tickets(UUID[]) TO authenticated;
-- Apply supabase/executive_summary.sql again afterwards: it now reads repair_tickets_live.
