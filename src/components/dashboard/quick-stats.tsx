import { CheckCircle2, Clock, Hourglass, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BentoCard } from "@/components/ui/bento-grid";
import { NumberTicker } from "@/components/ui/number-ticker";
import type { DashboardBase } from "@/lib/data/dashboard";
import { STATUS_LABEL } from "@/lib/ticket-meta";

export function QuickStats({ stats }: { stats: DashboardBase["stats"] }) {
  const items = [
    { label: STATUS_LABEL.pending, value: stats.pending, icon: Clock, tone: "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300" },
    { label: STATUS_LABEL.in_progress, value: stats.in_progress, icon: Hourglass, tone: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300" },
    { label: STATUS_LABEL.completed, value: stats.completed, icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300" },
  ];

  return (
    <BentoCard className="md:col-span-6 lg:col-span-12">
      <h2 className="text-lg font-semibold">สถานะงานซ่อมทั้งหมด</h2>
      <dl className="mt-4 grid flex-1 grid-cols-2 gap-y-6 sm:grid-cols-4 sm:divide-x sm:divide-border">
        {items.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="flex flex-col justify-between gap-3 sm:px-4 sm:first:pl-0">
            <dt>
              <Badge className={`${tone} gap-1.5`}>
                <Icon className="size-3.5" aria-hidden />
                {label}
              </Badge>
            </dt>
            <dd>
              <span className="text-5xl font-semibold leading-none">
                <NumberTicker value={value} />
              </span>
              <span className="ml-1.5 text-sm text-muted-foreground">เรื่อง</span>
            </dd>
          </div>
        ))}
        <div className="col-span-2 flex flex-col justify-between gap-3 sm:col-span-1 sm:pl-4">
          <dt>
            <Badge className="gap-1.5 bg-yellow-100 text-yellow-900 dark:bg-yellow-400/15 dark:text-yellow-300">
              <Wallet className="size-3.5" aria-hidden />
              ค่าซ่อมโดยประมาณ
            </Badge>
          </dt>
          <dd>
            <span className="text-2xl font-semibold leading-none text-primary">
              ฿<NumberTicker value={stats.estimatedCost} />
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">ไม่รวมงานที่ยกเลิก</span>
          </dd>
        </div>
      </dl>
    </BentoCard>
  );
}
