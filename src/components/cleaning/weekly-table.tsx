import { Check, Clock, ImageIcon, Minus, X } from "lucide-react";

import type { WeekDay } from "@/components/cleaning/week-strip";
import { weekTally, type DayState } from "@/lib/cleaning";
import type { ClassroomRow } from "@/lib/data/cleaning";
import { formatDayShort, formatInstantHm } from "@/lib/time";
import { cn } from "@/lib/utils";

export type WeekRow = { room: ClassroomRow; days: WeekDay[] };

const CELL: Record<DayState, { label: string; icon: typeof Check | null; className: string }> = {
  confirmed: {
    label: "ยืนยันแล้ว",
    icon: Check,
    className: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  },
  late: {
    label: "ย้อนหลัง",
    icon: Check,
    className:
      "bg-emerald-500/5 text-emerald-800 ring-1 ring-emerald-600/40 ring-inset dark:text-emerald-300",
  },
  pending: {
    label: "รอ",
    icon: Clock,
    className: "bg-amber-500/10 text-amber-900 dark:text-amber-200",
  },
  missed: {
    label: "ขาด",
    icon: X,
    className: "bg-red-500/10 text-red-800 dark:text-red-300",
  },
  off: { label: "หยุด", icon: Minus, className: "bg-muted text-muted-foreground" },
  future: { label: "", icon: null, className: "text-muted-foreground/60" },
};

/**
 * Room × Mon-Fri for one week. "รวม" is confirmed days out of the days that were due (today
 * counts once confirmed; holidays and days still to come do not). Wider than a phone, so it
 * scrolls sideways inside its own box while the page itself does not.
 */
export function WeeklyTable({ rows, monday }: { rows: WeekRow[]; monday: string }) {
  const days = rows[0]?.days.map((d) => d.ymd) ?? [];
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <caption className="sr-only">
          สรุปการยืนยันเขตทำความสะอาดรายสัปดาห์ เริ่ม {formatDayShort(monday)}
        </caption>
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
          {rows.map(({ room, days }) => {
            const { done, due } = weekTally(days);
            return (
              <tr key={room.id} className="border-b border-border last:border-b-0">
                <th
                  scope="row"
                  className="sticky left-0 bg-card px-3 py-2 text-left font-semibold whitespace-nowrap tabular-nums"
                >
                  {room.name}
                </th>
                <td className="max-w-48 px-3 py-2 text-xs text-muted-foreground">
                  {room.advisors.map((a) => a.name).join(", ") || "–"}
                </td>
                {days.map((d) => {
                  const look = CELL[d.state];
                  const Icon = look.icon;
                  const c = d.confirmation;
                  const title = [
                    `${formatDayShort(d.ymd)}: ${look.label || "ยังไม่ถึง"}`,
                    c && `โดย ${c.byName} ${formatInstantHm(c.at)} น.`,
                    c && c.photos > 0 && `มีรูป ${c.photos} รูป`,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <td key={d.ymd} className="px-1 py-1.5 text-center">
                      <span
                        title={title}
                        className={cn(
                          "inline-flex min-h-8 min-w-14 items-center justify-center gap-0.5 rounded-md px-1.5 text-xs font-medium",
                          look.className,
                        )}
                      >
                        {Icon && <Icon className="size-3.5" aria-hidden />}
                        {d.state === "confirmed" ? (
                          <span className="sr-only">{look.label}</span>
                        ) : (
                          look.label
                        )}
                        {c && c.photos > 0 && (
                          <ImageIcon className="size-3 opacity-70" role="img" aria-label={`มีรูป ${c.photos} รูป`} />
                        )}
                      </span>
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                  {due === 0 ? "–" : `${done} / ${due}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
