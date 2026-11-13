import type { Booking } from "@/lib/data/rooms";
import { DAY_END, DAY_START, segmentOn, STEP } from "@/lib/meeting";
import { addDays, atBangkok, bangkokMinutes, bangkokYmd } from "@/lib/time";

/** The start of every hour on the grid (07:00 to 19:00), for the rows of a lane or a sheet. */
export const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START + i * 60);

/** Where a time span sits in a lane that runs DAY_START to DAY_END, as percentages of its height. */
export function lanePos(start: number, end: number) {
  const span = DAY_END - DAY_START;
  const s = Math.max(start, DAY_START);
  const e = Math.min(end, DAY_END);
  return { top: ((s - DAY_START) / span) * 100, height: Math.max(0, ((e - s) / span) * 100) };
}

/** The part of a booking on a day, in whole minutes (a booking made at 10:07:30 would otherwise print as 10:07.5). */
export function segOn(b: Booking, ymd: string) {
  const seg = segmentOn(b, ymd);
  return seg && { start: Math.round(seg.start), end: Math.round(seg.end) };
}

/** The seven days of the week starting at `weekStart` (a Monday). */
export const weekDays = (weekStart: string) => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

/** One room right now: in use (an approved booking covers this minute), free until the next booking, or outside booking hours. */
export type RoomNow = { kind: "busy"; until: number } | { kind: "free"; until: number | null } | { kind: "closed" };

export function roomNow(bookings: Booking[], roomId: string, now: Date): RoomNow {
  const ymd = bangkokYmd(now);
  const min = bangkokMinutes(now);
  if (min < DAY_START || min >= DAY_END) return { kind: "closed" };
  let nextStart: number | null = null;
  for (const b of bookings) {
    if (b.room_id !== roomId || (b.status !== "approved" && b.status !== "pending")) continue;
    const seg = segOn(b, ymd);
    if (!seg) continue;
    if (b.status === "approved" && seg.start <= min && seg.end > min) return { kind: "busy", until: seg.end };
    if (seg.start > min && (nextStart === null || seg.start < nextStart)) nextStart = seg.start;
  }
  return { kind: "free", until: nextStart };
}

/** The first half hour on `ymd` that is neither past nor taken, or the start of the day when none is left. */
export function firstFreeStart(bookings: Booking[], roomId: string, ymd: string, now: Date | null) {
  const isPast = (m: number) => (now ? atBangkok(ymd, m + STEP).getTime() <= now.getTime() : false);
  for (let m = DAY_START; m < DAY_END; m += STEP) {
    if (isPast(m)) continue;
    const taken = bookings.some((b) => {
      if (b.room_id !== roomId || (b.status !== "approved" && b.status !== "pending")) return false;
      const seg = segmentOn(b, ymd);
      return seg !== null && seg.start < m + STEP && seg.end > m;
    });
    if (!taken) return m;
  }
  return DAY_START;
}
