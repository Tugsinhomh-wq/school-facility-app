import { PageShell } from "@/components/layout/page-shell";
import { RoomCalendar } from "@/components/meeting/room-calendar";
import { getMeetingWeek } from "@/lib/data/rooms";
import { isStaffRole } from "@/lib/data/session";
import { bangkokYmd, isYmd, mondayOf } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "ขอใช้ห้องประชุม | ระบบแจ้งซ่อม โรงเรียนละหานทรายรัชดาภิเษก" };

export default async function MeetingRoomsPage({ searchParams }: { searchParams: Promise<{ week?: string; room?: string; error?: string }> }) {
  const sp = await searchParams;
  const weekStart = mondayOf(isYmd(sp.week) ? sp.week : bangkokYmd(new Date()));
  const data = await getMeetingWeek(weekStart);
  const roomId = data.rooms.find((r) => r.id === sp.room)?.id ?? data.rooms[0]?.id ?? "";

  return (
    <PageShell viewer={data.viewer}>
      <h1 className="font-display text-3xl font-bold tracking-tight">ขอใช้ห้องประชุม</h1>
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
        isStaff={isStaffRole(data.viewer?.role)}
        live={data.source === "supabase"}
      />
    </PageShell>
  );
}
