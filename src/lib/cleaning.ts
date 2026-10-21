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
