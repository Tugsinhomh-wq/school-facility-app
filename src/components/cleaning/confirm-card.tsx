"use client";

import { AlertCircle, Check, CheckCircle2, ImageIcon, Minus } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  cancelCleaning,
  confirmCleaning,
  type ConfirmResult,
} from "@/app/(dashboard)/cleaning/actions";
import { CancelConfirmation } from "@/components/cleaning/cancel-confirmation";
import { WeekStrip, type WeekDay } from "@/components/cleaning/week-strip";
import { inCheckWindow, windowText, type CheckWindow } from "@/lib/cleaning";
import { ImagePicker } from "@/components/tickets/image-picker";
import { Button } from "@/components/ui/button";
import type { ClassroomRow } from "@/lib/data/cleaning";
import { addDays, formatDayShort } from "@/lib/time";
import { cn } from "@/lib/utils";

const PILL: Record<string, { label: string; icon: typeof Check; className: string }> = {
  confirmed: { label: "ยืนยันแล้ว", icon: Check, className: "bg-emerald-50 text-emerald-800" },
  late: { label: "ยืนยันแล้ว", icon: Check, className: "bg-emerald-50 text-emerald-800" },
  pending: { label: "ยังไม่ยืนยัน", icon: AlertCircle, className: "bg-red-50 text-red-700" },
  off: { label: "วันหยุด", icon: Minus, className: "bg-muted text-muted-foreground" },
};

/**
 * One classroom: its zone, today's status and a single navy button. A past day nobody confirmed
 * can be picked in the week strip to confirm it late. Photos are optional.
 */
