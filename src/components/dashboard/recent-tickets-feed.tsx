"use client";

import { MapPin } from "lucide-react";

import { AnimatedList } from "@/components/ui/animated-list";
import { Badge } from "@/components/ui/badge";
import { BentoCard } from "@/components/ui/bento-grid";
import { timeAgoTh, URGENCY_CLASS, URGENCY_LABEL } from "@/lib/ticket-meta";
import type { RepairTicket } from "@/types/database";

function TicketRow({ ticket }: { ticket: RepairTicket }) {
  const place = [ticket.location_building, ticket.location_room].filter(Boolean).join(" · ");
  return (
    <div className="w-full rounded-xl border border-border/60 bg-background p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{ticket.title}</p>
        <Badge className={`${URGENCY_CLASS[ticket.urgency]} shrink-0`}>{URGENCY_LABEL[ticket.urgency]}</Badge>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <MapPin className="size-3" aria-hidden />
          {place}
        </span>
        <time dateTime={ticket.created_at}>{timeAgoTh(ticket.created_at)}</time>
      </div>
    </div>
  );
}

export function RecentTicketsFeed({ tickets }: { tickets: RepairTicket[] }) {
  return (
    <BentoCard className="md:col-span-3 lg:col-span-5 lg:row-span-2">
      <div className="flex items-center gap-2">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
        </span>
        <h2 className="text-lg font-semibold">แจ้งซ่อมล่าสุด</h2>
      </div>
      <p className="text-sm text-muted-foreground">5 รายการล่าสุด อัปเดตต่อเนื่อง</p>
      <div className="relative mt-4 min-h-0 flex-1 overflow-hidden">
        <AnimatedList delay={1200}>
          {[...tickets].reverse().map((t) => (
            <TicketRow key={t.id} ticket={t} />
          ))}
        </AnimatedList>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card" />
      </div>
    </BentoCard>
  );
}
