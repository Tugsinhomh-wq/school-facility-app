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
  /** Said on the free-time button: what is booked and when ("ภูมินทร์ วันนี้"). */
  bookLabel: string;
  /** Approval rule of the room, said once under the list. */
  note: string;
}

/** Phone view of one room on one day: quiet rows, free gaps and bookings open on tap. */
export function DayQueue({ items, userId, onBook, onOpen, bookLabel, note }: Props) {
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
    <div className="space-y-3">
      <ul className="space-y-3">
        {items.map((it) =>
          it.kind === "free" ? (
            <li key={`f${it.start}`} className="space-y-2.5 rounded-2xl border-2 border-primary bg-primary/5 p-4">
              <BookingMark kind="free" className="bg-transparent px-0" />
              <p className="text-2xl font-semibold tabular-nums">
                {formatHm(it.start)}-{formatHm(it.end)} น.
              </p>
              <button
                type="button"
                onClick={() => onBook(it.start)}
                className="flex min-h-13 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 active:scale-[0.99]"
              >
                <Plus className="size-5" aria-hidden />
                จอง{bookLabel} เริ่ม {formatHm(it.start)}
              </button>
            </li>
          ) : (
            <li key={it.booking.id} className="overflow-hidden rounded-xl border border-border">
              <button type="button" onClick={() => onOpen(it.booking.id)} className={row}>
                <span className="min-w-0 flex-1 leading-snug">
                  <span className="block text-base font-semibold tabular-nums">
                    {formatHm(it.start)}-{formatHm(it.end)} น.
                  </span>
                  <span className="block">{it.booking.purpose}</span>
                  {it.booking.applicant_name && (
                    <span className="block text-sm text-muted-foreground">{it.booking.applicant_name}</span>
                  )}
                  <span className="mt-1.5 flex flex-wrap gap-2">
                    <BookingMark kind={it.booking.status === "pending" ? "pending" : "booked"} />
                    {userId !== null && it.booking.applicant_id === userId && <BookingMark kind="mine" />}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ),
        )}
      </ul>
      <p className="text-sm text-muted-foreground">{note}</p>
    </div>
  );
}
