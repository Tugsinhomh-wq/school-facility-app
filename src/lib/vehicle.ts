/**
 * Vehicle booking rules that run in both the browser and the server action. No `@/` imports: the node test runner
 * loads this file directly.
 */
import { atBangkok, bangkokMinutes, bangkokYmd, isYmd } from "./time.ts";

export type VehicleKind = "van" | "songthaew" | "pickup";
export type VehicleStatus = "pending" | "approved";

export const KIND_LABEL: Record<VehicleKind, string> = {
  van: "รถตู้",
  songthaew: "รถสองแถว",
  pickup: "รถกระบะ",
};

export interface VehicleInfo {
  id: string;
  kind: VehicleKind;
  name: string;
  plate: string | null;
  seats: number | null;
  has_driver: boolean;
  requires_approval: boolean;
}

export interface VehicleBooking {
  id: string;
  vehicle_id: string;
  applicant_id: string;
  applicant_name: string | null;
  destination: string;
  purpose: string;
  passenger_count: number;
  /** Null on the shared calendar: only the applicant and the approvers see the number. */
  contact_phone: string | null;
  driver_name: string | null;
  start_time: string;
  end_time: string;
  status: VehicleStatus;
}

/** Trips start and end on the half hour, between these two times. */
export const FIRST_MIN = 5 * 60;
export const LAST_MIN = 22 * 60;
export const STEP = 30;
/** Longest trip, in days counted from the departure day to the return day. */
export const MAX_TRIP_DAYS = 14;
const DAY_MS = 24 * 60 * 60_000;

/** Two half-open time spans clash when each starts before the other ends. */
export const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && aEnd > bStart;

/** The booking that would clash with [start, end) on this vehicle, if any. */
export function findVehicleConflict(bookings: VehicleBooking[], vehicleId: string, start: number, end: number) {
  return bookings.find((b) => b.vehicle_id === vehicleId && overlaps(Date.parse(b.start_time), Date.parse(b.end_time), start, end));
}

export interface DayItem {
  booking: VehicleBooking;
  /** Minutes since midnight that the trip covers on this day (a trip that began earlier starts at 0). */
  from: number;
  to: number;
}

/** What a vehicle is doing on one Bangkok day: each trip that touches it, clipped to the day, earliest first. */
export function itemsOn(bookings: VehicleBooking[], vehicleId: string, ymd: string): DayItem[] {
  const dayStart = atBangkok(ymd, 0).getTime();
  const dayEnd = dayStart + DAY_MS;
  const out: DayItem[] = [];
  for (const booking of bookings) {
    if (booking.vehicle_id !== vehicleId) continue;
    const s = Date.parse(booking.start_time);
    const e = Date.parse(booking.end_time);
    if (!overlaps(s, e, dayStart, dayEnd)) continue;
    out.push({ booking, from: Math.round((Math.max(s, dayStart) - dayStart) / 60_000), to: Math.round((Math.min(e, dayEnd) - dayStart) / 60_000) });
  }
  return out.sort((a, b) => a.from - b.from);
}

/** Calendar days a trip touches, counting both the departure and the return day. */
export function tripDays(startYmd: string, endYmd: string) {
  return Math.round((Date.parse(`${endYmd}T00:00:00Z`) - Date.parse(`${startYmd}T00:00:00Z`)) / DAY_MS) + 1;
}

export interface RequestInput {
  vehicleId: string;
  startYmd: string;
  startMin: number;
  endYmd: string;
  endMin: number;
  destination: string;
  purpose: string;
  passengers: number;
  phone: string;
  driverName: string;
}

/** Digits of a phone number as typed ("081-234 5678" gives "0812345678"). */
export const phoneDigits = (s: string) => s.replace(/\D/g, "");

/** The first thing wrong with a request, in Thai for the form, or null when it can go to the database. */
export function validateRequest(
  r: RequestInput,
  vehicle: { seats: number | null; has_driver: boolean },
  now: Date,
): string | null {
  if (!r.vehicleId || !isYmd(r.startYmd) || !isYmd(r.endYmd) || !Number.isInteger(r.startMin) || !Number.isInteger(r.endMin))
    return "ข้อมูลวันและเวลาไม่ถูกต้อง";
  for (const m of [r.startMin, r.endMin])
    if (m < FIRST_MIN || m > LAST_MIN || m % STEP !== 0) return "เวลาต้องอยู่ระหว่าง 05:00-22:00 และเป็นช่วงละ 30 นาที";
  const start = atBangkok(r.startYmd, r.startMin).getTime();
  const end = atBangkok(r.endYmd, r.endMin).getTime();
  if (end <= start) return "เวลากลับต้องหลังเวลาออกรถ";
  if (start < now.getTime() - 5 * 60_000) return "ไม่สามารถจองย้อนหลังได้";
  if (tripDays(r.startYmd, r.endYmd) > MAX_TRIP_DAYS) return `ใช้รถต่อเนื่องได้ไม่เกิน ${MAX_TRIP_DAYS} วัน`;
  if (!r.destination.trim() || r.destination.trim().length > 200) return "กรุณากรอกจุดหมายปลายทาง ไม่เกิน 200 ตัวอักษร";
  if (!r.purpose.trim() || r.purpose.trim().length > 200) return "กรุณากรอกเรื่องที่ไป ไม่เกิน 200 ตัวอักษร";
  if (!Number.isInteger(r.passengers) || r.passengers < 1 || r.passengers > 200) return "จำนวนผู้โดยสารไม่ถูกต้อง";
  if (vehicle.seats && r.passengers > vehicle.seats) return `รถคันนี้นั่งได้ ${vehicle.seats} คน`;
  const digits = phoneDigits(r.phone);
  if (digits.length < 9 || digits.length > 10) return "กรุณากรอกเบอร์โทรติดต่อ 9-10 หลัก";
  if (!vehicle.has_driver && (!r.driverName.trim() || r.driverName.trim().length > 100)) return "กรุณาระบุชื่อผู้ขับรถ";
  return null;
}

/** "ไป 3 วัน 2 คืน" for a trip over several days, "ไป-กลับวันเดียว" for one. */
export function tripLength(startYmd: string, endYmd: string) {
  const days = tripDays(startYmd, endYmd);
  return days <= 1 ? "ไป-กลับวันเดียว" : `${days} วัน ${days - 1} คืน`;
}

/** The departure and return of a stored trip as Bangkok dates and minutes. */
export function tripSpan(b: Pick<VehicleBooking, "start_time" | "end_time">) {
  const s = new Date(b.start_time);
  const e = new Date(b.end_time);
  return { startYmd: bangkokYmd(s), startMin: bangkokMinutes(s), endYmd: bangkokYmd(e), endMin: bangkokMinutes(e) };
}
