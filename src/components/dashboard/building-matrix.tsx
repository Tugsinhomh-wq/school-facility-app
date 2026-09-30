import { Building2 } from "lucide-react";

import { BentoCard } from "@/components/ui/bento-grid";
import type { DashboardData } from "@/lib/data/dashboard";

export function BuildingMatrix({ byBuilding }: { byBuilding: DashboardData["byBuilding"] }) {
  const max = Math.max(1, ...byBuilding.map((b) => b.count));
  const total = byBuilding.reduce((s, b) => s + b.count, 0);

  return (
    <BentoCard className="md:col-span-3 lg:col-span-4">
      <div className="flex items-center gap-2">
        <Building2 className="size-5 text-muted-foreground" aria-hidden />
        <h2 className="text-lg font-semibold">งานซ่อมแยกตามอาคาร</h2>
      </div>
      <p className="text-sm text-muted-foreground">อาคารที่มีเรื่องแจ้งมากที่สุดอยู่บนสุด</p>
      <ul className="mt-4 space-y-3">
        {byBuilding.map(({ building, count }) => (
          <li key={building}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{building}</span>
              <span className="tabular-nums text-muted-foreground">
                {count} รายการ · {Math.round((count / total) * 100)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-[#2b3bb8] to-[#f2b04a]" style={{ width: `${(count / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </BentoCard>
  );
}
