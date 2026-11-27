import type { SupabaseClient } from "@supabase/supabase-js";

import type { Viewer } from "@/lib/data/dashboard";
import { getSession, isVehicleApprover } from "@/lib/data/session";
import { addDays, atBangkok, bangkokYmd } from "@/lib/time";
import type { VehicleBooking, VehicleInfo } from "@/lib/vehicle";
import type { ApprovalStatus } from "@/types/database";

/** A trip of the signed-in user, whatever its status, for the "my trips" list. */
export interface MyTrip {
  id: string;
  vehicle_id: string;
  destination: string;
  start_time: string;
  end_time: string;
  status: ApprovalStatus;
}

export interface VehiclePage {
  source: "supabase" | "mock";
  viewer: Viewer | null;
  userId: string | null;
  vehicles: VehicleInfo[];
  /** Pending and approved trips around the shown week, for the calendar and the clash check. */
  bookings: VehicleBooking[];
  /** Requests waiting for a decision, for approvers only. */
  pending: VehicleBooking[];
  mine: MyTrip[];
  /** Signed in, but loading failed: show an error with a retry instead of sample data. */
  failed?: boolean;
}

/** The calendar shows one week; trips are loaded a week back and five weeks ahead so a long trip's clash is seen. */
const BEFORE_DAYS = 7;
const AFTER_DAYS = 42;

const VEHICLE_SELECT = "id, kind, name, plate, seats, has_driver, requires_approval";
const SHARED_SELECT = "id, vehicle_id, applicant_id, destination, purpose, passenger_count, driver_name, start_time, end_time, status, applicant:profiles(full_name)";
const FULL_SELECT = `${SHARED_SELECT}, contact_phone`;

type Row = Omit<VehicleBooking, "applicant_name" | "contact_phone"> & {
  contact_phone?: string | null;
  applicant: { full_name: string } | { full_name: string }[] | null;
};
const toBooking = ({ applicant, contact_phone, ...b }: Row): VehicleBooking => ({
  ...b,
  contact_phone: contact_phone ?? null,
  applicant_name: (Array.isArray(applicant) ? applicant[0] : applicant)?.full_name ?? null,
});

/** The sample vehicles and trips for the demo, when Supabase is not set up. */
function mockPage(weekStart: string): VehiclePage {
  const vehicles: VehicleInfo[] = [
    { id: "v1", kind: "van", name: "รถตู้", plate: null, seats: 12, has_driver: true, requires_approval: true },
    { id: "v2", kind: "songthaew", name: "รถสองแถวโรงเรียน", plate: null, seats: 20, has_driver: true, requires_approval: true },
    { id: "v3", kind: "pickup", name: "รถกระบะ", plate: null, seats: 3, has_driver: false, requires_approval: false },
  ];
  const today = bangkokYmd(new Date());
  const t = (offset: number, min: number) => atBangkok(addDays(today, offset), min).toISOString();
  const base = { applicant_id: "mock-user", contact_phone: null, driver_name: null };
  const bookings: VehicleBooking[] = [
    { ...base, id: "m1", vehicle_id: "v1", applicant_name: "ครูวิชัย มั่นคง", destination: "สนามกีฬาจังหวัด", purpose: "พานักกีฬาไปแข่งขัน", passenger_count: 10, start_time: t(1, 7 * 60), end_time: t(3, 17 * 60), status: "approved" },
    { ...base, id: "m2", vehicle_id: "v2", applicant_name: "ครูสมหญิง ใจดี", destination: "พิพิธภัณฑ์", purpose: "ทัศนศึกษา ม.2", passenger_count: 18, start_time: t(4, 6 * 60 + 30), end_time: t(4, 16 * 60), status: "pending" },
    { ...base, id: "m3", vehicle_id: "v3", applicant_name: "ครูนภา ศรีสุข", destination: "ร้านวัสดุ", purpose: "ซื้อวัสดุงานโรงเรียน", passenger_count: 2, driver_name: "ครูนภา ศรีสุข", start_time: t(0, 13 * 60), end_time: t(0, 15 * 60), status: "approved" },
  ];
  const from = atBangkok(addDays(weekStart, -BEFORE_DAYS), 0).toISOString();
  const to = atBangkok(addDays(weekStart, AFTER_DAYS), 0).toISOString();
  return {
    source: "mock",
    viewer: null,
    userId: null,
    vehicles,
    bookings: bookings.filter((b) => b.end_time > from && b.start_time < to),
    pending: [],
    mine: [],
  };
}

/** Vehicles, the trips around `weekStart` (a Bangkok Monday), and what the signed-in user needs beside the calendar. */
export async function getVehiclePage(weekStart: string): Promise<VehiclePage> {
  const failed = (): VehiclePage => ({ source: "supabase", viewer: null, userId: null, vehicles: [], bookings: [], pending: [], mine: [], failed: true });
  let signedIn = false;
  try {
    const s = await getSession();
    if (!s) return mockPage(weekStart);
    signedIn = true;
    const from = atBangkok(addDays(weekStart, -BEFORE_DAYS), 0).toISOString();
    const to = atBangkok(addDays(weekStart, AFTER_DAYS), 0).toISOString();
    const now = new Date().toISOString();
    const approver = isVehicleApprover(s.viewer.role);
    const [vehicles, bookings, pending, mine] = await Promise.all([
      s.supabase.from("vehicles").select(VEHICLE_SELECT).eq("is_bookable", true).order("sort_order"),
      s.supabase.from("vehicle_reservations").select(SHARED_SELECT).in("status", ["pending", "approved"]).gt("end_time", from).lt("start_time", to).order("start_time"),
      approver
        ? s.supabase.from("vehicle_reservations").select(FULL_SELECT).eq("status", "pending").gt("end_time", now).order("start_time").limit(20)
        : Promise.resolve({ data: [], error: null }),
      s.supabase
        .from("vehicle_reservations")
        .select("id, vehicle_id, destination, start_time, end_time, status")
        .eq("applicant_id", s.userId)
        .gt("end_time", now)
        .order("start_time")
        .limit(10),
    ]);
    if (vehicles.error || bookings.error || pending.error || mine.error) return failed();
    return {
      source: "supabase",
      viewer: s.viewer,
      userId: s.userId,
      vehicles: vehicles.data as unknown as VehicleInfo[],
      bookings: (bookings.data as unknown as Row[]).map(toBooking),
      pending: (pending.data as unknown as Row[]).map(toBooking),
      mine: mine.data as unknown as MyTrip[],
    };
  } catch {
    return signedIn ? failed() : mockPage(weekStart);
  }
}

/** How many requests wait for a decision, for the director's summary page. Zero when the table is not there yet. */
export async function countPendingVehicleRequests(supabase: SupabaseClient): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("vehicle_reservations")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .gt("end_time", new Date().toISOString());
    return error ? 0 : (count ?? 0);
  } catch {
    return 0;
  }
}
