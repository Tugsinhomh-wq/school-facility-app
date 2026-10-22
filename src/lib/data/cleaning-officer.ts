import {
  CLASSROOM_SELECT,
  DEMO_ROWS,
  latestTerm,
  toRows,
  type ClassroomRow,
} from "@/lib/data/cleaning";
import { getSession, isFacilityOfficer } from "@/lib/data/session";
import type { ReportRoom } from "@/lib/cleaning-report";
import { bangkokYmd, weekdayIndex } from "@/lib/time";

/**
 * Every active classroom of the latest term, with all its advisors. Meant for facility officers
 * (RLS shows them everything; anyone else would only get their own classrooms).
 */
export async function getAllClassrooms(): Promise<{
  rows: ClassroomRow[];
  failed?: boolean;
}> {
  try {
    const s = await getSession();
    if (!s) return { rows: DEMO_ROWS };
    const { data, error } = await s.supabase
      .from("classrooms")
      .select(CLASSROOM_SELECT)
      .eq("is_active", true);
    if (error) return { rows: [], failed: true };
    return { rows: toRows(data) };
  } catch {
    return { rows: [], failed: true };
  }
}

/**
 * Today's progress across the latest term's active classrooms. null = not an officer (show nothing);
 * `{ failed: true }` = an officer whose data failed to load (show an error with retry).
 * `off` = today is a weekend or a school off day, so nobody has to confirm.
 */
export type TodayCounts =
  | { confirmed: number; total: number; off: boolean }
  | { failed: true }
  | null;

export async function getTodayCounts(): Promise<TodayCounts> {
  let officer = false;
  try {
    const s = await getSession();
    if (!s || !isFacilityOfficer(s.viewer.role)) return null;
    officer = true;
    const today = bangkokYmd(new Date());
    const [rooms, offDay] = await Promise.all([
      s.supabase.from("classrooms").select("id, term").eq("is_active", true),
      s.supabase.from("school_off_days").select("day").eq("day", today),
    ]);
    if (rooms.error || offDay.error) return { failed: true };
    const off = weekdayIndex(today) >= 5 || offDay.data.length > 0;
    const current = latestTerm(
      rooms.data as { id: string; term: string }[],
    ).map((r) => r.id);
    if (current.length === 0) return { confirmed: 0, total: 0, off };
    const { count, error } = await s.supabase
      .from("cleaning_confirmations")
      .select("id", { count: "exact", head: true })
      .eq("day", today)
      .in("classroom_id", current);
    if (error) return { failed: true };
    return { confirmed: count ?? 0, total: current.length, off };
  } catch {
    // Failing before the role is known means we cannot tell; show nothing rather than a false error.
    return officer ? { failed: true } : null;
  }
}

/**
 * Signed URLs (1 hour) for the photos of one confirmation, for facility officers only. The storage
 * policy lets officers read every cleaning photo; the session client keeps that check in force.
 */
export async function getConfirmationPhotos(
  classroomId: string,
  day: string,
): Promise<{ urls: string[] } | { failed: true }> {
  try {
    const s = await getSession();
    if (!s || !isFacilityOfficer(s.viewer.role)) return { failed: true };
    const { data, error } = await s.supabase
      .from("cleaning_confirmations")
      .select("photo_paths")
      .eq("classroom_id", classroomId)
      .eq("day", day)
      .maybeSingle();
    if (error) return { failed: true };
    const paths = (data?.photo_paths as string[] | null) ?? [];
    if (paths.length === 0) return { urls: [] };
    const signed = await s.supabase.storage
      .from("cleaning-photos")
      .createSignedUrls(paths, 3600);
    if (signed.error) return { failed: true };
    return {
      urls: signed.data.flatMap((u) => (u.signedUrl ? [u.signedUrl] : [])),
    };
  } catch {
    return { failed: true };
  }
}

const PAGE = 1000;

/**
 * Inputs of the Excel summary for `from`..`to`: the latest term's active rooms, the days each was
 * confirmed, and the school off days. Officers only; null = not an officer.
 */
export async function getReportData(
  from: string,
  to: string,
): Promise<
  { rooms: ReportRoom[]; offDays: Set<string> } | { failed: true } | null
> {
  try {
    const s = await getSession();
    if (!s || !isFacilityOfficer(s.viewer.role)) return null;
    const { rows, failed } = await getAllClassrooms();
    if (failed) return { failed: true };
    const confirmed = new Map<string, Set<string>>();
    // PostgREST returns at most 1000 rows a call; 72 rooms over a term is far more, so page through.
    for (let at = 0; ; at += PAGE) {
      const { data, error } = await s.supabase
        .from("cleaning_confirmations")
        .select("classroom_id, day")
        .gte("day", from)
        .lte("day", to)
        .order("day")
        .order("classroom_id")
        .range(at, at + PAGE - 1);
      if (error) return { failed: true };
      for (const c of data as { classroom_id: string; day: string }[]) {
        const days = confirmed.get(c.classroom_id) ?? new Set<string>();
        days.add(c.day);
        confirmed.set(c.classroom_id, days);
      }
      if (data.length < PAGE) break;
    }
    const created = await s.supabase
      .from("classrooms")
      .select("id, created_at")
      .in(
        "id",
        rows.map((r) => r.id),
      );
    if (created.error) return { failed: true };
    const since = new Map(
      (created.data as { id: string; created_at: string }[]).map((c) => [
        c.id,
        bangkokYmd(new Date(c.created_at)),
      ]),
    );
    const off = await s.supabase
      .from("school_off_days")
      .select("day")
      .gte("day", from)
      .lte("day", to);
    if (off.error) return { failed: true };
    return {
      rooms: rows.map((r) => ({
        name: r.name,
        zone: r.zone,
        advisors: r.advisors.map((a) => a.name).join(", "),
        since: since.get(r.id) ?? from,
        confirmed: confirmed.get(r.id) ?? new Set<string>(),
      })),
      offDays: new Set((off.data as { day: string }[]).map((o) => o.day)),
    };
  } catch {
    return { failed: true };
  }
}
