"use client";

import { CircleCheck, Clock, Lock, Plus } from "lucide-react";

import type { Booking } from "@/lib/data/rooms";
import { DAY_END, DAY_START, segmentOn, STEP } from "@/lib/meeting";
import { formatHm } from "@/lib/time";
import { cn } from "@/lib/utils";

type Item =
  | { kind: "booking"; booking: Booking; start: number; end: number }
  | { kind: "free"; start: number; end: number };

/** One day as an ordered list: bookings and the free gaps between them. `earliest` hides gaps already past. */
export function buildDay(
  bookings: Booking[],
  ymd: string,
  earliest: number,
): Item[] {
  const segs = bookings
    .map((b) => ({ b, seg: segmentOn(b, ymd) }))
    .filter(
      (x): x is { b: Booking; seg: { start: number; end: number } } =>
        x.seg !== null,
    )
    .map(({ b, seg }) => ({
      booking: b,
      start: Math.max(seg.start, DAY_START),
      end: Math.min(seg.end, DAY_END),
    }))
    .filter((x) => x.end > x.start)
    .sort((a, b) => a.start - b.start);

  const items: Item[] = [];
  let cursor = DAY_START;
  const pushFree = (from: number, to: number) => {
    const start = Math.max(from, earliest);
    if (to - start >= STEP) items.push({ kind: "free", start, end: to });
  };
  for (const s of segs) {
    if (s.start > cursor) pushFree(cursor, s.start);
    items.push({ kind: "booking", ...s });
    cursor = Math.max(cursor, s.end);
  }
  if (cursor < DAY_END) pushFree(cursor, DAY_END);
  return items;
}

interface Props {
  items: Item[];
  userId: string | null;
  onBook: (start: number) => void;
  onOpen: (id: string) => void;
}

/** Phone view of one room on one day: big cards, free gaps are tappable. */
export function DayQueue({ items, userId, onBook, onOpen }: Props) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center text-muted-foreground">
        วันนี้เลยเวลาจองแล้ว ลองเลือกวันอื่น
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((it) =>
        it.kind === "free" ? (
          <li key={`f${it.start}`}>
            <button
              type="button"
              onClick={() => onBook(it.start)}
              className="flex min-h-16 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-emerald-600/60 bg-emerald-500/10 px-4 py-3 text-left active:bg-emerald-500/20"
            >
              <span>
                <span className="block text-base font-semibold tabular-nums">
                  {formatHm(it.start)}-{formatHm(it.end)} น.
                </span>
                <span className="flex items-center gap-1 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  <CircleCheck className="size-4" aria-hidden />
                  ว่าง จองได้
                </span>
              </span>
              <span className="flex h-11 items-center gap-1 rounded-full bg-cta px-5 text-sm font-semibold text-cta-foreground">
                <Plus className="size-4" aria-hidden />
                จอง
              </span>
            </button>
          </li>
        ) : (
          <li key={it.booking.id}>
            <button
              type="button"
              onClick={() => onOpen(it.booking.id)}
              className={cn(
                "flex min-h-16 w-full flex-col items-start justify-center gap-0.5 rounded-xl border px-4 py-3 text-left",
                it.booking.status === "pending"
                  ? "border-dashed border-amber-500 bg-amber-500/10"
                  : "border-border bg-card",
                userId !== null &&
                  it.booking.applicant_id === userId &&
                  "ring-2 ring-primary",
              )}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-base font-semibold tabular-nums">
                  {formatHm(it.start)}-{formatHm(it.end)} น.
                </span>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    it.booking.status === "pending"
                      ? "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {it.booking.status === "pending" ? (
                    <Clock className="size-3" aria-hidden />
                  ) : (
                    <Lock className="size-3" aria-hidden />
                  )}
                  {it.booking.status === "pending" ? "รออนุมัติ" : "จองแล้ว"}
                </span>
              </span>
              <span className="text-sm">{it.booking.purpose}</span>
              <span className="text-xs text-muted-foreground">
                {userId !== null && it.booking.applicant_id === userId ? (
                  <b className="font-semibold text-primary">ของฉัน</b>
                ) : (
                  it.booking.applicant_name
                )}
              </span>
            </button>
          </li>
        ),
      )}
    </ul>
  );
}
