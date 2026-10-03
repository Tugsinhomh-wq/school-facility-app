"use client";

import Link from "next/link";

import { AnimatedList } from "@/components/ui/animated-list";
import { Badge } from "@/components/ui/badge";
import { BentoCard } from "@/components/ui/bento-grid";
import { EmptyState } from "@/components/ui/state-card";
import { timeAgoTh, URGENCY_CLASS, URGENCY_LABEL } from "@/lib/ticket-meta";
import type { TicketBrief } from "@/lib/data/dashboard";
import type { UrgencyLevel } from "@/types/database";

const BAR: Record<UrgencyLevel, string> = {
  low: "border-l-slate-400",
  medium: "border-l-sky-500",
  high: "border-l-amber-500",
  emergency: "border-l-red-500",
};

function TicketRow({ ticket }: { ticket: TicketBrief }) {
  const place = [
    ticket.building?.name,
    ticket.room?.name ?? ticket.location_detail,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <div
      className={`w-full rounded-lg border border-l-4 border-border bg-background/70 py-2.5 pl-3 pr-3 ${BAR[ticket.urgency]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{ticket.title}</p>
        <Badge className={`${URGENCY_CLASS[ticket.urgency]} shrink-0`}>
          {URGENCY_LABEL[ticket.urgency]}
        </Badge>
      </div>
      <p className="mt-1 flex justify-between gap-2 text-xs text-muted-foreground">
        <span>{place}</span>
        <time dateTime={ticket.created_at}>{timeAgoTh(ticket.created_at)}</time>
      </p>
    </div>
  );
}

export function RecentTicketsFeed({
  tickets,
  title = "แจ้งซ่อมล่าสุด",
  hint = "เรียงจากใหม่ไปเก่า แสดง 5 รายการ",
  className = "md:col-span-3 lg:col-span-5 lg:row-span-2",
  reverse = true,
  emptyTitle = "ยังไม่มีรายการ",
  emptyHint,
  emptyGood = false,
}: {
  tickets: TicketBrief[];
  title?: string;
  hint?: string;
  className?: string;
  /** The animated list stacks new items on top, so oldest-first input reads newest-first. */
  reverse?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  /** The empty list is good news (nothing waiting), not a gap to fill. */
  emptyGood?: boolean;
}) {
  return (
    <BentoCard className={className}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Link
          href="/tickets"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          ดูทั้งหมด
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">{hint}</p>
      {tickets.length === 0 && (
        <EmptyState
          className="mt-4"
          title={emptyTitle}
          hint={emptyHint}
          tone={emptyGood ? "good" : "neutral"}
        />
      )}
      <div className="relative mt-4 min-h-0 flex-1 overflow-hidden">
        <AnimatedList delay={300}>
          {(reverse ? [...tickets].reverse() : tickets).map((t) => (
            <TicketRow key={t.id} ticket={t} />
          ))}
        </AnimatedList>
      </div>
    </BentoCard>
  );
}
