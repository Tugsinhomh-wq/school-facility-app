import type { Confirmation } from "@/lib/cleaning";
import { getSession, isFacilityOfficer } from "@/lib/data/session";
import { addDays, bangkokYmd } from "@/lib/time";

export type ClassroomRow = {
  id: string;
  name: string;
  zone: string;
  building: string | null;
  advisors: { id: string; name: string }[];
};

/** A confirmation as the page shows it: who, late or not, and how many photos (never the photos themselves). */
export type WeekConfirmation = Confirmation & { photos: number };

export type CleaningWeek = {
  /** Outer key classroom id, inner key YYYY-MM-DD. */
  confirmations: Map<string, Map<string, WeekConfirmation>>;
  offDays: Set<string>;
  /** Signed in, but loading failed: show an error with a retry instead of sample data. */
  failed?: boolean;
};

const CLASSROOM_SELECT =
  "id, term, name, zone, building:buildings(name), advisors:classroom_advisors(user_id, profile:profiles(full_name))";

type One<T> = T | T[] | null;
const one = <T>(v: One<T>) => (Array.isArray(v) ? (v[0] ?? null) : v);

type RawClassroom = {
  id: string;
  term: string;
  name: string;
  zone: string;
  building: One<{ name: string }>;
  advisors: { user_id: string; profile: One<{ full_name: string }> }[] | null;
};

const toRow = (r: RawClassroom): ClassroomRow => ({
  id: r.id,
  name: r.name,
  zone: r.zone,
  building: one(r.building)?.name ?? null,
  // RLS hides profiles a teacher may not read, so a name can be missing.
  advisors: (r.advisors ?? []).map((a) => ({
    id: a.user_id,
    name: one(a.profile)?.full_name ?? "ครูที่ปรึกษา",
  })),
});

/** Keep only the latest term present ("2569/2" sorts after "2569/1"), so last term's rows do not linger. */
const latestTerm = <T extends { term: string }>(rows: T[]) => {
  const term = rows.reduce((t, r) => (r.term > t ? r.term : t), "");
  return rows.filter((r) => r.term === term);
};

// Demo mode only (no Supabase configured / not signed in): never shown to a signed-in user.
const DEMO_ROOM_ID = "00000000-0000-4000-8000-000000000001";
const DEMO_ROWS: ClassroomRow[] = [
  {
    id: DEMO_ROOM_ID,
    name: "ม.3/2",
    zone: "ทางเดินหน้าอาคาร 2 ชั้น 1 และสวนหย่อมข้างบันได",
    building: "อาคาร 2",
    advisors: [{ id: "demo", name: "ครู ตัวอย่าง" }],
  },
];

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
    const { data, error } = await s.supabase
      .from("classrooms")
      .select(CLASSROOM_SELECT)
      .in("id", ids)
      .eq("is_active", true)
      .order("name");
    if (error) return { rows: [], failed: true };
    return { rows: latestTerm(data as unknown as RawClassroom[]).map(toRow) };
  } catch {
    return { rows: [], failed: true };
  }
}

/** Confirmations and off days for Mon-Fri of the week starting at `monday`. */
export async function getWeek(
  classroomIds: string[],
  monday: string,
): Promise<CleaningWeek> {
  const friday = addDays(monday, 4);
  try {
    const s = await getSession();
    if (!s) return demoWeek(monday);
    const [confirmations, offDays] = await Promise.all([
      classroomIds.length === 0
        ? Promise.resolve({ data: [], error: null })
        : s.supabase
            .from("cleaning_confirmations")
            .select("classroom_id, day, confirmed_by_name, is_late, photo_paths")
            .in("classroom_id", classroomIds)
            .gte("day", monday)
            .lte("day", friday),
      s.supabase
        .from("school_off_days")
        .select("day")
        .gte("day", monday)
        .lte("day", friday),
    ]);
    if (confirmations.error || offDays.error) return emptyWeek(true);
    const week = emptyWeek();
    for (const c of confirmations.data as {
      classroom_id: string;
      day: string;
      confirmed_by_name: string;
      is_late: boolean;
      photo_paths: string[] | null;
    }[]) {
      const byDay = week.confirmations.get(c.classroom_id) ?? new Map();
      byDay.set(c.day, {
        isLate: c.is_late,
        byName: c.confirmed_by_name,
        photos: c.photo_paths?.length ?? 0,
      });
      week.confirmations.set(c.classroom_id, byDay);
    }
    for (const o of offDays.data as { day: string }[]) week.offDays.add(o.day);
    return week;
  } catch {
    return emptyWeek(true);
  }
}

const emptyWeek = (failed?: boolean): CleaningWeek => ({
  confirmations: new Map(),
  offDays: new Set(),
  ...(failed ? { failed } : {}),
});

/** Demo week: Monday confirmed (if it has passed), the rest left as they fall. */
function demoWeek(monday: string): CleaningWeek {
  const week = emptyWeek();
  if (monday < bangkokYmd(new Date()))
    week.confirmations.set(
      DEMO_ROOM_ID,
      new Map([[monday, { isLate: false, byName: "ครู ตัวอย่าง", photos: 1 }]]),
    );
  return week;
}

/** Today's progress across the latest term's active classrooms, for officers; null for everyone else or on error. */
export async function getTodayCounts(): Promise<{
  confirmed: number;
  total: number;
} | null> {
  try {
    const s = await getSession();
    if (!s || !isFacilityOfficer(s.viewer.role)) return null;
    const today = bangkokYmd(new Date());
    const rooms = await s.supabase
      .from("classrooms")
      .select("id, term")
      .eq("is_active", true);
    if (rooms.error) return null;
    const current = latestTerm(
      rooms.data as { id: string; term: string }[],
    ).map((r) => r.id);
    if (current.length === 0) return { confirmed: 0, total: 0 };
    const { count, error } = await s.supabase
      .from("cleaning_confirmations")
      .select("id", { count: "exact", head: true })
      .eq("day", today)
      .in("classroom_id", current);
    if (error) return null;
    return { confirmed: count ?? 0, total: current.length };
  } catch {
    return null;
  }
}
