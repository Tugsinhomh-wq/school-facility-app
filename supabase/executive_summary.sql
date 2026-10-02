-- Aggregated figures for the executive summary page. SECURITY DEFINER so executives need no
-- access to the tables themselves: they only ever receive counts, hours and place names,
-- never reporters, applicants, ticket text or reservation purposes.
-- Allowed callers: executive, super_admin, staff (staff use it to draft the summary memo).
CREATE OR REPLACE FUNCTION public.executive_summary(p_from timestamptz, p_to timestamptz, p_bucket text DEFAULT 'day')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  tz constant text := 'Asia/Bangkok';
  day_start timestamptz := date_trunc('day', now() AT TIME ZONE tz) AT TIME ZONE tz;
  span interval := p_to - p_from;
  prev_from timestamptz := p_from - (p_to - p_from);
  bucket text := CASE WHEN p_bucket = 'month' THEN 'month' ELSE 'day' END;
  result jsonb;
BEGIN
  IF NOT public.current_role_is('executive', 'super_admin', 'staff') THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_to <= p_from OR span > interval '400 days' THEN
    RAISE EXCEPTION 'invalid range';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'today', jsonb_build_object(
      'open_pending',     (SELECT count(*) FROM public.repair_tickets_live WHERE status = 'pending' AND duplicate_of IS NULL),
      'open_in_progress', (SELECT count(*) FROM public.repair_tickets_live WHERE status = 'in_progress' AND duplicate_of IS NULL),
      'open_emergency',   (SELECT count(*) FROM public.repair_tickets_live WHERE status IN ('pending','in_progress') AND urgency = 'emergency' AND duplicate_of IS NULL),
      'new_today',        (SELECT count(*) FROM public.repair_tickets_live WHERE created_at >= day_start AND duplicate_of IS NULL),
      'done_today',       (SELECT count(*) FROM public.repair_tickets_live WHERE status = 'completed' AND updated_at >= day_start AND duplicate_of IS NULL),
      'rooms_total',      (SELECT count(*) FROM public.rooms WHERE is_bookable),
      'rooms_busy_now',   (SELECT count(DISTINCT room_id) FROM public.facility_reservations WHERE status = 'approved' AND now() BETWEEN start_time AND end_time),
      'meetings_today',   (SELECT count(*) FROM public.facility_reservations WHERE status = 'approved' AND start_time >= day_start AND start_time < day_start + interval '1 day'),
      'reservations_pending', (SELECT count(*) FROM public.facility_reservations WHERE status = 'pending' AND end_time > now()),
      'oldest_open', COALESCE((
        SELECT jsonb_agg(x) FROM (
          SELECT b.name AS building, COALESCE(r.name, t.location_detail) AS place, t.urgency, t.status,
                 floor(extract(epoch FROM now() - t.created_at) / 86400)::int AS age_days
          FROM public.repair_tickets_live t
          JOIN public.buildings b ON b.id = t.building_id
          LEFT JOIN public.rooms r ON r.id = t.room_id
          WHERE t.status IN ('pending','in_progress') AND t.duplicate_of IS NULL
          ORDER BY t.created_at LIMIT 5
        ) x), '[]'::jsonb)
    ),
    'repairs', jsonb_build_object(
      'total',      (SELECT count(*) FROM public.repair_tickets_live WHERE created_at >= p_from AND created_at < p_to AND duplicate_of IS NULL),
      'total_prev', (SELECT count(*) FROM public.repair_tickets_live WHERE created_at >= prev_from AND created_at < p_from AND duplicate_of IS NULL),
      'reports',    (SELECT count(*) FROM public.repair_tickets_live WHERE created_at >= p_from AND created_at < p_to),
      'completed',  (SELECT count(*) FROM public.repair_tickets_live WHERE created_at >= p_from AND created_at < p_to AND duplicate_of IS NULL AND status = 'completed'),
      'cancelled',  (SELECT count(*) FROM public.repair_tickets_live WHERE created_at >= p_from AND created_at < p_to AND duplicate_of IS NULL AND status = 'cancelled'),
      'open',       (SELECT count(*) FROM public.repair_tickets_live WHERE created_at >= p_from AND created_at < p_to AND duplicate_of IS NULL AND status IN ('pending','in_progress')),
      'emergency',  (SELECT count(*) FROM public.repair_tickets_live WHERE created_at >= p_from AND created_at < p_to AND duplicate_of IS NULL AND urgency = 'emergency'),
      -- Repair time: from report to completion, for jobs reported in the period and completed.
      'avg_hours', (SELECT round((avg(extract(epoch FROM updated_at - created_at) / 3600))::numeric, 1)
                    FROM public.repair_tickets_live WHERE created_at >= p_from AND created_at < p_to AND duplicate_of IS NULL AND status = 'completed'),
      -- On time: emergency within 1 day, high 3, medium 7, low 14.
      'on_time_pct', (SELECT CASE WHEN count(*) = 0 THEN NULL ELSE round(100.0 * count(*) FILTER (WHERE extract(epoch FROM updated_at - created_at) / 3600 <=
                        CASE urgency WHEN 'emergency' THEN 24 WHEN 'high' THEN 72 WHEN 'medium' THEN 168 ELSE 336 END) / count(*), 0) END
                      FROM public.repair_tickets_live WHERE created_at >= p_from AND created_at < p_to AND duplicate_of IS NULL AND status = 'completed'),
      'by_building', COALESCE((
        SELECT jsonb_agg(x ORDER BY (x->>'total')::int DESC) FROM (
          SELECT jsonb_build_object('name', b.name, 'total', count(*), 'open', count(*) FILTER (WHERE t.status IN ('pending','in_progress'))) AS x
          FROM public.repair_tickets_live t JOIN public.buildings b ON b.id = t.building_id
          WHERE t.created_at >= p_from AND t.created_at < p_to AND t.duplicate_of IS NULL
          GROUP BY b.id, b.name ORDER BY count(*) DESC LIMIT 8
        ) s), '[]'::jsonb),
      'repeat_spots', COALESCE((
        SELECT jsonb_agg(x) FROM (
          SELECT jsonb_build_object('building', b.name, 'place', COALESCE(r.name, 'ไม่ระบุห้อง'), 'reports', count(*)) AS x
          FROM public.repair_tickets_live t JOIN public.buildings b ON b.id = t.building_id LEFT JOIN public.rooms r ON r.id = t.room_id
          WHERE t.created_at >= p_from AND t.created_at < p_to
          GROUP BY b.id, b.name, r.id, r.name HAVING count(*) >= 2 ORDER BY count(*) DESC LIMIT 5
        ) s), '[]'::jsonb)
    ),
    'rooms', jsonb_build_object(
      'total',      (SELECT count(*) FROM public.facility_reservations WHERE start_time >= p_from AND start_time < p_to),
      'total_prev', (SELECT count(*) FROM public.facility_reservations WHERE start_time >= prev_from AND start_time < p_from),
      'approved',   (SELECT count(*) FROM public.facility_reservations WHERE start_time >= p_from AND start_time < p_to AND status = 'approved'),
      'rejected',   (SELECT count(*) FROM public.facility_reservations WHERE start_time >= p_from AND start_time < p_to AND status = 'rejected'),
      'pending',    (SELECT count(*) FROM public.facility_reservations WHERE start_time >= p_from AND start_time < p_to AND status = 'pending'),
      'hours',      (SELECT COALESCE(round((sum(extract(epoch FROM end_time - start_time)) / 3600)::numeric, 1), 0)
                     FROM public.facility_reservations WHERE start_time >= p_from AND start_time < p_to AND status = 'approved'),
      'by_room', COALESCE((
        SELECT jsonb_agg(x) FROM (
          SELECT jsonb_build_object('name', r.name, 'bookings', count(*), 'hours', round((sum(extract(epoch FROM f.end_time - f.start_time)) / 3600)::numeric, 1)) AS x
          FROM public.facility_reservations f JOIN public.rooms r ON r.id = f.room_id
          WHERE f.start_time >= p_from AND f.start_time < p_to AND f.status = 'approved'
          GROUP BY r.id, r.name ORDER BY sum(extract(epoch FROM f.end_time - f.start_time)) DESC LIMIT 8
        ) s), '[]'::jsonb)
    ),
    'trend', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'bucket', to_char(g.b, 'YYYY-MM-DD'),
        'tickets',      (SELECT count(*) FROM public.repair_tickets_live t WHERE t.duplicate_of IS NULL AND date_trunc(bucket, t.created_at AT TIME ZONE tz) = g.b AND t.created_at >= p_from AND t.created_at < p_to),
        'completed',    (SELECT count(*) FROM public.repair_tickets_live t WHERE t.duplicate_of IS NULL AND t.status = 'completed' AND date_trunc(bucket, t.updated_at AT TIME ZONE tz) = g.b AND t.updated_at >= p_from AND t.updated_at < p_to),
        'reservations', (SELECT count(*) FROM public.facility_reservations f WHERE f.status = 'approved' AND date_trunc(bucket, f.start_time AT TIME ZONE tz) = g.b AND f.start_time >= p_from AND f.start_time < p_to)
      ) ORDER BY g.b)
      FROM generate_series(date_trunc(bucket, p_from AT TIME ZONE tz), date_trunc(bucket, (p_to - interval '1 second') AT TIME ZONE tz), (CASE bucket WHEN 'month' THEN interval '1 month' ELSE interval '1 day' END)) AS g(b)
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.executive_summary(timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.executive_summary(timestamptz, timestamptz, text) TO authenticated;
