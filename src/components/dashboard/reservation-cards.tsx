import { CalendarCheck, CalendarClock, CalendarDays } from "lucide-react";
import Link from "next/link";

import { decideReservation } from "@/app/(dashboard)/meeting-rooms/actions";
import { BentoCard } from "@/components/ui/bento-grid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { meetingLine, type MyReservation, type PendingReservation, type TodayMeeting } from "@/lib/data/rooms";
import { bangkokYmd, formatDayShort, formatInstantHm } from "@/lib/time";

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
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["approved", "rejected"] as const).map((decision) => (
                <form key={decision} action={decideReservation}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="decision" value={decision} />
                  <Button type="submit" size="sm" variant={decision === "approved" ? "default" : "outline"} className="h-10 w-full">
                    {decision === "approved" ? "อนุมัติ" : "ไม่อนุมัติ"}
                  </Button>
                </form>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <Button variant="outline" className="mt-4 self-start" nativeButton={false} render={<Link href="/meeting-rooms" />}>
        เปิดปฏิทิน
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

const STATUS = {
  pending: { label: "รออนุมัติ", cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300" },
  approved: { label: "อนุมัติแล้ว", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300" },
  rejected: { label: "ไม่อนุมัติ", cls: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" },
  revision_requested: { label: "ขอแก้ไข", cls: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300" },
} as const;

/** The teacher's own room requests, with the decision shown plainly. */
export function MyReservations({ items, className }: { items: MyReservation[]; className?: string }) {
  return (
    <BentoCard className={className}>
      <div className="flex items-center gap-2">
        <CalendarCheck className="size-5 text-muted-foreground" aria-hidden />
        <h2 className="text-lg font-semibold">การจองห้องของฉัน</h2>
      </div>
      <ul className="mt-4 flex-1 space-y-2">
        {items.length === 0 && <li className="text-sm text-muted-foreground">ยังไม่มีการจอง กดแท็บห้องประชุมเพื่อจอง</li>}
        {items.map((r) => {
          const st = STATUS[r.status];
          return (
            <li key={r.id} className="flex items-start justify-between gap-2 rounded-lg border border-border bg-background/60 p-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{r.purpose}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {r.room_name} · {formatDayShort(bangkokYmd(new Date(r.start_time)))} {formatInstantHm(r.start_time)}-{formatInstantHm(r.end_time)} น.
                </span>
              </span>
              <Badge className={`${st.cls} shrink-0`}>{st.label}</Badge>
            </li>
          );
        })}
      </ul>
      <Button variant="outline" className="mt-4 self-start" nativeButton={false} render={<Link href="/meeting-rooms" />}>
        จองห้องเพิ่ม
      </Button>
    </BentoCard>
  );
}
