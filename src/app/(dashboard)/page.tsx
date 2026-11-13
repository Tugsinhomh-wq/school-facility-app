import { buildRows } from "@/components/dashboard/home-actions";
import { CleaningDesk, MineCard } from "@/components/dashboard/teacher-desk";
import { LoadError } from "@/components/ui/state-card";
import { followUpCounts } from "@/lib/control/follow-up";
import { getTodayCounts } from "@/lib/data/cleaning-officer";
import { getMyToday } from "@/lib/data/cleaning-teacher";
import { listFollowUp } from "@/lib/data/control";
import { getDashboardBase, getRepairsData, getRoomsData } from "@/lib/data/dashboard";
import { guardExecutive, isStaffRole } from "@/lib/data/session";
import { bangkokYmd, formatDayLong } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await guardExecutive();
  const [base, repairs, rooms, counts, mine, followUp] = await Promise.all([
    getDashboardBase(),
    getRepairsData(),
    getRoomsData(),
    getTodayCounts(),
    getMyToday(),
    listFollowUp(),
  ]);
  const { viewer } = base;
  const today = bangkokYmd(new Date());
  const failed = base.failed || repairs.failed || rooms.failed;
  const rows = failed ? [] : buildRows({ base, repairs, rooms, counts, mine, followUp: followUp.failed ? null : followUpCounts(followUp.items) });
  const todo = rows.reduce((sum, r) => sum + r.todo, 0);
  // An advisor gets their own desk (the one-tap confirmation and the week); the same job is then left out of the list.
  const advised = !failed && !mine.failed && mine.rows.length > 0 ? mine : null;
  const listRows = advised ? rows.filter((r) => r.key !== "mine-cleaning") : rows;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">
          {formatDayLong(today)}
          {viewer && ` สวัสดี ${viewer.name}`}
        </p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">
          {!viewer ? "สวัสดี" : failed ? "งานของวันนี้" : todo > 0 ? `วันนี้ยังเหลือ ${todo} อย่าง` : "วันนี้เรียบร้อยแล้ว"}
        </h1>
        {!viewer && !failed && <p className="mt-1 text-muted-foreground">ข้อมูลตัวอย่าง เข้าสู่ระบบเพื่อดูงานของคุณ</p>}
      </header>

      {failed ? (
        <LoadError what="งานของวันนี้" retryHref="/" />
      ) : (
        <div className={advised ? "grid items-start gap-6 lg:grid-cols-[7fr_5fr]" : "max-w-3xl"}>
          {advised && (
            <div className="space-y-6">
              {advised.rows.map((room) => (
                <CleaningDesk key={room.id} room={room} today={today} outside={advised.outside === true} />
              ))}
            </div>
          )}
          <MineCard
            rows={listRows}
            title={viewer && isStaffRole(viewer.role) ? "งานค้างของวันนี้" : "งานของฉัน"}
            sample={!viewer}
          />
        </div>
      )}
    </div>
  );
}
