import type { Booking } from "@/lib/data/rooms";
import { atBangkok } from "@/lib/time";

/** Calendar grid: 07:00-20:00 in 30-minute rows. */
export const DAY_START = 7 * 60;
export const DAY_END = 20 * 60;
export const STEP = 30;

const ACTIVE = ["pending", "approved"];

/** The part of a booking that falls on a Bangkok day, as minutes since midnight. */
export function segmentOn(b: Booking, ymd: string): { start: number; end: number } | null {
  const dayStart = atBangkok(ymd, 0).getTime();
  const s = Math.max(new Date(b.start_time).getTime(), dayStart);
  const e = Math.min(new Date(b.end_time).getTime(), dayStart + 24 * 60 * 60_000);
  return e > s ? { start: (s - dayStart) / 60_000, end: (e - dayStart) / 60_000 } : null;
}

/** The booking that would clash with [start, end) in this room on this day, if any. */
export function findConflict(bookings: Booking[], roomId: string, ymd: string, start: number, end: number) {
  return bookings.find((b) => {
    if (b.room_id !== roomId || !ACTIVE.includes(b.status)) return false;
    const seg = segmentOn(b, ymd);
    return seg !== null && seg.start < end && seg.end > start;
  });
}

/** The latest a booking starting at `start` can end: the next booking's start, or closing time. */
export function latestEnd(bookings: Booking[], roomId: string, ymd: string, start: number) {
  let limit = DAY_END;
  for (const b of bookings) {
    if (b.room_id !== roomId || !ACTIVE.includes(b.status)) continue;
    const seg = segmentOn(b, ymd);
    if (seg && seg.start >= start && seg.start < limit) limit = seg.start;
  }
  return limit;
}
