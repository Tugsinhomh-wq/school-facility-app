"use client";

import { AnimatedList } from "@/components/ui/animated-list";
import { Badge } from "@/components/ui/badge";
import { BentoCard } from "@/components/ui/bento-grid";
import { timeAgoTh, URGENCY_CLASS, URGENCY_LABEL } from "@/lib/ticket-meta";
import type { RepairTicket, UrgencyLevel } from "@/types/database";

const BAR: Record<UrgencyLevel, string> = {
  low: "border-l-slate-400",
  medium: "border-l-sky-500",
  high: "border-l-amber-500",
  emergency: "border-l-red-500",
};

function TicketRow({ ticket }: { ticket: RepairTicket }) {
  const place = [ticket.location_building, ticket.location_room].filter(Boolean).join(", ");
  return (
    <div className={`w-full rounded-lg border border-l-4 border-border bg-background/70 py-2.5 pl-3 pr-3 ${BAR[ticket.urgency]}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{ticket.title}</p>
        <Badge className={`${URGENCY_CLASS[ticket.urgency]} shrink-0`}>{URGENCY_LABEL[ticket.urgency]}</Badge>
      </div>
      <p className="mt-1 flex justify-between gap-2 text-xs text-muted-foreground">
        <span>{place}</span>
        <time dateTime={ticket.created_at}>{timeAgoTh(ticket.created_at)}</time>
      </p>
    </div>
  );
}

export function RecentTicketsFeed({ tickets }: { tickets: RepairTicket[] }) {
  return (
    <BentoCard className="md:col-span-3 lg:col-span-5 lg:row-span-2">
      <h2 className="text-lg font-semibold">แจ้งซ่อมล่าสุด</h2>
      <p className="text-sm text-muted-foreground">เรียงจากใหม่ไปเก่า แสดง 5 รายการ</p>
      <div className="relative mt-4 min-h-0 flex-1 overflow-hidden">
        <AnimatedList delay={1000}>
          {[...tickets].reverse().map((t) => (
            <TicketRow key={t.id} ticket={t} />
          ))}
        </AnimatedList>
      </div>
    </BentoCard>
  );
}
