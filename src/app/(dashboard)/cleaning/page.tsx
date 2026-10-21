import { ConfirmCard } from "@/components/cleaning/confirm-card";
import { EmptyState, LoadError } from "@/components/ui/state-card";
import { dayState, weekGrid } from "@/lib/cleaning";
import { getMyClassrooms, getWeek } from "@/lib/data/cleaning";
import { getSession, guardExecutive } from "@/lib/data/session";
import { bangkokYmd, formatDayLong, mondayOf } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "เขตทำความสะอาด | ระบบแจ้งซ่อม โรงเรียนละหานทรายรัชดาภิเษก",
};

export default async function CleaningPage() {
  await guardExecutive();
  // School time: the Bangkok day, decided on the server (00:30 Bangkok is already the new day).
  const today = bangkokYmd(new Date());
  const session = await getSession();

  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">
        เขตทำความสะอาด
      </h1>
      <p className="mt-1 mb-6 text-muted-foreground">
        {formatDayLong(today)}
        {!session && " (ข้อมูลตัวอย่าง)"}
      </p>
      <TeacherView today={today} />
    </>
  );
}

/** The homeroom teacher's view: one card per classroom they advise. */
async function TeacherView({ today }: { today: string }) {
  const mine = await getMyClassrooms();
  if (mine.failed)
    return <LoadError what="ห้องที่ปรึกษา" retryHref="/cleaning" />;
  if (mine.rows.length === 0)
    return (
      <EmptyState
        title="ยังไม่ได้ระบุห้องที่ปรึกษา"
        hint="ติดต่อเจ้าหน้าที่งานอาคารสถานที่"
      />
    );

  const monday = mondayOf(today);
  const week = await getWeek(
    mine.rows.map((r) => r.id),
    monday,
  );
  if (week.failed)
    return <LoadError what="สถานะการยืนยัน" retryHref="/cleaning" />;

  return (
    <div className="grid max-w-xl gap-4">
      {mine.rows.map((room) => {
        const confirmations = week.confirmations.get(room.id) ?? new Map();
        const days = weekGrid({
          monday,
          today,
          offDays: week.offDays,
          confirmations,
        });
        const confirmation = confirmations.get(today) ?? null;
        const todayStatus = {
          ymd: today,
          state: dayState({ ymd: today, today, offDays: week.offDays, confirmation }),
          confirmation,
        };
        return (
          <ConfirmCard
            key={room.id}
            classroom={room}
            today={today}
            todayStatus={todayStatus}
            days={days}
          />
        );
      })}
    </div>
  );
}
