import { Check, Clock, ImageIcon } from "lucide-react";

import type { WeekDay } from "@/components/cleaning/week-strip";
import { weekTally, type DayState } from "@/lib/cleaning";
import type { ClassroomRow } from "@/lib/data/cleaning";
import { formatDayShort, formatInstantHm } from "@/lib/time";
import { cn } from "@/lib/utils";

export type WeekRow = { room: ClassroomRow; days: WeekDay[] };

/** One tint per weekday, like the days of a pill organiser. A colour of plastic, never a state. */
const DAY_TINTS = ["bg-tray-1", "bg-tray-2", "bg-tray-3", "bg-tray-4", "bg-tray-5"] as const;

const LABEL: Record<DayState, string> = {
  confirmed: "ยืนยันแล้ว",
  late: "ยืนยันย้อนหลัง",
  pending: "รอ",
  missed: "ขาด",
  off: "หยุด",
  future: "",
};

/**
 * One day of one room: a confirmed day is a green-ringed tick, a day still open is a plain grey word (no alarm
 * colour), a holiday is dimmed. Words are always there for a screen reader, and for a sighted reader wherever the
 * mark is not a tick.
 */
function DaySlot({ d, i, className }: { d: WeekDay; i: number; className?: string }) {
  const c = d.confirmation;
  const confirmed = d.state === "confirmed" || d.state === "late";
  const title = [
    `${formatDayShort(d.ymd)}: ${LABEL[d.state] || "ยังไม่ถึง"}`,
    c && `โดย ${c.byName} ${formatInstantHm(c.at)} น.`,
    c && c.photos > 0 && `มีรูป ${c.photos} รูป`,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <span
      title={title}
      className={cn(
        "inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-lg text-xs font-medium ring-1 ring-black/5",
        DAY_TINTS[i % DAY_TINTS.length],
        d.state === "off" && "opacity-60",
        d.state === "future" && "opacity-40",
        className,
      )}
    >
      {confirmed ? (
        <>
          <span
            className={cn(
              "inline-grid size-7 place-items-center rounded-full bg-card text-emerald-800 ring-2 ring-emerald-700",
              d.state === "late" && "ring-emerald-700/50",
            )}
          >
            <Check className="size-4" strokeWidth={3} aria-hidden />
            <span className="sr-only">{LABEL[d.state]}</span>
          </span>
          {c && c.photos > 0 && <ImageIcon className="size-3 opacity-70" role="img" aria-label={`มีรูป ${c.photos} รูป`} />}
        </>
      ) : (
        <span className={cn("inline-flex items-center gap-0.5", d.state === "missed" ? "text-foreground/70" : "text-foreground/60")}>
          {d.state === "pending" && <Clock className="size-3.5" aria-hidden />}
          {LABEL[d.state]}
        </span>
      )}
    </span>
  );
}

/**
 * Room × Mon-Fri for one week, set like a pill organiser. "รวม" is confirmed days out of the days that were due
 * (today counts once confirmed; holidays and days still to come do not). On a phone the table (640px) would hide
 * Wednesday to Friday behind a sideways swipe, so there each room is a card with its five days in a row.
 */
export function WeeklyTable({ rows, monday }: { rows: WeekRow[]; monday: string }) {
  const days = rows[0]?.days.map((d) => d.ymd) ?? [];
  return (
    <>
      <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border md:hidden">
        {/* The five weekdays once, above the list: every room's row of slots lines up under them. */}
        <div aria-hidden className="grid grid-cols-5 gap-1 border-b border-border bg-muted/40 px-3 py-1.5 text-center text-xs font-medium text-muted-foreground">
          {days.map((ymd) => (
            <span key={ymd}>{formatDayShort(ymd).split(" ")[0]}</span>
          ))}
        </div>
        <ul className="divide-y divide-border" aria-label="สรุปรายห้อง">
          {rows.map(({ room, days: roomDays }) => {
            const { done, due } = weekTally(roomDays);
            return (
              <li key={room.id} className="space-y-1.5 px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0">
                    <span className="font-semibold tabular-nums">{room.name}</span>
                    <span className="block text-xs break-words text-muted-foreground">
                      {room.advisors.map((a) => a.name).join(", ") || "ยังไม่มีครูที่ปรึกษา"}
                    </span>
                  </p>
                  <p className="shrink-0 text-sm tabular-nums">
                    <span className="sr-only">รวม </span>
                    {due === 0 ? "–" : `${done} / ${due}`}
                  </p>
                </div>
                <ol className="grid grid-cols-5 gap-1">
                  {roomDays.map((d, i) => (
                    <li key={d.ymd} className="min-w-0">
                      <span className="sr-only">{formatDayShort(d.ymd).split(" ")[0]} </span>
                      <DaySlot d={d} i={i} />
                    </li>
                  ))}
                </ol>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="hidden overflow-x-auto rounded-2xl bg-card ring-1 ring-border md:block">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">สรุปการยืนยันเขตทำความสะอาดรายสัปดาห์ เริ่ม {formatDayShort(monday)}</caption>
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className="sticky left-0 bg-card px-3 py-2 font-semibold">
                ห้อง
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                ครูที่ปรึกษา
              </th>
              {days.map((ymd) => {
                const [dow, date] = formatDayShort(ymd).split(" ");
                return (
                  <th key={ymd} scope="col" className="px-1.5 py-2 text-center font-semibold">
                    {dow} {date}
                  </th>
                );
              })}
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                รวม
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ room, days: roomDays }) => {
              const { done, due } = weekTally(roomDays);
              return (
                <tr key={room.id} className="border-b border-border last:border-b-0">
                  <th scope="row" className="sticky left-0 bg-card px-3 py-2 text-left font-semibold whitespace-nowrap tabular-nums">
                    {room.name}
                  </th>
                  <td className="max-w-48 px-3 py-2 text-xs text-muted-foreground">
                    {room.advisors.map((a) => a.name).join(", ") || "ยังไม่มีครูที่ปรึกษา"}
                  </td>
                  {roomDays.map((d, i) => (
                    <td key={d.ymd} className="min-w-16 px-1 py-1.5 text-center">
                      <DaySlot d={d} i={i} />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{due === 0 ? "–" : `${done} / ${due}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
