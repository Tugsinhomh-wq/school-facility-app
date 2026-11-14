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
    className: "text-primary [&_[data-state]]:font-medium",
  },
  late: {
    label: "ย้อนหลัง",
    icon: Check,
    className: "text-primary [&_[data-state]]:font-medium",
  },
  pending: {
    label: "วันนี้",
    icon: Clock,
    className:
      "bg-primary/5 shadow-[inset_0_-2px_0_0_var(--color-primary)] [&_[data-state]]:font-medium",
  },
  missed: {
    label: "ยังไม่ยืนยัน",
    icon: X,
    className:
      "[&_[data-state]]:font-medium [&_[data-state]]:underline [&_[data-state]]:decoration-border [&_[data-state]]:underline-offset-4",
  },
  off: {
    label: "หยุด",
    icon: Minus,
    className: "text-muted-foreground",
  },
  future: {
    label: "",
    icon: Minus,
    className: "text-muted-foreground/60",
  },
};

/**
 * Mon-Fri of one week drawn as a ruler: five notched ticks on one rule. A past day nobody confirmed
 * is a button when `onSelect` is given, so the teacher can confirm it late; everything else is read-only.
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
    <ol
      className="grid grid-cols-5 border-t-2 border-foreground"
      aria-label={label}
    >
      {days.map((d, i) => {
        const look = LOOK[d.state];
        const Icon = look.icon;
        const [dow, date] = formatDayShort(d.ymd).split(" ");
        const by = d.confirmation ? ` โดย ${d.confirmation.byName}` : "";
        const body = (
          <>
            <span className="text-xs leading-none text-muted-foreground">{dow}</span>
            <span className="font-display text-xl leading-none font-semibold tabular-nums">
              {date}
            </span>
            <span
              data-state
              className="inline-flex items-center gap-0.5 text-xs leading-tight"
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              {look.label}
            </span>
            {by && <span className="sr-only">{by}</span>}
          </>
        );
        const cell = cn(
          // the tick above each day
          "relative flex min-h-[4.75rem] w-full flex-col items-start gap-0.5 px-1.5 pt-3 pb-2 text-left",
          "before:absolute before:top-0 before:left-0 before:h-3 before:w-px before:bg-foreground",
          i > 0 && "border-l border-border",
          look.className,
        );
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
                  "cursor-pointer outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px",
                  selected === d.ymd && "bg-primary/5 ring-2 ring-primary ring-inset",
                )}
              >
                {body}
              </button>
            ) : (
              <div title={title} className={cell}>
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
