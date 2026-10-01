import Link from "next/link";

import { RoomCalendar } from "@/components/meeting/room-calendar";
import { getMeetingWeek } from "@/lib/data/rooms";
import { isRoomManager } from "@/lib/data/session";
import { bangkokYmd, isYmd, mondayOf } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "ขอใช้ห้องประชุม | ระบบแจ้งซ่อม โรงเรียนละหานทรายรัชดาภิเษก" };

export default async function MeetingRoomsPage({ searchParams }: { searchParams: Promise<{ week?: string; room?: string; error?: string }> }) {
  const sp = await searchParams;
  const weekStart = mondayOf(isYmd(sp.week) ? sp.week : bangkokYmd(new Date()));
  const data = await getMeetingWeek(weekStart);
  const roomId = data.rooms.find((r) => r.id === sp.room)?.id ?? data.rooms[0]?.id ?? "";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">ขอใช้ห้องประชุม</h1>
        {isRoomManager(data.viewer?.role) && (
          <Link href="/meeting-rooms/manage" className="text-sm text-primary underline-offset-4 hover:underline">
            จัดการห้อง
          </Link>
        )}
      </div>
      <p className="mt-1 mb-6 text-muted-foreground">
        ดูตารางว่างและจองห้อง ระบบกันเวลาชนกันให้{data.source === "mock" && " (ข้อมูลตัวอย่าง)"}
      </p>
      {sp.error && <p role="alert" className="mb-4 text-sm text-destructive">{sp.error}</p>}
      <RoomCalendar
        rooms={data.rooms}
        bookings={data.bookings}
        weekStart={weekStart}
        roomId={roomId}
        userId={data.userId}
        isStaff={isRoomManager(data.viewer?.role)}
        live={data.source === "supabase"}
      />
    </>
  );
}
