import { RoomDesk } from "@/components/meeting/room-desk";
import { RoomWeekSheet } from "@/components/meeting/room-week-sheet";
import { LoadError } from "@/components/ui/state-card";
import { getMeetingWeek } from "@/lib/data/rooms";
import { isRoomManager, guardExecutive } from "@/lib/data/session";
import { bangkokYmd, isYmd, mondayOf } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ขอใช้ห้องประชุม | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

/**
 * Two views of one page. The administrator gets the week sheet (the whole week of a room on one printed sheet, the
 * approval queue beside it). Everyone else, approvers included, gets the day desk: one day of one room as a lane,
 * the booking form beside it and, for approvers, the queue. Executives never get here (guardExecutive).
 */
export default async function MeetingRoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; room?: string; error?: string }>;
}) {
  await guardExecutive();
  const sp = await searchParams;
  const weekStart = mondayOf(isYmd(sp.week) ? sp.week : bangkokYmd(new Date()));
  const data = await getMeetingWeek(weekStart);
  const roomId = data.rooms.find((r) => r.id === sp.room)?.id ?? data.rooms[0]?.id ?? "";
  const role = data.viewer?.role;
  const isManager = isRoomManager(role);

  if (data.failed)
    return (
      <>
        <h1 className="mb-6 font-display text-3xl font-medium tracking-tight">ขอใช้ห้องประชุม</h1>
        <LoadError what="ตารางห้องประชุม" retryHref="/meeting-rooms" />
      </>
    );
  if (data.rooms.length === 0)
    return (
      <>
        <h1 className="mb-6 font-display text-3xl font-medium tracking-tight">ขอใช้ห้องประชุม</h1>
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          ยังไม่มีห้องที่เปิดให้ขอใช้ ให้เจ้าหน้าที่ตั้งค่าห้องที่ “เปิดให้จอง” ในฐานข้อมูลก่อน
        </p>
      </>
    );

  const common = {
    rooms: data.rooms,
    bookings: data.bookings,
    weekStart,
    roomId,
    userId: data.userId,
    live: data.source === "supabase",
    sample: data.source === "mock",
    error: sp.error,
  };
  // Keyed by room and week so that moving to another one starts from clean local state.
  return role === "super_admin" ? (
    <RoomWeekSheet key={`${roomId}-${weekStart}`} {...common} />
  ) : (
    <RoomDesk key={`${roomId}-${weekStart}`} {...common} isManager={isManager} canManage={isManager} />
  );
}
