"use client";

import { decideReservation } from "@/app/(dashboard)/meeting-rooms/actions";
import type { Booking, RoomInfo } from "@/lib/data/rooms";
import { bangkokYmd, formatDayShort, formatInstantHm } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * Requests waiting for a decision, across every room of the loaded week. Approve and refuse post the same
 * action as the booking detail dialog, so the list and the dialog always agree. For approvers only.
 */
export function PendingQueue({
  bookings,
  rooms,
  onOpen,
  tone,
}: {
  bookings: Booking[];
  rooms: RoomInfo[];
  onOpen: (id: string) => void;
  /** "well" is the rounded card of the day desk; "sheet" is the ruled, square well of the admin week sheet. */
  tone: "well" | "sheet";
}) {
  const list = bookings
    .filter((b) => b.status === "pending")
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const sheet = tone === "sheet";
  const action = cn(
    "inline-flex min-h-11 items-center border-b-2 pb-0.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
    sheet ? "border-sheet-ink hover:border-sheet-accent" : "border-foreground hover:border-primary",
  );
  return (
    <section
      aria-labelledby="pending-h"
      className={cn(
        sheet
          ? "border-2 border-sheet-ink bg-sheet-paper-2 p-4 shadow-[8px_8px_0_var(--color-sheet-paper-3)] sm:p-6"
          : "rounded-2xl bg-secondary p-4 shadow-xs sm:p-6",
      )}
    >
      <h2
        id="pending-h"
        className={cn(
          "mb-3 text-xl leading-snug",
          sheet ? "border-b border-sheet-gold pb-2 font-sheet font-bold text-sheet-ink" : "font-display font-medium",
        )}
      >
        คำขอรออนุมัติ
      </h2>
      {list.length === 0 ? (
        <p className={cn("text-sm", sheet ? "text-sheet-muted" : "text-muted-foreground")}>ไม่มีคำขอที่รออนุมัติในสัปดาห์นี้</p>
      ) : (
        <ul className={cn("divide-y", sheet ? "divide-sheet-rule" : "divide-input/70")}>
          {list.map((b) => {
            const room = rooms.find((r) => r.id === b.room_id);
            return (
              <li key={b.id} className="py-3 first:pt-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => onOpen(b.id)}
                  className="block w-full rounded text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="block font-medium leading-snug">{b.purpose}</span>
                  <span className={cn("block text-sm", sheet ? "text-sheet-muted" : "text-muted-foreground")}>
                    {room?.name}, {formatDayShort(bangkokYmd(new Date(b.start_time)))} {formatInstantHm(b.start_time)} ถึง{" "}
                    {formatInstantHm(b.end_time)} น.{b.applicant_name && ` ผู้ขอ ${b.applicant_name}`}
                  </span>
                </button>
                <div className="mt-1 flex gap-5">
                  <form action={decideReservation}>
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <button type="submit" className={action}>
                      อนุมัติ
                    </button>
                  </form>
                  <form action={decideReservation}>
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <button type="submit" className={action}>
                      ไม่อนุมัติ
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
