-- Budget deputy, part 04: close the last way to read tickets that were not sent to the deputy.
-- Run AFTER budget_deputy_03_share.sql. Safe to run again. Then run the check block at the end.
--
-- similar_open_tickets() (duplicate_tickets.sql / trash_tickets.sql) is SECURITY DEFINER and open to every signed-in
-- user, so the deputy could list titles, places and reporter names of every open ticket in a building through the API.
-- It now returns nothing to the deputy; for everyone else it is exactly the same as before (same columns, same filters).
-- Do not run trash_tickets.sql again after this file: it defines the old version of this function.
CREATE OR REPLACE FUNCTION public.similar_open_tickets(p_building UUID)
RETURNS TABLE (id UUID, ticket_number TEXT, title TEXT, location_detail TEXT, status ticket_status, created_at TIMESTAMPTZ, reporter_name TEXT, report_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.ticket_number, t.title, t.location_detail, t.status, t.created_at, p.full_name,
         1 + (SELECT count(*) FROM repair_tickets_live d WHERE d.duplicate_of = t.id)
  FROM repair_tickets_live t
  LEFT JOIN profiles p ON p.id = t.reporter_id
  WHERE auth.uid() IS NOT NULL
    AND NOT public.current_role_is('budget_deputy')
    AND t.building_id = p_building
    AND t.status IN ('pending', 'in_progress')
    AND t.duplicate_of IS NULL
  ORDER BY t.created_at DESC
  LIMIT 20;
$$;

-- =====================================================================
-- Check block. Put a real building id in place of <building id> (one that has open tickets).
-- Run each as the given person: SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = '{"sub":"<profile id>"}';
-- =====================================================================

-- A. As the deputy: 0 rows. As a teacher or staff: the open tickets of that building, as before.
-- SELECT count(*) FROM public.similar_open_tickets('<building id>'::uuid);

-- B. The same function is the one in use (the body mentions budget_deputy). Expect: true.
-- SELECT pg_get_functiondef('public.similar_open_tickets(uuid)'::regprocedure) LIKE '%budget_deputy%';
