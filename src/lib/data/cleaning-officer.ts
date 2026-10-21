import {
  CLASSROOM_SELECT,
  DEMO_ROWS,
  latestTerm,
  toRows,
  type ClassroomRow,
} from "@/lib/data/cleaning";
import { getSession, isFacilityOfficer } from "@/lib/data/session";
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
    return { urls: signed.data.flatMap((u) => (u.signedUrl ? [u.signedUrl] : [])) };
  } catch {
    return { failed: true };
  }
}
