import { dayState, type DayState } from "@/lib/cleaning";
import {
  CLASSROOM_SELECT,
  DEMO_ROWS,
  getWeek,
  toRows,
  type ClassroomRow,
  type RawClassroom,
} from "@/lib/data/cleaning";
import { getSession } from "@/lib/data/session";
import { bangkokYmd, mondayOf } from "@/lib/time";

/** The classrooms the signed-in user advises (active, latest term). RLS limits what the client can see. */
export async function getMyClassrooms(): Promise<{
  rows: ClassroomRow[];
  failed?: boolean;
}> {
  try {
    const s = await getSession();
    if (!s) return { rows: DEMO_ROWS };
    const mine = await s.supabase
      .from("classroom_advisors")
      .select("classroom_id")
      .eq("user_id", s.userId);
    if (mine.error) return { rows: [], failed: true };
    const ids = mine.data.map((r) => r.classroom_id as string);
    if (ids.length === 0) return { rows: [] };
    // The latest term is global, as for officers: after a rollover, old-term rooms drop out. RLS
    // shows a teacher only their own rooms, so the term comes from a SECURITY DEFINER function.
    const [mineRows, term] = await Promise.all([
      s.supabase.from("classrooms").select(CLASSROOM_SELECT).in("id", ids).eq("is_active", true),
      s.supabase.rpc("latest_classroom_term"),
    ]);
    if (mineRows.error || term.error) return { rows: [], failed: true };
    return { rows: toRows((mineRows.data as RawClassroom[]).filter((r) => r.term === term.data)) };
  } catch {
    return { rows: [], failed: true };
  }
}

/**
 * Today's state of each classroom the signed-in user advises, for the one-line status on the home
 * page. Empty rows = not an advisor (show nothing); `failed` = show an error with retry.
 */
export async function getMyToday(): Promise<
  { rows: { id: string; name: string; state: DayState }[]; failed?: undefined } | { failed: true }
> {
  const mine = await getMyClassrooms();
  if (mine.failed) return { failed: true };
  if (mine.rows.length === 0) return { rows: [] };
  const today = bangkokYmd(new Date());
  const week = await getWeek(
    mine.rows.map((r) => r.id),
    mondayOf(today),
  );
  if (week.failed) return { failed: true };
  return {
    rows: mine.rows.map((r) => ({
      id: r.id,
      name: r.name,
      state: dayState({
        ymd: today,
        today,
        offDays: week.offDays,
        confirmation: week.confirmations.get(r.id)?.get(today) ?? null,
      }),
    })),
  };
}