export function ConfirmCard({
  classroom,
  today,
  todayStatus,
  days,
  earlier,
  window,
}: {
  classroom: ClassroomRow;
  /** Bangkok date, computed on the server. */
  today: string;
  todayStatus: WeekDay;
  days: WeekDay[];
  /** Missed days of last week that are still within the 7-day late window. */
  earlier: WeekDay[];
  /** The check window: outside it nothing can be confirmed (the database refuses too). */
  window: CheckWindow;
}) {
  const [state, action, pending] = useActionState<
    ConfirmResult | null,
    FormData
  >(confirmCleaning, null);
  const [cancelState, cancelAction, cancelPending] = useActionState<
    ConfirmResult | null,
    FormData
  >(cancelCleaning, null);
  // Only the newest result is shown, and a successful cancel takes focus (its button is gone by then).
  const [last, setLast] = useState<"confirm" | "cancel">("confirm");
  const shown = last === "confirm" ? state : cancelState;
  const resultRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (last === "cancel" && cancelState?.ok) resultRef.current?.focus();
  }, [last, cancelState]);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  // A picked day drops out by itself once it is confirmed (the page re-renders with fresh data).
  const late =
    selected &&
    [...earlier, ...days].find((d) => d.ymd === selected)?.state === "missed"
      ? selected
      : null;
  const target = late ?? (todayStatus.state === "pending" ? today : null);
  const hasMissed = earlier.length > 0 || days.some((d) => d.state === "missed");
  const outside = !inCheckWindow(today, window);
  const pill =
    outside && todayStatus.state === "off"
      ? { ...PILL.off, label: "ยังไม่อยู่ในช่วงเช็ก" }
      : (PILL[todayStatus.state] ?? PILL.off);
  const done = todayStatus.confirmation;
  // Yesterday sits in this week's strip whenever it was a school day; only a confirmed one can be undone.
  const yesterday = addDays(today, -1);
  const prevDone = days.find((d) => d.ymd === yesterday)?.confirmation ?? null;

  return (
    <section aria-labelledby={`zone-${classroom.id}`} className="space-y-5">
      <header>
        <p className="text-sm text-muted-foreground">
          {classroom.zone ? "เขตทำความสะอาด" : "ยังไม่กำหนดเขต"}
        </p>
        <h2
          id={`zone-${classroom.id}`}
          className="font-display text-2xl font-medium break-words"
        >
          {classroom.name}
          {classroom.building && (
            <span className="text-base font-normal text-muted-foreground">
              {" "}
              · {classroom.building}
            </span>
          )}
        </h2>
      </header>
      {classroom.zone && (
        <p className="rounded-xl border border-border p-4 font-semibold leading-snug break-words">
          {classroom.zone}
        </p>
      )}
      <div className="flex min-h-11 items-center justify-between gap-3">
        <span>วันนี้</span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
            pill.className,
          )}
        >
          <pill.icon className="size-4" aria-hidden />
          {pill.label}
        </span>
      </div>

      {done && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-emerald-800">
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
      {outside && (
        <p role="status" className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          {windowText(window, today)}
        </p>
      )}
      {todayStatus.state === "off" && !late && !outside && (
        <p className="text-sm text-muted-foreground">
          วันนี้เป็นวันหยุด ไม่ต้องยืนยัน
        </p>
      )}

      {done && (
        <CancelConfirmation
          classroomId={classroom.id}
          day={today}
          dayWord="วันนี้"
          hasPhotos={done.photos > 0}
          action={(fd) => {
            setLast("cancel");
            cancelAction(fd);
          }}
          pending={cancelPending}
        />
      )}
      {prevDone && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            เมื่อวาน ({formatDayShort(yesterday)}) ยืนยันแล้วโดย {prevDone.byName}
          </p>
          <CancelConfirmation
            classroomId={classroom.id}
            day={yesterday}
            dayWord="เมื่อวาน"
            hasPhotos={prevDone.photos > 0}
            action={(fd) => {
              setLast("cancel");
              cancelAction(fd);
            }}
            pending={cancelPending}
          />
        </div>
      )}

      {shown && (
        <p
          ref={resultRef}
          tabIndex={-1}
          role={shown.ok ? "status" : "alert"}
          className={cn(
            "rounded-lg p-3 text-sm outline-none",
            shown.ok
              ? "border border-emerald-500/40 bg-emerald-500/10"
              : "border border-destructive/40 bg-destructive/5 text-destructive",
          )}
        >
          {shown.message}
        </p>
      )}

      {target && (
        // Keyed by day so switching days starts with an empty photo list.
        <form
          key={target}
          action={(fd) => {
            setLast("confirm");
            action(fd);
          }}
          className="space-y-3"
        >
          <input type="hidden" name="classroom_id" value={classroom.id} />
          {/* Only a late confirmation names its day; for today the server uses its own Bangkok date. */}
          {late && <input type="hidden" name="day" value={late} />}
          {late && (
            <p className="text-sm font-medium">
              ยืนยันย้อนหลังของ {formatDayShort(late)}
            </p>
          )}
          <Button
            type="submit"
            disabled={pending || busy}
            className="h-14 w-full text-base font-semibold whitespace-normal"
          >
            {pending
              ? "กำลังบันทึก..."
              : busy
                ? "กำลังอัปโหลดรูป..."
                : late
                  ? "ยืนยันย้อนหลัง"
                  : "ยืนยันว่าทำความสะอาดแล้ว"}
          </Button>
          <ImagePicker
            bucket="cleaning-photos"
            fieldName="photo_paths"
            label="รูปเขต (ไม่บังคับ)"
            quiet
            onBusyChange={setBusy}
          />
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
        {earlier.length > 0 && (
          <>
            <p className="text-xs font-medium text-muted-foreground">
              สัปดาห์ที่แล้ว
            </p>
            <WeekStrip
              days={earlier}
              selected={late}
              onSelect={setSelected}
              label="วันของสัปดาห์ที่แล้วที่ยังยืนยันย้อนหลังได้"
            />
            <p className="text-xs font-medium text-muted-foreground">
              สัปดาห์นี้
            </p>
          </>
        )}
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
