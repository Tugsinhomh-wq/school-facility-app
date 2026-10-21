import { addDays, weekdayIndex } from "./time.ts";

export type DayState = "confirmed" | "late" | "pending" | "missed" | "off" | "future";
export type Confirmation = { isLate: boolean; byName: string };

/** A confirmation always wins, even on a holiday; otherwise weekends/holidays are off. */
export function dayState({ ymd, today, offDays, confirmation }: {
  ymd: string;
  today: string;
  offDays: ReadonlySet<string>;
  confirmation: Confirmation | null;
}): DayState {
  if (confirmation) return confirmation.isLate ? "late" : "confirmed";
  if (weekdayIndex(ymd) >= 5 || offDays.has(ymd)) return "off";
  if (ymd > today) return "future";
  return ymd === today ? "pending" : "missed";
}

/** Mon-Fri of the week starting at `monday`. Extra fields on the confirmations are passed through. */
export function weekGrid<C extends Confirmation>({ monday, today, offDays, confirmations }: {
  monday: string;
  today: string;
  offDays: ReadonlySet<string>;
  confirmations: ReadonlyMap<string, C>;
}) {
  return Array.from({ length: 5 }, (_, i) => {
    const ymd = addDays(monday, i);
    const confirmation = confirmations.get(ymd) ?? null;
    return { ymd, state: dayState({ ymd, today, offDays, confirmation }), confirmation };
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
