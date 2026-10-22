import { compareRoomNames, dayState, weekTally } from "./cleaning.ts";
import { addDays } from "./time.ts";

export type ReportRoom = {
  name: string;
  zone: string;
  advisors: string;
  /** First day (YYYY-MM-DD) the room existed; earlier days are not due for it. */
  since: string;
  /** YYYY-MM-DD of every day this room was confirmed (on time or late). */
  confirmed: ReadonlySet<string>;
};

export type ReportRow = Omit<ReportRoom, "confirmed" | "since"> & {
  due: number;
  done: number;
  missing: number;
  /** 0..1, null when nothing was due. */
  pct: number | null;
};

const ratio = (done: number, due: number) => (due > 0 ? done / due : null);

/**
 * Per room, confirmed days out of the days that were due in `from`..`to` (same counting as the
 * weekly table: weekends, off days and days not yet over are not due; nor are days before the
 * room existed). Sorted by room name.
 */
export function reportRows({
  rooms,
  from,
  to,
  today,
  offDays,
}: {
  rooms: ReportRoom[];
  from: string;
  to: string;
  today: string;
  offDays: ReadonlySet<string>;
}) {
  const last = to < today ? to : today;

  const rows: ReportRow[] = rooms.map(({ confirmed, since, ...room }) => {
    // A room added mid-period (or copied in by a rollover) owes nothing before it existed.
    const days: string[] = [];
    for (let d = from > since ? from : since; d <= last; d = addDays(d, 1))
      days.push(d);
    const { done, due } = weekTally(
      days.map((ymd) => ({
        state: dayState({
          ymd,
          today,
          offDays,
          confirmation: confirmed.has(ymd)
            ? { isLate: false, byName: "" }
            : null,
        }),
      })),
    );
    return { ...room, due, done, missing: due - done, pct: ratio(done, due) };
  });
  rows.sort((a, b) => compareRoomNames(a.name, b.name));

  const done = rows.reduce((n, r) => n + r.done, 0);
  const due = rows.reduce((n, r) => n + r.due, 0);
  return {
    rows,
    total: { due, done, missing: due - done, pct: ratio(done, due) },
  };
}
