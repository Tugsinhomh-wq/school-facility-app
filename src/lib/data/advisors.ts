import { advisorDiff } from "@/lib/advisors";
import { latestTerm } from "@/lib/data/cleaning";
import type { getSession } from "@/lib/data/session";

type Db = NonNullable<Awaited<ReturnType<typeof getSession>>>["supabase"];
export type TermRooms = { term: string | null; rooms: { id: string; name: string }[] };

/** The newest term with active classrooms and those rooms; null if the lookup failed. */
export async function latestTermRooms(db: Db): Promise<TermRooms | null> {
  const { data, error } = await db.from("classrooms").select("id, term, name").eq("is_active", true);
  if (error) return null;
  const rooms = latestTerm(data as { id: string; term: string; name: string }[]);
  return { term: rooms[0]?.term ?? null, rooms: rooms.map(({ id, name }) => ({ id, name })) };
}

/**
 * Make one teacher's advisor rooms in `termRoomIds` exactly `ticked`: add the missing first, then
 * drop the unticked, so a failure in between leaves an extra room, never a lost one. Rooms of other
 * terms are never read or written. Returns the counts, or the database error code.
 */
export async function setUserRooms(db: Db, userId: string, termRoomIds: string[], ticked: string[]) {
  const { data, error } = await db
    .from("classroom_advisors")
    .select("classroom_id")
    .eq("user_id", userId)
    .in("classroom_id", termRoomIds);
  if (error) return { code: error.code };
  const { add, remove } = advisorDiff(
    ticked,
    (data as { classroom_id: string }[]).map((r) => r.classroom_id),
    termRoomIds,
  );
  if (add.length > 0) {
    const r = await db
      .from("classroom_advisors")
      .upsert(add.map((classroom_id) => ({ classroom_id, user_id: userId })), {
        onConflict: "classroom_id,user_id",
        ignoreDuplicates: true,
      });
    if (r.error) return { code: r.error.code };
  }
  if (remove.length > 0) {
    const r = await db.from("classroom_advisors").delete().eq("user_id", userId).in("classroom_id", remove);
    if (r.error) return { code: r.error.code };
  }
  return { added: add.length, removed: remove.length };
}
