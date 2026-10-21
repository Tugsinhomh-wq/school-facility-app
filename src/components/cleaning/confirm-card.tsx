"use client";

import { CheckCircle2, ImageIcon } from "lucide-react";
import { useActionState, useState } from "react";

import {
  confirmCleaning,
  type ConfirmResult,
} from "@/app/(dashboard)/cleaning/actions";
import { WeekStrip, type WeekDay } from "@/components/cleaning/week-strip";
import { ImagePicker } from "@/components/tickets/image-picker";
import { Button } from "@/components/ui/button";
import type { ClassroomRow } from "@/lib/data/cleaning";
import { formatDayShort } from "@/lib/time";
import { cn } from "@/lib/utils";

const PILL: Record<string, { label: string; className: string }> = {
  confirmed: {
    label: "ยืนยันแล้ว",
    className:
      "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950",
  },
  late: {
    label: "ยืนยันแล้ว",
    className:
      "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950",
  },
  pending: {
    label: "ยังไม่ยืนยัน",
    className:
      "bg-amber-100 text-amber-900 ring-1 ring-amber-500/60 dark:bg-amber-500/20 dark:text-amber-200",
  },
  off: { label: "วันหยุด", className: "bg-muted text-muted-foreground" },
};

/**
 * One classroom: its zone, today's status and a single gold button. A past day nobody confirmed
 * can be picked in the week strip to confirm it late. Photos are optional.
 */
export function ConfirmCard({
  classroom,
  today,
  todayStatus,
  days,
}: {
  classroom: ClassroomRow;
  /** Bangkok date, computed on the server. */
  today: string;
  todayStatus: WeekDay;
  days: WeekDay[];
}) {
  const [state, action, pending] = useActionState<
    ConfirmResult | null,
    FormData
  >(confirmCleaning, null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  // A picked day drops out by itself once it is confirmed (the page re-renders with fresh data).
  const late =
    selected && days.find((d) => d.ymd === selected)?.state === "missed"
      ? selected
      : null;
  const target = late ?? (todayStatus.state === "pending" ? today : null);
  const hasMissed = days.some((d) => d.state === "missed");
  const pill = PILL[todayStatus.state] ?? PILL.off;
  const done = todayStatus.confirmation;

  return (
    <section
      aria-labelledby={`zone-${classroom.id}`}
      className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            ห้อง {classroom.name}
            {classroom.building && ` · ${classroom.building}`}
          </p>
          <h2
            id={`zone-${classroom.id}`}
            className="text-lg leading-snug font-semibold break-words"
          >
            {classroom.zone}
          </h2>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-3 py-1 text-sm font-semibold",
            pill.className,
          )}
        >
          {pill.label}
        </span>
      </header>

      {done && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="size-4" aria-hidden />
          วันนี้ยืนยันแล้วโดย {done.byName}
          {done.photos > 0 && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <ImageIcon className="size-3.5" aria-hidden />
              มีรูป {done.photos} รูป
            </span>
          )}
        </p>
      )}
      {todayStatus.state === "off" && !late && (
        <p className="text-sm text-muted-foreground">
          วันนี้เป็นวันหยุด ไม่ต้องยืนยัน
        </p>
      )}

      {state && (
        <p
          role={state.ok ? "status" : "alert"}
          className={cn(
            "rounded-lg p-3 text-sm",
            state.ok
              ? "border border-emerald-500/40 bg-emerald-500/10"
              : "border border-destructive/40 bg-destructive/5 text-destructive",
          )}
        >
          {state.message}
        </p>
      )}

      {target && (
        // Keyed by day so switching days starts with an empty photo list.
        <form key={target} action={action} className="space-y-3">
          <input type="hidden" name="classroom_id" value={classroom.id} />
          {/* Only a late confirmation names its day; for today the server uses its own Bangkok date. */}
          {late && <input type="hidden" name="day" value={late} />}
          {late && (
            <p className="text-sm font-medium">
              ยืนยันย้อนหลังของ {formatDayShort(late)}
            </p>
          )}
          <ImagePicker
            bucket="cleaning-photos"
            fieldName="photo_paths"
            label="รูปเขต (ไม่บังคับ)"
            onBusyChange={setBusy}
          />
          <Button
            type="submit"
            variant="cta"
            disabled={pending || busy}
            className="h-14 w-full text-base whitespace-normal"
          >
            {pending
              ? "กำลังบันทึก..."
              : busy
                ? "กำลังอัปโหลดรูป..."
                : late
                  ? "ยืนยันย้อนหลัง"
                  : "ยืนยันว่านักเรียนทำความสะอาดแล้ว"}
          </Button>
          {late && (
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full"
              onClick={() => setSelected(null)}
            >
              ยกเลิก
            </Button>
          )}
        </form>
      )}

      <div className="space-y-1.5">
        <WeekStrip days={days} selected={late} onSelect={setSelected} />
        {hasMissed && !late && (
          <p className="text-xs text-muted-foreground">
            แตะวันที่ &quot;ยังไม่ยืนยัน&quot; เพื่อยืนยันย้อนหลัง
          </p>
        )}
      </div>
    </section>
  );
}
