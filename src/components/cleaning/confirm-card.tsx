"use client";

import { Check, CheckCircle2, Clock, ImageIcon, Minus } from "lucide-react";
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
  confirmed: { label: "ยืนยันแล้ว", icon: Check, className: "bg-primary/10 text-primary" },
  late: { label: "ยืนยันแล้ว", icon: Check, className: "bg-primary/10 text-primary" },
  pending: { label: "ยังไม่ยืนยัน", icon: Clock, className: "bg-muted text-foreground" },
  off: { label: "วันหยุด", icon: Minus, className: "bg-muted text-muted-foreground" },
};

/** The zone box sits on a dot field cut to an 8 by 16 cell. */
const DOT_FIELD = {
  backgroundImage:
    "radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--color-primary) 22%, transparent) 1px, transparent 1.5px)",
  backgroundSize: "8px 16px",
} as const;

/**
 * One classroom: its zone, today's status and a single tall key. A past day nobody confirmed can be
 * picked in the week ruler to confirm it late. Every confirmation needs at least one photo of the zone:
 * the key stays off until a photo has uploaded (the server refuses a confirmation without one too).
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
  const [photos, setPhotos] = useState(0);
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
  const needPhoto = photos < 1 && !busy;

  return (
    <section
      aria-labelledby={`zone-${classroom.id}`}
      className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-xs"
    >
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h2
          id={`zone-${classroom.id}`}
          className="font-display flex flex-wrap items-baseline gap-x-2 text-2xl font-semibold break-words"
        >
          {classroom.name}
          {classroom.building && (
            <small className="text-base font-medium text-muted-foreground">
              {classroom.building}
            </small>
          )}
        </h2>
        <span
          className={cn(
            "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium",
            pill.className,
          )}
        >
          <pill.icon className="size-4" aria-hidden />
          <span className="sr-only">วันนี้ </span>
          {pill.label}
        </span>
      </header>

      {classroom.zone ? (
        <div>
          <p className="mb-1 text-sm text-muted-foreground">เขตทำความสะอาด</p>
          <p
            style={DOT_FIELD}
            className="rounded-md border border-border bg-primary/5 p-4 text-lg leading-snug font-semibold break-words"
          >
            {classroom.zone}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">ยังไม่กำหนดเขต</p>
      )}

      {done && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-muted-foreground">
          <CheckCircle2 className="size-4 text-primary" aria-hidden />
          วันนี้ยืนยันแล้วโดย {done.byName}
          {done.photos > 0 && (
            <span className="inline-flex items-center gap-1">
              <ImageIcon className="size-3.5" aria-hidden />
              มีรูป {done.photos} รูป
            </span>
          )}
        </p>
      )}
      {outside && (
        <p role="status" className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          {windowText(window, today)}
        </p>
      )}
      {todayStatus.state === "off" && !late && !outside && (
        <p className="text-sm text-muted-foreground">
          วันนี้เป็นวันหยุด ไม่ต้องยืนยัน
        </p>
      )}

      {shown && (
        <p
          ref={resultRef}
          tabIndex={-1}
          role={shown.ok ? "status" : "alert"}
          className={cn(
            "rounded-md p-3 text-sm outline-none",
            shown.ok
              ? "border border-primary/40 bg-primary/5"
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
          <div className="rounded-md bg-muted/60 p-3">
            <ImagePicker
              bucket="cleaning-photos"
              fieldName="photo_paths"
              label="รูปเขต (ต้องมีอย่างน้อย 1 รูป)"
              maxImages={4}
              camera
              onBusyChange={setBusy}
              onCountChange={setPhotos}
            />
          </div>
          <Button
            type="submit"
            disabled={pending || busy || photos < 1}
            aria-describedby={needPhoto ? `need-photo-${classroom.id}` : undefined}
            className={cn(
              "h-[72px] w-full rounded-lg border border-primary text-lg font-semibold whitespace-normal",
              "shadow-[0_3px_0_0_color-mix(in_oklab,var(--color-primary)_60%,black),0_6px_8px_-4px_color-mix(in_oklab,var(--color-primary)_55%,transparent)]",
              "transition-[transform,box-shadow] hover:-translate-y-px active:translate-y-[3px] active:shadow-none",
              "disabled:translate-y-0 disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 disabled:shadow-none",
            )}
          >
            <Check className="size-7" aria-hidden />
            {pending
              ? "กำลังบันทึก..."
              : busy
                ? "กำลังอัปโหลดรูป..."
                : late
                  ? "ยืนยันย้อนหลัง"
                  : "ยืนยันว่าทำความสะอาดแล้ว"}
          </Button>
          {needPhoto && (
            <p id={`need-photo-${classroom.id}`} className="text-sm text-muted-foreground">
              ถ่ายรูปหรือเลือกรูปเขตอย่างน้อย 1 รูป แล้วจึงกดยืนยันได้
            </p>
          )}
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

      <div className="space-y-2">
        {earlier.length > 0 && (
          <>
            <p className="text-sm font-medium text-muted-foreground">
              สัปดาห์ที่แล้ว
            </p>
            <WeekStrip
              days={earlier}
              selected={late}
              onSelect={setSelected}
              label="วันของสัปดาห์ที่แล้วที่ยังยืนยันย้อนหลังได้"
            />
            <p className="pt-2 text-sm font-medium text-muted-foreground">
              สัปดาห์นี้
            </p>
          </>
        )}
        <WeekStrip days={days} selected={late} onSelect={setSelected} />
        {hasMissed && !late && (
          <p className="text-sm text-muted-foreground">
            แตะวันที่ &quot;ยังไม่ยืนยัน&quot; เพื่อยืนยันย้อนหลัง
          </p>
        )}
      </div>

      {prevDone && (
        <div className="space-y-1 border-t border-border pt-3">
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
    </section>
  );
}
