import {
  getLiveRooms,
  getMyReservations,
  mockMyReservations,
  type MyReservation,
  getPendingReservations,
  getTodayMeetings,
  mockLiveRooms,
  mockPendingReservations,
  mockTodayMeetings,
  type LiveRoom,
  type PendingReservation,
  type TodayMeeting,
} from "@/lib/data/rooms";
import { getSession, isStaffRole } from "@/lib/data/session";
import { MOCK_BUILDINGS, MOCK_MEMOS, MOCK_TICKETS } from "@/lib/mock-data";
import type { Building, Memorandum, RepairTicketWithLocation, TicketStatus, UrgencyLevel, UserRole } from "@/types/database";

export type BuildingOption = Pick<Building, "id" | "name">;
export type DashTab = "repairs" | "rooms";

export interface Viewer {
  name: string;
  role: UserRole;
}

/** The fields the dashboard lists need; keeps the queries small. */
export type TicketBrief = Pick<RepairTicketWithLocation, "id" | "title" | "urgency" | "status" | "created_at" | "location_detail" | "building" | "room">;

/** Loaded for every tab: header numbers, the ray artwork and the ticker. */
export interface DashboardBase {
  source: "supabase" | "mock";
  viewer: Viewer | null;
  stats: Record<Extract<TicketStatus, "pending" | "in_progress" | "completed">, number> & { estimatedCost: number };
  emergencyOpen: number;
  rays: { id: string; urgency: UrgencyLevel; status: TicketStatus }[];
  byBuilding: { building: string; count: number }[];
  todayMeetings: TodayMeeting[];
  roomsInUseToday: number;
}

export interface RepairsData {
  /** The viewer's latest requests (staff see everyone's). */
  recent: TicketBrief[];
  /** Staff: pending work, most urgent first. */
  queue: TicketBrief[];
  /** Staff: latest memos. */
  documents: Memorandum[];
  buildings: BuildingOption[];
}

export interface RoomsData {
  liveRooms: LiveRoom[];
  /** Staff: requests waiting for a decision. */
  pendingReservations: PendingReservation[];
  /** Everyone else: their own requests with status. */
  myReservations: MyReservation[];
}

type SummaryRow = { id: string; urgency: UrgencyLevel; status: TicketStatus; estimated_cost: number | string | null; building: { name: string } | { name: string }[] | null };

const BRIEF_SELECT = "id, title, urgency, status, created_at, location_detail, building:buildings(name), room:rooms(room_number, name)";
const URGENCY_RANK: Record<UrgencyLevel, number> = { emergency: 0, high: 1, medium: 2, low: 3 };

function summarize(rows: SummaryRow[]) {
  const open = rows.filter((t) => t.status !== "cancelled");
  const count = (s: TicketStatus) => rows.filter((t) => t.status === s).length;
  const byName = open.reduce<Record<string, number>>((acc, t) => {
    const b = Array.isArray(t.building) ? t.building[0] : t.building;
    const name = b?.name ?? "ไม่ระบุอาคาร";
    acc[name] = (acc[name] ?? 0) + 1;
    return acc;
  }, {});
  return {
    stats: {
      pending: count("pending"),
      in_progress: count("in_progress"),
      completed: count("completed"),
      estimatedCost: open.reduce((sum, t) => sum + Number(t.estimated_cost ?? 0), 0),
    },
    emergencyOpen: open.filter((t) => t.urgency === "emergency" && t.status !== "completed").length,
    rays: open.map(({ id, urgency, status }) => ({ id, urgency, status })),
    byBuilding: Object.entries(byName).map(([building, n]) => ({ building, count: n })).sort((a, b) => b.count - a.count),
  };
}

const newest = <T extends { created_at: string }>(rows: T[], n: number) => [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, n);

// ---- demo data (no Supabase configured) ----
const mockSummary = () => MOCK_TICKETS.map(({ id, urgency, status, estimated_cost, building }) => ({ id, urgency, status, estimated_cost, building }));

function mockBase(): DashboardBase {
  const meetings = mockTodayMeetings();
  return { source: "mock", viewer: null, ...summarize(mockSummary()), todayMeetings: meetings, roomsInUseToday: new Set(meetings.map((m) => m.room_id)).size };
}

/** What every tab needs. One small tickets query plus today's meetings, run in parallel. */
export async function getDashboardBase(): Promise<DashboardBase> {
  try {
    const s = await getSession();
    if (!s) return mockBase();
    const [tickets, meetings] = await Promise.all([
      s.supabase.from("repair_tickets").select("id, urgency, status, estimated_cost, building:buildings(name)").is("duplicate_of", null).limit(1000),
      getTodayMeetings(s.supabase),
    ]);
    if (tickets.error) return mockBase();
    return {
      source: "supabase",
      viewer: s.viewer,
      ...summarize(tickets.data as unknown as SummaryRow[]),
      todayMeetings: meetings,
      roomsInUseToday: new Set(meetings.map((m) => m.room_id)).size,
    };
  } catch {
    return mockBase();
  }
}

const byUrgency = (a: TicketBrief, b: TicketBrief) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || b.created_at.localeCompare(a.created_at);

export async function getRepairsData(): Promise<RepairsData> {
  const mock = (): RepairsData => ({
    recent: newest(MOCK_TICKETS, 5),
    queue: MOCK_TICKETS.filter((t) => t.status === "pending").sort(byUrgency).slice(0, 5),
    documents: newest(MOCK_MEMOS, 4),
    buildings: MOCK_BUILDINGS,
  });
  try {
    const s = await getSession();
    if (!s) return mock();
    const staff = isStaffRole(s.viewer.role);
    const [recent, pending, memos, buildings] = await Promise.all([
      s.supabase.from("repair_tickets").select(BRIEF_SELECT).order("created_at", { ascending: false }).limit(5),
      staff ? s.supabase.from("repair_tickets").select(BRIEF_SELECT).eq("status", "pending").is("duplicate_of", null).order("created_at", { ascending: false }).limit(30) : Promise.resolve({ data: [], error: null }),
      staff ? s.supabase.from("memorandums").select("*").eq("origin_module", "repair").order("created_at", { ascending: false }).limit(4) : Promise.resolve({ data: [], error: null }),
      s.supabase.from("buildings").select("id, name").eq("is_active", true).order("name"),
    ]);
    if (recent.error || pending.error || buildings.error) return mock();
    return {
      recent: recent.data as unknown as TicketBrief[],
      // The query limited to the newest 30 pending; show the most urgent of them.
      queue: [...(pending.data as unknown as TicketBrief[])].sort(byUrgency).slice(0, 5),
      documents: (memos.data ?? []) as Memorandum[],
      buildings: buildings.data as BuildingOption[],
    };
  } catch {
    return mock();
  }
}

export async function getRoomsData(): Promise<RoomsData> {
  const mock = (): RoomsData => ({ liveRooms: mockLiveRooms(), pendingReservations: mockPendingReservations(), myReservations: mockMyReservations() });
  try {
    const s = await getSession();
    if (!s) return mock();
    const staff = isStaffRole(s.viewer.role);
    const [liveRooms, pending, mine] = await Promise.all([
      getLiveRooms(s.supabase),
      staff ? getPendingReservations(s.supabase) : Promise.resolve([] as PendingReservation[]),
      staff ? Promise.resolve([] as MyReservation[]) : getMyReservations(s.supabase, s.userId),
    ]);
    return { liveRooms, pendingReservations: pending, myReservations: mine };
  } catch {
    return mock();
  }
}
