"use client";

import { createMemoFromReservation, decideReservation } from "@/app/(dashboard)/meeting-rooms/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Booking, RoomInfo } from "@/lib/data/rooms";
import { bangkokYmd, formatDayLong, formatInstantHm } from "@/lib/time";

export function BookingDetailDialog({ booking, room, mine, isStaff, onClose }: { booking: Booking | null; room: RoomInfo | undefined; mine: boolean; isStaff: boolean; onClose: () => void }) {
  const pending = booking?.status === "pending";
  return (
    <Dialog open={Boolean(booking)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        {booking && (
          <>
            <DialogHeader>
              <DialogTitle>{booking.purpose}</DialogTitle>
              <DialogDescription>
                {room?.name} · {formatDayLong(bangkokYmd(new Date(booking.start_time)))}
              </DialogDescription>
            </DialogHeader>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <dt className="text-muted-foreground">สถานะ</dt>
                <dd>
                  <Badge className={pending ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"}>
                    {pending ? "รออนุมัติ" : "จองแล้ว"}
                  </Badge>
                </dd>
              </div>
              <div className="flex gap-2"><dt className="text-muted-foreground">เวลา</dt><dd>{formatInstantHm(booking.start_time)}-{formatInstantHm(booking.end_time)} น.</dd></div>
              {booking.applicant_name && <div className="flex gap-2"><dt className="text-muted-foreground">ผู้ขอ</dt><dd>{booking.applicant_name}</dd></div>}
              {booking.attendee_count && <div className="flex gap-2"><dt className="text-muted-foreground">ผู้เข้าร่วม</dt><dd>{booking.attendee_count} คน</dd></div>}
              {booking.equipment_needed && <div className="flex gap-2"><dt className="text-muted-foreground">อุปกรณ์</dt><dd>{booking.equipment_needed}</dd></div>}
            </dl>

            {pending && (mine || isStaff) && (
              <form action={createMemoFromReservation}>
                <input type="hidden" name="reservation_id" value={booking.id} />
                <Button type="submit" variant="outline" className="w-full">ร่างบันทึกข้อความเสนอ ผอ. (PDF/Word)</Button>
              </form>
            )}
            {pending && isStaff && (
              <div className="grid grid-cols-2 gap-2">
                {(["approved", "rejected"] as const).map((decision) => (
                  <form key={decision} action={decideReservation} onSubmit={onClose}>
                    <input type="hidden" name="id" value={booking.id} />
                    <input type="hidden" name="decision" value={decision} />
                    <Button type="submit" variant={decision === "approved" ? "default" : "destructive"} className="w-full">
                      {decision === "approved" ? "อนุมัติ" : "ไม่อนุมัติ"}
                    </Button>
                  </form>
                ))}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
