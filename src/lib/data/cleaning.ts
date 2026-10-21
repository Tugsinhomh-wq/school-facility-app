import {
  compareRoomNames,
  dayState,
  type Confirmation,
  type DayState,
} from "@/lib/cleaning";
import { getSession, isFacilityOfficer } from "@/lib/data/session";
import { addDays, bangkokYmd, mondayOf, weekdayIndex } from "@/lib/time";

export type ClassroomRow = {
  id: string;
  name: string;
  zone: string;
  buildingId: string | null;
  building: string | null;
  /** Complete only for officers: RLS shows a teacher just their own advisor row. */
  advisors: { id: string; name: string }[];
};

/** A confirmation as the page shows it: who, when (ISO), late or not, and how many photos (never the photos themselves). */
export type WeekConfirmation = Confirmation & { photos: number; at: string };

export type CleaningWeek = {
  /** Outer key classroom id, inner key YYYY-MM-DD. */
  confirmations: Map<string, Map<string, WeekConfirmation>>;
  offDays: Set<string>;
  /** Signed in, but loading failed: show an error with a retry instead of sample data. */
  failed?: boolean;
};

const CLASSROOM_SELECT =
  "id, term, name, zone, building_id, building:buildings(name), advisors:classroom_advisors(user_id, profile:profiles(full_name))";

type One<T> = T | T[] | null;
const one = <T>(v: One<T>) => (Array.isArray(v) ? (v[0] ?? null) : v);

type RawClassroom = {
  id: string;
  term: string;
  name: string;
  zone: string;
  building_id: string | null;
  building: One<{ name: string }>;
  advisors: { user_id: string; profile: One<{ full_name: string }> }[] | null;
};

const toRow = (r: RawClassroom): ClassroomRow => ({
  id: r.id,
  name: r.name,
  zone: r.zone,
  buildingId: r.building_id,
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

/** Latest term only, mapped and sorted by room name ("ม.3/2" before "ม.3/10"). */
const toRows = (data: unknown) =>
  latestTerm(data as RawClassroom[])
    .map(toRow)
    .sort((a, b) => compareRoomNames(a.name, b.name));

// Demo mode only (no Supabase configured / not signed in): never shown to a signed-in user.
const DEMO_ROOM_ID = "00000000-0000-4000-8000-000000000001";
const DEMO_ROWS: ClassroomRow[] = [
  {
    id: DEMO_ROOM_ID,
    name: "ม.3/2",
    zone: "ทางเดินหน้าอาคาร 2 ชั้น 1 และสวนหย่อมข้างบันได",
    buildingId: null,
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
      .eq("is_active", true);
    if (error) return { rows: [], failed: true };
    return { rows: toRows(data) };
  } catch {
    return { rows: [], failed: true };
  }
}

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
            .select(
              "classroom_id, day, confirmed_by_name, confirmed_at, is_late, photo_paths",
            )
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
      confirmed_at: string;
      is_late: boolean;
      photo_paths: string[] | null;
    }[]) {
      const byDay = week.confirmations.get(c.classroom_id) ?? new Map();
      byDay.set(c.day, {
        isLate: c.is_late,
        byName: c.confirmed_by_name,
        at: c.confirmed_at,
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
      new Map([
        [
          monday,
          {
            isLate: false,
            byName: "ครู ตัวอย่าง",
            at: `${monday}T00:42:00Z`,
            photos: 1,
          },
        ],
      ]),
    );
  return week;
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

export type SetupRoom = {
  id: string;
  term: string;
  name: string;
  zone: string;
  buildingId: string | null;
  isActive: boolean;
  advisorEmails: string[];
};

export type CleaningSetup = {
  /** Every term that has classrooms, newest first. */
  terms: string[];
  /** Every classroom of every term (active or not), sorted by room name. */
  rooms: SetupRoom[];
  /** Active buildings, meeting halls (HALL-nn) left out. */
  buildings: { id: string; name: string }[];
  /** From two weeks ago on: the days a late confirmation could still fall on. */
  offDays: { day: string; reason: string | null }[];
};

/** The setup page's data, for facility officers. null = not signed in or not an officer. */
export async function getCleaningSetup(): Promise<CleaningSetup | { failed: true } | null> {
  const s = await getSession();
  if (!s || !isFacilityOfficer(s.viewer.role)) return null;
  try {
    const [rooms, buildings, offDays] = await Promise.all([
      s.supabase
        .from("classrooms")
        .select("id, term, name, zone, building_id, is_active, advisors:classroom_advisors(profile:profiles(email))"),
      s.supabase
        .from("buildings")
        .select("id, name")
        .eq("is_active", true)
        .not("code", "like", "HALL-%")
        .order("name"),
      s.supabase
        .from("school_off_days")
        .select("day, reason")
        .gte("day", addDays(bangkokYmd(new Date()), -14))
        .order("day"),
    ]);
    if (rooms.error || buildings.error || offDays.error) return { failed: true };
    const list = (
      rooms.data as unknown as (Omit<RawClassroom, "building" | "advisors"> & {
        is_active: boolean;
        advisors: { profile: One<{ email: string }> }[] | null;
      })[]
    )
      .map((r) => ({
        id: r.id,
        term: r.term,
        name: r.name,
        zone: r.zone,
        buildingId: r.building_id,
        isActive: r.is_active,
        advisorEmails: (r.advisors ?? []).flatMap((a) => one(a.profile)?.email ?? []),
      }))
      .sort((a, b) => compareRoomNames(a.name, b.name));
    return {
      terms: [...new Set(list.map((r) => r.term))].sort().reverse(),
      rooms: list,
      buildings: buildings.data as { id: string; name: string }[],
      offDays: offDays.data as { day: string; reason: string | null }[],
    };
  } catch {
    return { failed: true };
  }
}
