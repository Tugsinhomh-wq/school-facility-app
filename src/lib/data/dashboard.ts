import {
  getMyReservations,
  mockMyReservations,
  type MyReservation,
  getPendingReservations,
  mockPendingReservations,
  type PendingReservation,
} from "@/lib/data/rooms";
import {
  getSession,
  hasSupabase,
  isRoomManager,
  isStaffRole,
} from "@/lib/data/session";
import { MOCK_TICKETS } from "@/lib/mock-data";
import type {
  Building,
  RepairTicketWithLocation,
  TicketStatus,
  UserRole,
} from "@/types/database";

export type BuildingOption = Pick<Building, "id" | "name">;

export interface Viewer {
  name: string;
  role: UserRole;
}

/** The fields the home rows need; keeps the queries small. */
export type TicketBrief = Pick<
  RepairTicketWithLocation,
  "id" | "title" | "urgency" | "status" | "created_at"
>;

/** The repair numbers on the home page. */
export interface DashboardBase {
  source: "supabase" | "mock";
  /** Signed in, but the data could not be loaded: show an error with a retry instead of made-up numbers. */
  failed?: boolean;
  viewer: Viewer | null;
  pending: number;
  emergencyOpen: number;
}

export interface RepairsData {
  failed?: boolean;
  /** The viewer's latest request. */
  latest: TicketBrief | null;
  /** Staff: the newest request waiting to be taken. */
  newestPending: TicketBrief | null;
}

export interface RoomsData {
  failed?: boolean;
  /** Staff: requests waiting for a decision. */
  pendingReservations: PendingReservation[];
  /** Everyone else: their own requests with status. */
  myReservations: MyReservation[];
}

type CountRow = { status: TicketStatus; urgency: string };

const count = (rows: CountRow[]) => ({
  pending: rows.filter((t) => t.status === "pending").length,
  emergencyOpen: rows.filter(
    (t) => t.urgency === "emergency" && t.status !== "completed" && t.status !== "cancelled",
  ).length,
});

const BRIEF_SELECT = "id, title, urgency, status, created_at";

const failedBase = (viewer: Viewer | null = null): DashboardBase => ({
  source: "supabase",
  viewer,
  failed: true,
  pending: 0,
  emergencyOpen: 0,
});

/** The repair counts for the home page: one small tickets query. */
export async function getDashboardBase(): Promise<DashboardBase> {
  try {
    const s = await getSession();
    if (!s) return { source: "mock", viewer: null, ...count(MOCK_TICKETS) };
    const tickets = await s.supabase
      .from("repair_tickets")
      .select("status, urgency")
      .is("duplicate_of", null)
      .limit(1000);
    if (tickets.error) return failedBase(s.viewer);
    return {
      source: "supabase",
      viewer: s.viewer,
      ...count(tickets.data as CountRow[]),
    };
  } catch {
    return hasSupabase()
      ? failedBase()
      : { source: "mock", viewer: null, ...count(MOCK_TICKETS) };
  }
}

export async function getRepairsData(): Promise<RepairsData> {
  const newestOf = (rows: TicketBrief[]) =>
    [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  const mock = (): RepairsData => ({
    latest: newestOf(MOCK_TICKETS),
    newestPending: newestOf(MOCK_TICKETS.filter((t) => t.status === "pending")),
  });
  try {
    const s = await getSession();
    if (!s) return mock();
    const [latest, pending] = await Promise.all([
      s.supabase
        .from("repair_tickets")
        .select(BRIEF_SELECT)
        .order("created_at", { ascending: false })
        .limit(1),
      isStaffRole(s.viewer.role)
        ? s.supabase
            .from("repair_tickets")
            .select(BRIEF_SELECT)
            .eq("status", "pending")
            .is("duplicate_of", null)
            .order("created_at", { ascending: false })
            .limit(1)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (latest.error || pending.error)
      return { latest: null, newestPending: null, failed: true };
    return {
      latest: (latest.data as TicketBrief[])[0] ?? null,
      newestPending: (pending.data as TicketBrief[])[0] ?? null,
    };
  } catch {
    return hasSupabase()
      ? { latest: null, newestPending: null, failed: true }
      : mock();
  }
}

export async function getRoomsData(): Promise<RoomsData> {
  const mock = (): RoomsData => ({
    pendingReservations: mockPendingReservations(),
    myReservations: mockMyReservations(),
  });
  try {
    const s = await getSession();
    if (!s) return mock();
    const manager = isRoomManager(s.viewer.role);
    const [pending, mine] = await Promise.all([
      manager
        ? getPendingReservations(s.supabase)
        : Promise.resolve([] as PendingReservation[]),
      manager
        ? Promise.resolve([] as MyReservation[])
        : getMyReservations(s.supabase, s.userId),
    ]);
    return { pendingReservations: pending, myReservations: mine };
  } catch {
    return hasSupabase()
      ? { pendingReservations: [], myReservations: [], failed: true }
      : mock();
  }
}
