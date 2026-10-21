"use client";

import { ChevronRight, Plus } from "lucide-react";

import { BookingMark } from "@/components/meeting/booking-mark";
import type { Booking } from "@/lib/data/rooms";
import { DAY_END, DAY_START, segmentOn, STEP } from "@/lib/meeting";
import { formatHm } from "@/lib/time";

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

/** Phone view of one room on one day: quiet rows, free gaps and bookings open on tap. */
export function DayQueue({ items, userId, onBook, onOpen }: Props) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
        วันนี้เลยเวลาจองแล้ว ลองเลือกวันอื่น
      </p>
    );
  }
  const row =
    "flex min-h-16 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50";
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {items.map((it) =>
        it.kind === "free" ? (
          <li key={`f${it.start}`}>
            <button type="button" onClick={() => onBook(it.start)} className={row}>
              <span className="min-w-0 flex-1 leading-snug">
                <span className="block text-base font-semibold tabular-nums">
                  {formatHm(it.start)}-{formatHm(it.end)} น.
                </span>
                <BookingMark kind="free" className="mt-1 bg-transparent px-0" />
              </span>
              <span className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-primary px-4 text-sm font-medium text-primary">
                <Plus className="size-4" aria-hidden />
                จอง
              </span>
            </button>
          </li>
        ) : (
          <li key={it.booking.id}>
            <button type="button" onClick={() => onOpen(it.booking.id)} className={row}>
              <span className="min-w-0 flex-1 leading-snug">
                <span className="block text-base font-semibold tabular-nums">
                  {formatHm(it.start)}-{formatHm(it.end)} น.
                </span>
                <span className="block">{it.booking.purpose}</span>
                {it.booking.applicant_name && (
                  <span className="block text-sm text-muted-foreground">
                    {it.booking.applicant_name}
                  </span>
                )}
                <span className="mt-1.5 flex flex-wrap gap-2">
                  <BookingMark
                    kind={it.booking.status === "pending" ? "pending" : "booked"}
                  />
                  {userId !== null && it.booking.applicant_id === userId && (
                    <BookingMark kind="mine" />
                  )}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </li>
        ),
      )}
    </ul>
  );
}
