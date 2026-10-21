import { ActionList, buildRows } from "@/components/dashboard/home-actions";
import { LoadError } from "@/components/ui/state-card";
import { getTodayCounts } from "@/lib/data/cleaning-officer";
import { getMyToday } from "@/lib/data/cleaning-teacher";
import { getDashboardBase, getRepairsData, getRoomsData } from "@/lib/data/dashboard";
import { guardExecutive } from "@/lib/data/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await guardExecutive();
  const [base, repairs, rooms, counts, mine] = await Promise.all([
    getDashboardBase(),
    getRepairsData(),
    getRoomsData(),
    getTodayCounts(),
    getMyToday(),
  ]);
  const { viewer } = base;
  const failed = base.failed || repairs.failed || rooms.failed;
  const rows = failed ? [] : buildRows({ base, repairs, rooms, counts, mine });
  const todo = rows.reduce((sum, r) => sum + r.todo, 0);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">
          {viewer ? `สวัสดี ${viewer.name}` : "สวัสดี"}
        </h1>
        {!failed && (
          <p className="mt-1 text-muted-foreground">
            {!viewer
              ? "ข้อมูลตัวอย่าง เข้าสู่ระบบเพื่อดูงานของคุณ"
              : todo > 0
                ? `วันนี้มีงานค้าง ${todo} รายการ`
                : "วันนี้ไม่มีงานค้าง"}
          </p>
        )}
      </div>
      {failed ? <LoadError what="งานของวันนี้" retryHref="/" /> : <ActionList rows={rows} />}
    </div>
  );
}
