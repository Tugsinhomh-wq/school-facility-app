import { Building2 } from "lucide-react";

import { BentoCard } from "@/components/ui/bento-grid";
import { GridPattern } from "@/components/ui/grid-pattern";
import type { DashboardData } from "@/lib/data/dashboard";

export function BuildingMatrix({ byBuilding }: { byBuilding: DashboardData["byBuilding"] }) {
  const max = Math.max(1, ...byBuilding.map((b) => b.count));
  const total = byBuilding.reduce((s, b) => s + b.count, 0);

  return (
    <BentoCard className="md:col-span-6 lg:col-span-6">
      <GridPattern width={28} height={28} className="opacity-60 [mask-image:radial-gradient(320px_circle_at_top_right,white,transparent)]" />
      <div className="relative flex items-center gap-2">
        <Building2 className="size-5 text-muted-foreground" aria-hidden />
        <h2 className="text-lg font-semibold">ข้อมูลอาคารและสิ่งแวดล้อม</h2>
      </div>
      <p className="relative text-sm text-muted-foreground">สัดส่วนงานซ่อมแยกตามอาคาร จุดที่มีปัญหาบ่อยอยู่บนสุด</p>
      <ul className="relative mt-4 space-y-3">
        {byBuilding.map(({ building, count }) => (
          <li key={building}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{building}</span>
              <span className="tabular-nums text-muted-foreground">
                {count} รายการ · {Math.round((count / total) * 100)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-500" style={{ width: `${(count / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </BentoCard>
  );
}
