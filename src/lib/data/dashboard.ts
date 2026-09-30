import { getRoomSnapshot, mockRoomSnapshot, type LiveRoom, type RoomSnapshot, type TodayMeeting } from "@/lib/data/rooms";
import { MOCK_BUILDINGS, MOCK_MEMOS, MOCK_TICKETS } from "@/lib/mock-data";
import type { Building, Memorandum, RepairTicketWithLocation, TicketStatus, UserRole } from "@/types/database";

export type BuildingOption = Pick<Building, "id" | "name">;

export interface Viewer {
  name: string;
  role: UserRole;
}

export interface DashboardData {
  source: "supabase" | "mock";
  /** The signed-in user, or null in demo mode. */
  viewer: Viewer | null;
  stats: Record<Extract<TicketStatus, "pending" | "in_progress" | "completed">, number> & {
    estimatedCost: number;
  };
  recent: RepairTicketWithLocation[];
  documents: Memorandum[];
  buildings: BuildingOption[];
  byBuilding: { building: string; count: number }[];
  /** One entry per non-cancelled ticket; drives the hero ray artwork. */
  rays: Pick<RepairTicketWithLocation, "id" | "urgency" | "status">[];
  emergencyOpen: number;
  liveRooms: LiveRoom[];
  todayMeetings: TodayMeeting[];
  roomsInUseToday: number;
}

export function summarize(
  tickets: RepairTicketWithLocation[],
  documents: Memorandum[],
  buildings: BuildingOption[],
  source: DashboardData["source"],
  viewer: Viewer | null = null,
  rooms: RoomSnapshot = { liveRooms: [], todayMeetings: [], roomsInUseToday: 0 },
): DashboardData {
  const count = (s: TicketStatus) => tickets.filter((t) => t.status === s).length;
  const open = tickets.filter((t) => t.status !== "cancelled");

  const byBuilding = Object.entries(
    open.reduce<Record<string, number>>((acc, t) => {
      const name = t.building?.name ?? "ไม่ระบุอาคาร";
      acc[name] = (acc[name] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([building, n]) => ({ building, count: n }))
    .sort((a, b) => b.count - a.count);

  return {
    source,
    viewer,
    stats: {
      pending: count("pending"),
      in_progress: count("in_progress"),
      completed: count("completed"),
      estimatedCost: open.reduce((sum, t) => sum + Number(t.estimated_cost ?? 0), 0),
    },
    recent: [...tickets].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5),
    documents: [...documents].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 4),
    buildings,
    byBuilding,
    rays: open.map(({ id, urgency, status }) => ({ id, urgency, status })),
    emergencyOpen: open.filter((t) => t.urgency === "emergency" && t.status !== "completed").length,
    ...rooms,
  };
}

/**
 * Loads from Supabase when configured and signed in (RLS needs a user);
 * otherwise, or on any error, falls back to mock data so the UI always renders.
 */
export async function getDashboardData(): Promise<DashboardData> {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const [tickets, memos, buildings, profile, rooms] = await Promise.all([
          supabase
            .from("repair_tickets")
            .select("*, building:buildings(name), room:rooms(room_number, name)")
            .order("created_at", { ascending: false })
            .limit(500),
          supabase
            .from("memorandums")
            .select("*")
            .eq("origin_module", "repair")
            .order("created_at", { ascending: false })
            .limit(10),
          supabase.from("buildings").select("id, name").eq("is_active", true).order("name"),
          supabase.from("profiles").select("full_name, role").eq("id", auth.user.id).maybeSingle(),
          getRoomSnapshot(supabase),
        ]);
        if (!tickets.error && !buildings.error) {
          return summarize(
            tickets.data as unknown as RepairTicketWithLocation[],
            (memos.data ?? []) as Memorandum[],
            buildings.data as BuildingOption[],
            "supabase",
            {
              name: profile.data?.full_name ?? auth.user.email ?? "ผู้ใช้",
              role: (profile.data?.role as UserRole | undefined) ?? "user",
            },
            rooms,
          );
        }
      }
    } catch {
      // fall through to mock data
    }
  }
  return summarize(MOCK_TICKETS, MOCK_MEMOS, MOCK_BUILDINGS, "mock", null, mockRoomSnapshot());
}
