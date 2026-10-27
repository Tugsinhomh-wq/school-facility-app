import { addDays, formatDateShort, isYmd, weekdayIndex } from "./time.ts";

export type DayState = "confirmed" | "late" | "pending" | "missed" | "off" | "future";
export type Confirmation = { isLate: boolean; byName: string };

/** The days the cleaning checks apply to (set by the administrator); null = no limit on that side. */
export type CheckWindow = { start: string | null; end: string | null };
export const NO_WINDOW: CheckWindow = { start: null, end: null };

/** A date that is not a real YYYY-MM-DD counts as not set, so garbage never turns the checks off. */
const edge = (d: unknown) => (isYmd(d) ? d : null);

/** Is `day` inside the window? No window, or an empty side, never excludes anything. */
export function inCheckWindow(day: string, w?: CheckWindow | null) {
  const start = edge(w?.start);
  const end = edge(w?.end);
  return !((start && day < start) || (end && day > end));
}

/** Where `today` stands: no window set, before it opens, inside it, or after it ended. */
export function windowStatus(today: string, w?: CheckWindow | null): "none" | "before" | "inside" | "after" {
  const start = edge(w?.start);
  const end = edge(w?.end);
  if (!start && !end) return "none";
  if (start && today < start) return "before";
  return end && today > end ? "after" : "inside";
}

/** The window in words, for the banner and the settings form. */
export function windowText(w: CheckWindow | null | undefined, today: string) {
  const start = edge(w?.start);
  const end = edge(w?.end);
  switch (windowStatus(today, w)) {
    case "none":
      return "เช็กทุกวันทำการ";
    case "before":
      return `ยังไม่เปิดเช็ก เริ่มวันที่ ${formatDateShort(start!)}`;
    case "after":
      return `สิ้นสุดการเช็กแล้ว เมื่อ ${formatDateShort(end!)}`;
    default:
      return start && end
        ? `เริ่มเช็กวันที่ ${formatDateShort(start)} ถึง ${formatDateShort(end)}`
        : start
          ? `เริ่มเช็กวันที่ ${formatDateShort(start)}`
          : `เช็กถึงวันที่ ${formatDateShort(end!)}`;
  }
}

/** A confirmation always wins, even on a holiday; otherwise weekends, holidays and days outside the window are off. */
export function dayState({ ymd, today, offDays, confirmation, window }: {
  ymd: string;
  today: string;
  offDays: ReadonlySet<string>;
  confirmation: Confirmation | null;
  window?: CheckWindow | null;
}): DayState {
  if (confirmation) return confirmation.isLate ? "late" : "confirmed";
  if (weekdayIndex(ymd) >= 5 || offDays.has(ymd) || !inCheckWindow(ymd, window)) return "off";
  if (ymd > today) return "future";
  return ymd === today ? "pending" : "missed";
}

/** Mon-Fri of the week starting at `monday`. Extra fields on the confirmations are passed through. */
export function weekGrid<C extends Confirmation>({ monday, today, offDays, confirmations, window }: {
  monday: string;
  today: string;
  offDays: ReadonlySet<string>;
  confirmations: ReadonlyMap<string, C>;
  window?: CheckWindow | null;
}) {
  return Array.from({ length: 5 }, (_, i) => {
    const ymd = addDays(monday, i);
    const confirmation = confirmations.get(ymd) ?? null;
    return { ymd, state: dayState({ ymd, today, offDays, confirmation, window }), confirmation };
  });
}

/**
 * Last week's days a teacher can still confirm late: missed, and within 7 calendar days of today
 * (the limit of the `confirm_cleaning` RPC). `lastWeek` is that week's Mon-Fri grid.
 */
export const lateReachable = <D extends { ymd: string; state: DayState }>(lastWeek: D[], today: string) =>
  lastWeek.filter((d) => d.state === "missed" && d.ymd >= addDays(today, -7));

/** "ม.3/2" before "ม.3/10": compare numbers inside room names by value, not by character. */
export const compareRoomNames = (a: string, b: string) =>
  a.localeCompare(b, "th", { numeric: true });

/** The officer overview order: rooms still missing today's confirmation first, then by name. */
export function overviewOrder<T>(rows: T[], isMissing: (row: T) => boolean, nameOf: (row: T) => string) {
  return [...rows].sort(
    (a, b) => Number(isMissing(b)) - Number(isMissing(a)) || compareRoomNames(nameOf(a), nameOf(b)),
  );
}

/**
 * A room's week total: confirmed days out of the days that were due. Today counts as due only once
 * it is confirmed (until the day ends it is "pending", not missed); off and future days never count.
 */
export function weekTally(days: { state: DayState }[]) {
  let done = 0;
  let due = 0;
  for (const { state } of days) {
    const confirmed = state === "confirmed" || state === "late";
    if (confirmed) done++;
    if (confirmed || state === "missed") due++;
  }
  return { done, due };
}

/** A confirmation can be cancelled only on its own day or the next (the `cancel_cleaning` RPC enforces it). */
export const canCancelDay = (day: string, today: string) =>
  isYmd(day) && isYmd(today) && (day === today || day === addDays(today, -1));

/** A storage path the app may delete after a cancellation: "<uuid>/<file>" in the bucket, nothing that climbs out of it. */
export const isPhotoPath = (p: unknown): p is string =>
  typeof p === "string" && !p.includes("..") && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\/[^/\s]+$/i.test(p);
