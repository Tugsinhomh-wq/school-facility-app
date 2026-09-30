import { DoorOpen } from "lucide-react";
import Link from "next/link";

import { BentoCard } from "@/components/ui/bento-grid";
import { Button } from "@/components/ui/button";
import type { LiveRoom } from "@/lib/data/rooms";
import { formatInstantHm } from "@/lib/time";

export function LiveRoomStatus({ rooms }: { rooms: LiveRoom[] }) {
  return (
    <BentoCard className="md:col-span-6 lg:col-span-4">
      <div className="flex items-center gap-2">
        <DoorOpen className="size-5 text-muted-foreground" aria-hidden />
        <h2 className="text-lg font-semibold">สถานะห้องประชุมสด</h2>
      </div>
      <p className="text-sm text-muted-foreground">ห้องที่เปิดให้ขอใช้ ณ ตอนนี้</p>

      <ul className="mt-4 flex-1 space-y-2">
        {rooms.length === 0 && <li className="text-sm text-muted-foreground">ยังไม่มีห้องที่เปิดให้ขอใช้</li>}
        {rooms.map((r) => {
          const busy = r.current_status === "busy";
          return (
            <li key={r.room_id} className="rounded-lg border border-border bg-background/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{r.room_name}</span>
                  {r.building_name !== r.room_name && <span className="block truncate text-xs text-muted-foreground">{r.building_name}</span>}
                </span>
                <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${busy ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"}`}>
                  <span aria-hidden>{busy ? "🔴" : "🟢"}</span>
                  {busy ? "กำลังใช้งาน" : "ว่าง"}
                </span>
              </div>
              {busy && (
                <p className="mt-1.5 text-sm">
                  {r.active_meeting_title}
                  {r.active_meeting_until && <span className="text-muted-foreground"> ถึง {formatInstantHm(r.active_meeting_until)} น.</span>}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <Button className="mt-4 self-start" nativeButton={false} render={<Link href="/meeting-rooms" />}>
        ดูตารางปฏิทินเต็ม
      </Button>
    </BentoCard>
  );
}
