import { compareRoomNames } from "@/lib/cleaning";
import { one, type One, type RawClassroom } from "@/lib/data/cleaning";
import { getSession, isFacilityOfficer } from "@/lib/data/session";
import { addDays, bangkokYmd } from "@/lib/time";

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
