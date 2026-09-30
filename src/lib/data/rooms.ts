import type { SupabaseClient } from "@supabase/supabase-js";

import type { Viewer } from "@/lib/data/dashboard";
import { getSession } from "@/lib/data/session";
import { MOCK_ROOMS, mockBookings } from "@/lib/mock-data";
import { addDays, atBangkok, bangkokYmd, formatInstantHm } from "@/lib/time";
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

/** A row of the v_live_room_status view. */
export interface LiveRoom {
  room_id: string;
  room_name: string;
  building_name: string;
  capacity: number | null;
  current_status: "busy" | "available";
  active_meeting_title: string | null;
  active_meeting_until: string | null;
  booked_by: string | null;
}

export interface TodayMeeting {
  id: string;
  room_name: string;
  title: string;
  start_time: string;
  end_time: string;
}

export interface MeetingWeek {
  source: "supabase" | "mock";
  viewer: Viewer | null;
  userId: string | null;
  rooms: RoomInfo[];
  bookings: Booking[];
}

const ROOM_SELECT = "id, room_number, name, capacity, requires_approval, equipment, building:buildings(name)";
type RoomRow = { id: string; room_number: string; name: string; capacity: number | null; requires_approval: boolean | null; equipment: string[] | null; building: { name: string } | { name: string }[] | null };

const toRoom = (r: RoomRow): RoomInfo => {
  const building = Array.isArray(r.building) ? r.building[0] : r.building;
  return { id: r.id, room_number: r.room_number, name: r.name, building_name: building?.name ?? "", capacity: r.capacity, requires_approval: Boolean(r.requires_approval), equipment: r.equipment ?? [] };
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
    bookings: mockBookings().filter((b) => b.end_time > from && b.start_time < to),
  });

  try {
    const s = await getSession();
    if (!s) return mock();
    const [rooms, bookings] = await Promise.all([
      s.supabase.from("rooms").select(ROOM_SELECT).eq("is_bookable", true).order("name"),
      s.supabase
        .from("facility_reservations")
        .select("id, room_id, applicant_id, purpose, attendee_count, equipment_needed, start_time, end_time, status, applicant:profiles(full_name)")
        .in("status", ["pending", "approved"])
        .gt("end_time", from)
        .lt("start_time", to)
        .order("start_time"),
    ]);
    // Before the meeting-room SQL has been run these queries fail; show the demo instead of an error page.
    if (rooms.error || bookings.error) return mock();
    return {
      source: "supabase",
      viewer: s.viewer,
      userId: s.userId,
      rooms: (rooms.data as unknown as RoomRow[]).map(toRoom),
      bookings: (bookings.data as unknown as (Omit<Booking, "applicant_name"> & { applicant: { full_name: string } | { full_name: string }[] | null })[]).map(
        ({ applicant, ...b }) => ({ ...b, applicant_name: (Array.isArray(applicant) ? applicant[0] : applicant)?.full_name ?? null }),
      ),
    };
  } catch {
    return mock();
  }
}

export interface RoomSnapshot {
  liveRooms: LiveRoom[];
  todayMeetings: TodayMeeting[];
  roomsInUseToday: number;
}

export function mockRoomSnapshot(): RoomSnapshot {
  const now = new Date().toISOString();
  const bookings = mockBookings();
  const today = bangkokYmd(new Date());
  const names = new Map(MOCK_ROOMS.map((r) => [r.id, r]));
  const approvedToday = bookings.filter((b) => b.status === "approved" && bangkokYmd(new Date(b.start_time)) === today);
  return {
    liveRooms: MOCK_ROOMS.map((r) => {
      const active = bookings.find((b) => b.room_id === r.id && b.status === "approved" && b.start_time <= now && now < b.end_time);
      return { room_id: r.id, room_name: r.name, building_name: r.building_name, capacity: r.capacity, current_status: active ? "busy" : "available", active_meeting_title: active?.purpose ?? null, active_meeting_until: active?.end_time ?? null, booked_by: active?.applicant_name ?? null };
    }),
    todayMeetings: approvedToday.map((b) => ({ id: b.id, room_name: names.get(b.room_id)?.name ?? "", title: b.purpose, start_time: b.start_time, end_time: b.end_time })),
    roomsInUseToday: new Set(approvedToday.map((b) => b.room_id)).size,
  };
}

/** Live status and today's meetings for the dashboard. Empty (not an error) if the SQL is not installed yet. */
export async function getRoomSnapshot(supabase: SupabaseClient): Promise<RoomSnapshot> {
  const empty: RoomSnapshot = { liveRooms: [], todayMeetings: [], roomsInUseToday: 0 };
  try {
    const today = bangkokYmd(new Date());
    const dayStart = atBangkok(today, 0).toISOString();
    const dayEnd = atBangkok(addDays(today, 1), 0).toISOString();
    const [live, meetings] = await Promise.all([
      supabase.from("v_live_room_status").select("*").order("room_name"),
      supabase
        .from("facility_reservations")
        .select("id, room_id, purpose, start_time, end_time, room:rooms(name)")
        .eq("status", "approved")
        .gt("end_time", dayStart)
        .lt("start_time", dayEnd)
        .order("start_time"),
    ]);
    if (live.error || meetings.error) return empty;
    const rows = meetings.data as unknown as { id: string; room_id: string; purpose: string; start_time: string; end_time: string; room: { name: string } | { name: string }[] | null }[];
    return {
      liveRooms: live.data as LiveRoom[],
      todayMeetings: rows.map((m) => ({ id: m.id, room_name: (Array.isArray(m.room) ? m.room[0] : m.room)?.name ?? "", title: m.purpose, start_time: m.start_time, end_time: m.end_time })),
      roomsInUseToday: new Set(rows.map((m) => m.room_id)).size,
    };
  } catch {
    return empty;
  }
}

/** "09:00-10:30 น. ห้องประชุมใหญ่: ประชุมครู" */
export function meetingLine(m: TodayMeeting) {
  return `${formatInstantHm(m.start_time)}-${formatInstantHm(m.end_time)} น. ${m.room_name}: ${m.title}`;
}
