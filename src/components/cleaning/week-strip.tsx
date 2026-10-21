import { Check, Clock, Minus, X } from "lucide-react";

import type { DayState } from "@/lib/cleaning";
import type { WeekConfirmation } from "@/lib/data/cleaning";
import { formatDayShort } from "@/lib/time";
import { cn } from "@/lib/utils";

export type WeekDay = {
  ymd: string;
  state: DayState;
  confirmation: WeekConfirmation | null;
};

const LOOK: Record<
  DayState,
  { label: string; icon: typeof Check; className: string }
> = {
  confirmed: {
    label: "ยืนยันแล้ว",
    icon: Check,
    className:
      "border-emerald-600/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  },
  late: {
    label: "ย้อนหลัง",
    icon: Check,
    className:
      "border-emerald-600/40 border-dashed bg-emerald-500/5 text-emerald-800 dark:text-emerald-300",
  },
  pending: {
    label: "วันนี้",
    icon: Clock,
    className:
      "border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  },
  missed: {
    label: "ยังไม่ยืนยัน",
    icon: X,
    className:
      "border-red-500/50 bg-red-500/10 text-red-800 dark:text-red-300",
  },
  off: {
    label: "หยุด",
    icon: Minus,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
  future: {
    label: "",
    icon: Minus,
    className: "border-dashed border-border text-muted-foreground/60",
  },
};

/**
 * Mon-Fri of one week. A past day nobody confirmed is a button when `onSelect` is given, so the
 * teacher can confirm it late; everything else is read-only.
 */
export function WeekStrip({
  days,
  selected,
  onSelect,
  label = "สถานะรายวันของสัปดาห์นี้",
}: {
  days: WeekDay[];
  selected?: string | null;
  onSelect?: (ymd: string) => void;
  label?: string;
}) {
  return (
    <ol className="grid grid-cols-5 gap-1.5" aria-label={label}>
      {days.map((d) => {
        const look = LOOK[d.state];
        const Icon = look.icon;
        const [dow, date] = formatDayShort(d.ymd).split(" ");
        const by = d.confirmation ? ` โดย ${d.confirmation.byName}` : "";
        const body = (
          <>
            <span className="text-xs font-medium">
              {dow} {date}
            </span>
            <Icon className="size-4" aria-hidden />
            <span className="text-[11px] leading-tight">{look.label}</span>
            {by && <span className="sr-only">{by}</span>}
          </>
        );
        const cell =
          "flex min-h-16 w-full flex-col items-center justify-center gap-0.5 rounded-lg border px-0.5 py-1.5 text-center";
        const title = `${formatDayShort(d.ymd)}: ${look.label || "ยังไม่ถึง"}${by}`;
        return (
          <li key={d.ymd}>
            {d.state === "missed" && onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(d.ymd)}
                aria-pressed={selected === d.ymd}
                aria-label={`${title} แตะเพื่อยืนยันย้อนหลัง`}
                className={cn(
                  cell,
                  look.className,
                  "cursor-pointer active:translate-y-px",
                  selected === d.ymd &&
                    "ring-3 ring-red-500/40 ring-offset-1 ring-offset-card",
                )}
              >
                {body}
              </button>
            ) : (
              <div title={title} className={cn(cell, look.className)}>
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
