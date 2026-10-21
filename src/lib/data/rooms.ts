import type { SupabaseClient } from "@supabase/supabase-js";

import type { Viewer } from "@/lib/data/dashboard";
import { getSession } from "@/lib/data/session";
import { MOCK_ROOMS, mockBookings } from "@/lib/mock-data";
import { addDays, atBangkok } from "@/lib/time";
import type { ApprovalStatus } from "@/types/database";

export interface RoomInfo {
  id: string;
  room_number: string;
  name: string;
  building_name: string;
  capacity: number | null;
  requires_approval: boolean;
  equipment: string[];
}

export interface Booking {
  id: string;
  room_id: string;
  applicant_id: string;
  applicant_name: string | null;
  purpose: string;
  attendee_count: number | null;
  equipment_needed: string | null;
  start_time: string;
  end_time: string;
  status: ApprovalStatus;
}

export interface MeetingWeek {
  source: "supabase" | "mock";
  viewer: Viewer | null;
  userId: string | null;
  rooms: RoomInfo[];
  bookings: Booking[];
  /** Signed in, but loading failed: show an error with a retry instead of sample data. */
  failed?: boolean;
}

const ROOM_SELECT =
  "id, room_number, name, capacity, requires_approval, equipment, building:buildings(name)";
type RoomRow = {
  id: string;
  room_number: string;
  name: string;
  capacity: number | null;
  requires_approval: boolean | null;
  equipment: string[] | null;
  building: { name: string } | { name: string }[] | null;
};

const toRoom = (r: RoomRow): RoomInfo => {
  const building = Array.isArray(r.building) ? r.building[0] : r.building;
  return {
    id: r.id,
    room_number: r.room_number,
    name: r.name,
    building_name: building?.name ?? "",
    capacity: r.capacity,
    requires_approval: Boolean(r.requires_approval),
    equipment: r.equipment ?? [],
  };
};

/** Rooms and bookings for the week starting at `weekStart` (a Bangkok date, a Monday). */
export async function getMeetingWeek(weekStart: string): Promise<MeetingWeek> {
  const from = atBangkok(weekStart, 0).toISOString();
  const to = atBangkok(addDays(weekStart, 7), 0).toISOString();

  const mock = (): MeetingWeek => ({
    source: "mock",
    viewer: null,
    userId: null,
    rooms: MOCK_ROOMS,
    bookings: mockBookings().filter(
      (b) => b.end_time > from && b.start_time < to,
    ),
  });

  const failed = (): MeetingWeek => ({ source: "supabase", viewer: null, userId: null, rooms: [], bookings: [], failed: true });
  let signedIn = false;
  try {
    const s = await getSession();
    if (!s) return mock();
    signedIn = true;
    const [rooms, bookings] = await Promise.all([
      s.supabase
        .from("rooms")
        .select(ROOM_SELECT)
        .eq("is_bookable", true)
        .order("room_number"),
      s.supabase
        .from("facility_reservations")
        .select(
          "id, room_id, applicant_id, purpose, attendee_count, equipment_needed, start_time, end_time, status, applicant:profiles(full_name)",
        )
        .in("status", ["pending", "approved"])
        .gt("end_time", from)
        .lt("start_time", to)
        .order("start_time"),
    ]);
    if (rooms.error || bookings.error) {
      return failed();
    }
    return {
      source: "supabase",
      viewer: s.viewer,
      userId: s.userId,
      rooms: (rooms.data as unknown as RoomRow[]).map(toRoom),
      bookings: (
        bookings.data as unknown as (Omit<Booking, "applicant_name"> & {
          applicant: { full_name: string } | { full_name: string }[] | null;
        })[]
      ).map(({ applicant, ...b }) => ({
        ...b,
        applicant_name:
          (Array.isArray(applicant) ? applicant[0] : applicant)?.full_name ??
          null,
      })),
    };
  } catch {
    return signedIn ? failed() : mock();
  }
}

export interface PendingReservation {
  id: string;
  purpose: string;
  room_name: string;
  start_time: string;
  end_time: string;
  applicant_name: string | null;
}

