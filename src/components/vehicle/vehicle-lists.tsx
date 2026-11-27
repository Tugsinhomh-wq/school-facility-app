"use client";

import { cancelVehicleRequest, decideVehicleRequest } from "@/app/(dashboard)/vehicles/actions";
import { BookingMark } from "@/components/meeting/booking-mark";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MyTrip } from "@/lib/data/vehicles";
import { formatDayShort, formatInstantHm } from "@/lib/time";
import { tripLength, tripSpan, type VehicleBooking, type VehicleInfo } from "@/lib/vehicle";
import { cn } from "@/lib/utils";

const focusRing = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/** "จ. 5 ต.ค. 07:00 – พ. 7 ต.ค. 16:00 น." for a stored trip. */
export function whenText(b: { start_time: string; end_time: string }) {
  const { startYmd, endYmd } = tripSpan(b);
  return startYmd === endYmd
    ? `${formatDayShort(startYmd)} ${formatInstantHm(b.start_time)} – ${formatInstantHm(b.end_time)} น.`
    : `${formatDayShort(startYmd)} ${formatInstantHm(b.start_time)} – ${formatDayShort(endYmd)} ${formatInstantHm(b.end_time)} น.`;
}

/** Requests waiting for a decision. For the director and the administrator. */
export function VehicleQueue({ pending, vehicles, onOpen }: { pending: VehicleBooking[]; vehicles: VehicleInfo[]; onOpen: (id: string) => void }) {
  const action = cn("inline-flex min-h-11 items-center border-b-2 border-foreground pb-0.5 text-sm font-semibold transition-colors hover:border-primary", focusRing);
  return (
    <section aria-labelledby="vq-h" className="rounded-2xl bg-secondary p-4 shadow-xs sm:p-6">
      <h2 id="vq-h" className="mb-3 font-display text-xl leading-snug font-medium">
        คำขอใช้รถรออนุมัติ
      </h2>
      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">ไม่มีคำขอที่รออนุมัติ</p>
      ) : (
        <ul className="divide-y divide-input/70">
          {pending.map((b) => (
            <li key={b.id} className="py-3 first:pt-0 last:pb-0">
              <button type="button" onClick={() => onOpen(b.id)} className={cn("block w-full rounded text-left", focusRing)}>
                <span className="block font-medium leading-snug">
                  {vehicles.find((v) => v.id === b.vehicle_id)?.name} · {b.destination}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {whenText(b)} · {b.passenger_count} คน{b.applicant_name && ` · ผู้ขอ ${b.applicant_name}`}
                </span>
              </button>
              <div className="mt-1 flex gap-5">
                {(["approved", "rejected"] as const).map((d) => (
                  <form key={d} action={decideVehicleRequest}>
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="decision" value={d} />
                    <button type="submit" className={action}>
                      {d === "approved" ? "อนุมัติ" : "ไม่อนุมัติ"}
                    </button>
                  </form>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const STATUS_TEXT: Record<string, string> = { pending: "รออนุมัติ", approved: "จองแล้ว", rejected: "ยกเลิก/ไม่อนุมัติ", revision_requested: "ขอแก้ไข" };

/** The signed-in user's coming trips, with a way to withdraw one that has not started. */
export function MyTrips({ trips, vehicles, now }: { trips: MyTrip[]; vehicles: VehicleInfo[]; now: number | null }) {
  if (trips.length === 0) return null;
  return (
    <section aria-labelledby="mt-h" className="space-y-3">
      <h2 id="mt-h" className="font-display text-lg font-semibold">
        การจองของฉัน
      </h2>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card px-4">
        {trips.map((t) => {
          const live = t.status === "pending" || t.status === "approved";
          const canCancel = live && now !== null && Date.parse(t.start_time) > now;
          return (
            <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {vehicles.find((v) => v.id === t.vehicle_id)?.name} · {t.destination}
                </p>
                <p className="text-sm text-muted-foreground tabular-nums">{whenText(t)}</p>
              </div>
              {t.status === "pending" || t.status === "approved" ? <BookingMark kind={t.status === "pending" ? "pending" : "booked"} /> : <span className="text-sm text-muted-foreground">{STATUS_TEXT[t.status]}</span>}
              {canCancel && (
                <form action={cancelVehicleRequest}>
                  <input type="hidden" name="id" value={t.id} />
                  <button type="submit" className={cn("inline-flex min-h-11 items-center px-2 text-sm text-destructive underline underline-offset-4", focusRing)}>
                    ยกเลิกการจอง
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** One trip in a dialog. The phone number is shown to the applicant and the approvers only. */
export function VehicleDetailDialog({
  booking,
  vehicle,
  mine,
  isApprover,
  onClose,
}: {
  booking: VehicleBooking | null;
  vehicle: VehicleInfo | undefined;
  mine: boolean;
  isApprover: boolean;
  onClose: () => void;
}) {
  const pending = booking?.status === "pending";
  return (
    <Dialog open={Boolean(booking)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        {booking && (
          <>
            <DialogHeader>
              <DialogTitle>{booking.destination}</DialogTitle>
              <DialogDescription>{vehicle?.name}</DialogDescription>
            </DialogHeader>
            <dl className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <dt className="text-muted-foreground">สถานะ</dt>
                <dd className="flex flex-wrap gap-2">
                  <BookingMark kind={pending ? "pending" : "booked"} />
                  {mine && <BookingMark kind="mine" />}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">เวลา</dt>
                <dd className="tabular-nums">
                  {whenText(booking)} ({tripLength(tripSpan(booking).startYmd, tripSpan(booking).endYmd)})
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">เรื่องที่ไป</dt>
                <dd>{booking.purpose}</dd>
              </div>
              {booking.applicant_name && (
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">ผู้ขอ</dt>
                  <dd>{booking.applicant_name}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="text-muted-foreground">ผู้โดยสาร</dt>
                <dd>{booking.passenger_count} คน</dd>
              </div>
              {booking.driver_name && (
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">ผู้ขับ</dt>
                  <dd>{booking.driver_name}</dd>
                </div>
              )}
              {(mine || isApprover) && booking.contact_phone && (
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">เบอร์ติดต่อ</dt>
                  <dd className="tabular-nums">{booking.contact_phone}</dd>
                </div>
              )}
            </dl>
            {isApprover && (
              <div className="space-y-3">
                {pending && (
                  <form action={decideVehicleRequest} onSubmit={onClose}>
                    <input type="hidden" name="id" value={booking.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <Button type="submit" className="h-11 w-full">
                      อนุมัติ
                    </Button>
                  </form>
                )}
                <form action={decideVehicleRequest} onSubmit={onClose} className={pending ? "border-t border-border pt-3" : ""}>
                  <input type="hidden" name="id" value={booking.id} />
                  <input type="hidden" name="decision" value="rejected" />
                  <Button type="submit" variant="destructive" className="h-11 w-full">
                    {pending ? "ไม่อนุมัติ" : "ยกเลิกการจองนี้"}
                  </Button>
                </form>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
