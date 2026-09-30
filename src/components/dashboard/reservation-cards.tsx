import { CalendarClock, CalendarDays } from "lucide-react";
import Link from "next/link";

import { BentoCard } from "@/components/ui/bento-grid";
import { Button } from "@/components/ui/button";
import { meetingLine, type PendingReservation, type TodayMeeting } from "@/lib/data/rooms";
import { formatInstantHm } from "@/lib/time";

/** Room requests waiting for a decision (staff). */
export function PendingReservations({ items, className }: { items: PendingReservation[]; className?: string }) {
  return (
    <BentoCard className={className}>
      <div className="flex items-center gap-2">
        <CalendarClock className="size-5 text-muted-foreground" aria-hidden />
        <h2 className="text-lg font-semibold">คำขอห้องประชุมรออนุมัติ</h2>
      </div>
      <p className="text-sm text-muted-foreground">เรียงตามวันที่จะใช้ห้อง</p>
      <ul className="mt-4 flex-1 space-y-2">
        {items.length === 0 && <li className="text-sm text-muted-foreground">ไม่มีคำขอค้างอนุมัติ</li>}
        {items.map((r) => (
          <li key={r.id} className="rounded-lg border border-border bg-background/60 p-3">
            <p className="truncate text-sm font-medium">{r.purpose}</p>
            <p className="truncate text-xs text-muted-foreground">
              {r.room_name} · {formatInstantHm(r.start_time)}-{formatInstantHm(r.end_time)} น.
              {r.applicant_name && ` · ${r.applicant_name}`}
            </p>
          </li>
        ))}
      </ul>
      <Button variant="outline" className="mt-4 self-start" nativeButton={false} render={<Link href="/meeting-rooms" />}>
        ไปที่ปฏิทินเพื่ออนุมัติ
      </Button>
    </BentoCard>
  );
}

/** Today's approved meetings as a list (the ticker shows the same data in motion). */
export function TodayMeetings({ meetings, className }: { meetings: TodayMeeting[]; className?: string }) {
  return (
    <BentoCard className={className}>
      <div className="flex items-center gap-2">
        <CalendarDays className="size-5 text-muted-foreground" aria-hidden />
        <h2 className="text-lg font-semibold">ประชุมวันนี้</h2>
      </div>
      <ul className="mt-4 flex-1 space-y-2">
        {meetings.length === 0 && <li className="text-sm text-muted-foreground">วันนี้ยังไม่มีการประชุมที่ได้รับอนุมัติ</li>}
        {meetings.map((m) => (
          <li key={m.id} className="rounded-lg border border-border bg-background/60 p-3 text-sm">
            {meetingLine(m)}
          </li>
        ))}
      </ul>
    </BentoCard>
  );
}