/** Room requests waiting for approval (staff). */
export async function getPendingReservations(
  supabase: SupabaseClient,
): Promise<PendingReservation[]> {
  try {
    const { data, error } = await supabase
      .from("facility_reservations")
      .select(
        "id, purpose, start_time, end_time, room:rooms(name), applicant:profiles(full_name)",
      )
      .eq("status", "pending")
      .gt("end_time", new Date().toISOString())
      .order("start_time")
      .limit(8);
    if (error) return [];
    const one = <T>(v: T | T[] | null) =>
      Array.isArray(v) ? (v[0] ?? null) : v;
    return (
      data as unknown as {
        id: string;
        purpose: string;
        start_time: string;
        end_time: string;
        room: { name: string } | { name: string }[] | null;
        applicant: { full_name: string } | { full_name: string }[] | null;
      }[]
    ).map((r) => ({
      id: r.id,
      purpose: r.purpose,
      room_name: one(r.room)?.name ?? "",
      start_time: r.start_time,
      end_time: r.end_time,
      applicant_name: one(r.applicant)?.full_name ?? null,
    }));
  } catch {
    return [];
  }
}

export function mockPendingReservations(): PendingReservation[] {
  const names = new Map(MOCK_ROOMS.map((r) => [r.id, r.name]));
  return mockBookings()
    .filter((b) => b.status === "pending")
    .map((b) => ({
      id: b.id,
      purpose: b.purpose,
      room_name: names.get(b.room_id) ?? "",
      start_time: b.start_time,
      end_time: b.end_time,
      applicant_name: b.applicant_name,
    }));
}

export interface MyReservation {
  id: string;
  purpose: string;
  room_name: string;
  start_time: string;
  end_time: string;
  status: ApprovalStatus;
}

/** The viewer's own requests from the last week onward, newest first, whatever their status. */
export async function getMyReservations(
  supabase: SupabaseClient,
  userId: string,
): Promise<MyReservation[]> {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
    const { data, error } = await supabase
      .from("facility_reservations")
      .select("id, purpose, start_time, end_time, status, room:rooms(name)")
      .eq("applicant_id", userId)
      .gt("end_time", since)
      .order("start_time", { ascending: false })
      .limit(6);
    if (error) return [];
    return (
      data as unknown as (Omit<MyReservation, "room_name"> & {
        room: { name: string } | { name: string }[] | null;
      })[]
    ).map(({ room, ...r }) => ({
      ...r,
      room_name: (Array.isArray(room) ? room[0] : room)?.name ?? "",
    }));
  } catch {
    return [];
  }
}

export function mockMyReservations(): MyReservation[] {
  const names = new Map(MOCK_ROOMS.map((r) => [r.id, r.name]));
  return mockBookings()
    .slice(0, 3)
    .map((b) => ({
      id: b.id,
      purpose: b.purpose,
      room_name: names.get(b.room_id) ?? "",
      start_time: b.start_time,
      end_time: b.end_time,
      status: b.status,
    }));
}

export interface ManagedRoom {
  id: string;
  building_id: string;
  room_number: string;
  name: string;
  capacity: number | null;
  is_bookable: boolean;
  requires_approval: boolean;
  equipment: string[];
}

/** Every room that is, or used to be, a hall (HALL-nn), open or closed, for the management page. */
export async function getManagedRooms(): Promise<{
  viewer: Viewer | null;
  rooms: ManagedRoom[];
} | null> {
  try {
    const s = await getSession();
    if (!s) return null;
    const { data, error } = await s.supabase
      .from("rooms")
      .select(
        "id, building_id, room_number, name, capacity, is_bookable, requires_approval, equipment, building:buildings!inner(code)",
      )
      .like("building.code", "HALL-%")
      .order("room_number");
    if (error) return { viewer: s.viewer, rooms: [] };
    return {
      viewer: s.viewer,
      rooms: (data as unknown as ManagedRoom[]).map((r) => ({
        id: r.id,
        building_id: r.building_id,
        room_number: r.room_number,
        name: r.name,
        capacity: r.capacity,
        equipment: r.equipment ?? [],
        requires_approval: Boolean(r.requires_approval),
        is_bookable: Boolean(r.is_bookable),
      })),
    };
  } catch {
    return null;
  }
}
