import Link from "next/link";

import type { Booking, RoomInfo } from "@/lib/data/rooms";
import { DAY_END, DAY_START, segmentOn } from "@/lib/meeting";
import { formatDayShort } from "@/lib/time";
import { cn } from "@/lib/utils";

const SPAN = DAY_END - DAY_START;

function freeHours(bookings: Booking[], ymd: string) {
  const used = bookings
    .map((b) => segmentOn(b, ymd))
    .filter((s): s is { start: number; end: number } => s !== null)
    .sort((a, b) => a.start - b.start);
  let busy = 0;
  let cursor = DAY_START;
  for (const s of used) {
    const from = Math.max(s.start, cursor, DAY_START);
    const to = Math.min(s.end, DAY_END);
    if (to > from) busy += to - from;
    cursor = Math.max(cursor, s.end);
  }
  return Math.max(0, SPAN - busy) / 60;
}

/** Every room against every day of the week: where the free time is, at a glance. Desktop only. */
export function RoomOverview({ rooms, bookings, days, today, activeRoomId, href }: { rooms: RoomInfo[]; bookings: Booking[]; days: string[]; today: string | null; activeRoomId: string; href: (roomId: string) => string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card/85 backdrop-blur-sm">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <caption className="sr-only">ความว่างของทุกห้องในสัปดาห์นี้</caption>
        <thead>
          <tr className="border-b border-border text-center">
            <th scope="col" className="w-56 px-3 py-2 text-left font-medium text-muted-foreground">ห้อง</th>
            {days.map((ymd) => (
              <th key={ymd} scope="col" className={cn("px-2 py-2 font-medium", ymd === today && "text-primary")}>
                {formatDayShort(ymd)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => {
            const own = bookings.filter((b) => b.room_id === room.id);
            return (
              <tr key={room.id} className={cn("border-b border-border last:border-0", room.id === activeRoomId && "bg-primary/5")}>
                <th scope="row" className="px-3 py-2 text-left font-medium">
                  <Link href={href(room.id)} className="hover:underline">{room.name}</Link>
                  <span className="block text-xs font-normal text-muted-foreground">{room.capacity ? `${room.capacity} ที่นั่ง` : room.building_name !== room.name ? room.building_name : room.requires_approval ? "ต้องขออนุมัติ" : "จองได้ทันที"}</span>
                </th>
                {days.map((ymd) => {
                  const free = freeHours(own, ymd);
                  return (
                    <td key={ymd} className="px-2 py-2">
                      <Link href={href(room.id)} className="block" aria-label={`${room.name} ${formatDayShort(ymd)} ว่าง ${Math.round(free * 10) / 10} ชั่วโมง`}>
                        <span className="relative block h-3 overflow-hidden rounded-full bg-emerald-500/25">
                          {own.map((b) => {
                            const seg = segmentOn(b, ymd);
                            if (!seg) return null;
                            const s = Math.max(seg.start, DAY_START);
                            const e = Math.min(seg.end, DAY_END);
                            if (e <= s) return null;
                            return (
                              <span
                                key={b.id}
                                className={cn("absolute inset-y-0", b.status === "pending" ? "bg-amber-500" : "bg-primary")}
                                style={{ left: `${((s - DAY_START) / SPAN) * 100}%`, width: `${((e - s) / SPAN) * 100}%` }}
                              />
                            );
                          })}
                        </span>
                        <span className="mt-1 block text-center text-xs tabular-nums text-muted-foreground">
                          {free === 0 ? "เต็ม" : `ว่าง ${Math.round(free * 10) / 10} ชม.`}
                        </span>
                      </Link>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
