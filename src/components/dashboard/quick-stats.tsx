import { CheckCircle2, Clock, Hourglass, Wallet } from "lucide-react";

import { NumberTicker } from "@/components/ui/number-ticker";
import { BentoCard } from "@/components/ui/bento-grid";
import { Badge } from "@/components/ui/badge";
import type { DashboardData } from "@/lib/data/dashboard";
import { STATUS_LABEL } from "@/lib/ticket-meta";

export function QuickStats({ stats }: { stats: DashboardData["stats"] }) {
  const items = [
    { label: STATUS_LABEL.pending, value: stats.pending, icon: Clock, tone: "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300" },
    { label: STATUS_LABEL.in_progress, value: stats.in_progress, icon: Hourglass, tone: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300" },
    { label: STATUS_LABEL.completed, value: stats.completed, icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" },
  ];

  return (
    <BentoCard className="md:col-span-6 lg:col-span-7">
      <h2 className="text-lg font-semibold">สรุปสถานะภาพรวม</h2>
      <p className="text-sm text-muted-foreground">ข้อมูลงานแจ้งซ่อมทั้งหมดในระบบ</p>
      <div className="mt-4 grid flex-1 grid-cols-2 gap-3">
        {items.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="flex flex-col justify-between rounded-xl border border-border/60 bg-muted/40 p-4">
            <Badge className={`${tone} gap-1.5 self-start`}>
              <Icon className="size-3.5" aria-hidden />
              {label}
            </Badge>
            <p className="mt-3 text-4xl font-bold tabular-nums">
              <NumberTicker value={value} />
            </p>
            <p className="text-xs text-muted-foreground">รายการ</p>
          </div>
        ))}
        <div className="flex flex-col justify-between rounded-xl border border-border/60 bg-muted/40 p-4">
          <Badge className="gap-1.5 self-start bg-yellow-100 text-yellow-800 dark:bg-yellow-400/15 dark:text-yellow-300">
            <Wallet className="size-3.5" aria-hidden />
            ค่าใช้จ่ายประมาณการรวม
          </Badge>
          <p className="mt-3 text-3xl font-bold tabular-nums text-amber-700 dark:text-gold">
            ฿<NumberTicker value={stats.estimatedCost} className="text-amber-700 dark:text-gold" />
          </p>
          <p className="text-xs text-muted-foreground">ไม่รวมรายการที่ยกเลิก</p>
        </div>
      </div>
    </BentoCard>
  );
}
