import { compareRoomNames, type Confirmation } from "@/lib/cleaning";
import { getSession } from "@/lib/data/session";
import { addDays, bangkokYmd } from "@/lib/time";

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

export const CLASSROOM_SELECT =
  "id, term, name, zone, building_id, building:buildings(name), advisors:classroom_advisors(user_id, profile:profiles(full_name))";

export type One<T> = T | T[] | null;
export const one = <T>(v: One<T>) => (Array.isArray(v) ? (v[0] ?? null) : v);

export type RawClassroom = {
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
export const latestTerm = <T extends { term: string }>(rows: T[]) => {
  const term = rows.reduce((t, r) => (r.term > t ? r.term : t), "");
  return rows.filter((r) => r.term === term);
};

/** Latest term only, mapped and sorted by room name ("ม.3/2" before "ม.3/10"). */
export const toRows = (data: unknown) =>
  latestTerm(data as RawClassroom[])
    .map(toRow)
    .sort((a, b) => compareRoomNames(a.name, b.name));

// Demo mode only (no Supabase configured / not signed in): never shown to a signed-in user.
const DEMO_ROOM_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_ROWS: ClassroomRow[] = [
  {
    id: DEMO_ROOM_ID,
    name: "ม.3/2",
    zone: "ทางเดินหน้าอาคาร 2 ชั้น 1 และสวนหย่อมข้างบันได",
    buildingId: null,
    building: "อาคาร 2",
    advisors: [{ id: "demo", name: "ครู ตัวอย่าง" }],
  },
];

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
