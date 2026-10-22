import { compareRoomNames } from "@/lib/cleaning";
import { DEMO_ROWS } from "@/lib/data/cleaning";
import { getSession } from "@/lib/data/session";

export type CensusRoom = { id: string; name: string; zone: string; students: number };
export type CensusStudent = { id: string; code: string; name: string };

const PAGE = 1000;

// Demo mode only (no Supabase configured / not signed in): never shown to a signed-in user.
const DEMO_TERM = "2569/1";
const DEMO_STUDENTS: CensusStudent[] = [
  { id: "demo-1", code: "00001", name: "นักเรียนตัวอย่าง หนึ่ง" },
  { id: "demo-2", code: "00002", name: "นักเรียนตัวอย่าง สอง" },
];

/** Terms the viewer can see rooms of, newest first. RLS: officers all, an advisor only their rooms' terms. */
export async function listCensusTerms(): Promise<{ terms: string[]; failed?: boolean }> {
  try {
    const s = await getSession();
    if (!s) return { terms: [DEMO_TERM] };
    // Newest first, so the 1000-row cap of one call can only cut the oldest terms.
    const { data, error } = await s.supabase
      .from("classrooms")
      .select("term")
      .order("term", { ascending: false })
      .limit(PAGE);
    if (error) return { terms: [], failed: true };
    return { terms: [...new Set((data as { term: string }[]).map((r) => r.term))] };
  } catch {
    return { terms: [], failed: true };
  }
}

/**
 * The term's active rooms with their student counts, as the viewer sees them. The rooms come from
 * classrooms (RLS: officers all, a teacher their own), so a room with no students still lists; the
 * counts come from census_students (RLS again), so they never include a room the viewer cannot read.
 */
export async function listCensusRooms(term: string): Promise<{ rooms: CensusRoom[]; failed?: boolean }> {
  try {
    const s = await getSession();
    if (!s) {
      const demo = term === DEMO_TERM ? DEMO_ROWS : [];
      return { rooms: demo.map((r) => ({ id: r.id, name: r.name, zone: r.zone, students: DEMO_STUDENTS.length })) };
    }
    const rooms = await s.supabase
      .from("classrooms")
      .select("id, name, zone")
      .eq("term", term)
      .eq("is_active", true);
    if (rooms.error) return { rooms: [], failed: true };
    const counts = new Map<string, number>();
    // PostgREST returns at most 1000 rows a call and a term has more students, so page through.
    for (let at = 0; ; at += PAGE) {
      const { data, error } = await s.supabase
        .from("census_students")
        .select("classroom_id")
        .eq("term", term)
        .order("student_code")
        .range(at, at + PAGE - 1);
      if (error) return { rooms: [], failed: true };
      for (const r of data as { classroom_id: string }[])
        counts.set(r.classroom_id, (counts.get(r.classroom_id) ?? 0) + 1);
      if (data.length < PAGE) break;
    }
    return {
      rooms: (rooms.data as { id: string; name: string; zone: string }[])
        .map((r) => ({ id: r.id, name: r.name, zone: r.zone, students: counts.get(r.id) ?? 0 }))
        .sort((a, b) => compareRoomNames(a.name, b.name)),
    };
  } catch {
    return { rooms: [], failed: true };
  }
}

/**
 * One room and its students by student code. `room` is null when the room does not exist or RLS
 * hides it from the viewer (then there are no students either).
 */
export async function getRoomRoster(
  classroomId: string,
): Promise<{ room: { id: string; name: string; term: string } | null; students: CensusStudent[]; failed?: boolean }> {
  try {
    const s = await getSession();
    if (!s) {
      const demo = DEMO_ROWS.find((r) => r.id === classroomId);
      return demo
        ? { room: { id: demo.id, name: demo.name, term: DEMO_TERM }, students: DEMO_STUDENTS }
        : { room: null, students: [] };
    }
    const room = await s.supabase.from("classrooms").select("id, name, term").eq("id", classroomId).maybeSingle();
    if (room.error) return { room: null, students: [], failed: true };
    if (!room.data) return { room: null, students: [] };
    const students = await s.supabase
      .from("census_students")
      .select("id, student_code, full_name")
      .eq("classroom_id", classroomId)
      .order("student_code");
    if (students.error) return { room: null, students: [], failed: true };
    return {
      room: room.data as { id: string; name: string; term: string },
      students: (students.data as { id: string; student_code: string; full_name: string }[]).map((r) => ({
        id: r.id,
        code: r.student_code,
        name: r.full_name,
      })),
    };
  } catch {
    return { room: null, students: [], failed: true };
  }
}
