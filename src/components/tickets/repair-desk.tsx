import { Check } from "lucide-react";
import Link from "next/link";

import { placeOf } from "@/components/tickets/ticket-table";
import { UrgencyMark } from "@/components/tickets/status-mark";
import { EmptyState } from "@/components/ui/state-card";
import { STATUS_LABEL, formatDateTh } from "@/lib/ticket-meta";
import { cn } from "@/lib/utils";
import type { TicketStatus } from "@/types/database";
import type { TicketRow } from "@/types/tickets";

/** The three stops of a job that gets done, and how far each status has come. A cancelled job has no lane. */
const STOPS = ["รับเรื่อง", "ดำเนินการ", "เสร็จสิ้น"] as const;
const REACHED: Partial<Record<TicketStatus, number>> = { pending: 0, in_progress: 1, completed: 2 };

/** Received, in progress, done: the current stop is ringed, the ones behind it carry a tick. */
function Lane({ status }: { status: TicketStatus }) {
  const at = REACHED[status];
  if (at === undefined)
    return (
      <p className="mt-3 inline-flex rounded-full border border-input px-3 py-1 text-sm font-medium text-muted-foreground">
        {STATUS_LABEL[status]}
      </p>
    );
  return (
    <ol className="mt-3 grid grid-cols-3 gap-1.5" aria-label={`ความคืบหน้า: ${STATUS_LABEL[status]}`}>
      {STOPS.map((label, i) => (
        <li
          key={label}
          aria-current={i === at ? "step" : undefined}
          className={cn(
            "flex min-h-9 items-center justify-center gap-1 rounded-full border px-2 text-center text-xs leading-tight font-medium",
            i === at ? "border-foreground bg-sidebar-accent text-foreground" : i < at ? "border-input text-foreground" : "border-input text-muted-foreground",
          )}
        >
          {(i < at || (i === at && status === "completed")) && <Check className="size-3.5 shrink-0" aria-hidden />}
          {label}
        </li>
      ))}
    </ol>
  );
}

/** A regular user's own jobs, each with where it stands. */
export function RepairDeskList({ tickets, hasFilters }: { tickets: TicketRow[]; hasFilters: boolean }) {
  if (tickets.length === 0)
    return (
      <EmptyState
        title={hasFilters ? "ไม่พบรายการที่ตรงกับตัวกรอง" : "ยังไม่มีรายการแจ้งซ่อม"}
        hint={hasFilters ? "ลองล้างตัวกรองหรือค้นหาด้วยคำอื่น" : "ใช้ฟอร์มแจ้งซ่อมเพื่อแจ้งเรื่องแรกของคุณ"}
        className="bg-card"
      />
    );
  return (
    <ul className="grid gap-2">
      {tickets.map((t) => (
        <li key={t.id} className="rounded-2xl bg-card p-4">
          <h3 className="font-display text-lg leading-snug font-medium">
            <Link
              href={`/tickets/${t.id}`}
              className="rounded outline-none hover:underline hover:decoration-primary hover:underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t.title}
            </Link>
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {placeOf(t)}, {t.ticket_number}, แจ้งเมื่อ <time dateTime={t.created_at}>{formatDateTh(t.created_at)}</time>
          </p>
          {(t.urgency === "high" || t.urgency === "emergency") && (
            <p className="mt-1.5 text-sm">
              <UrgencyMark urgency={t.urgency} />
            </p>
          )}
          <Lane status={t.status} />
        </li>
      ))}
    </ul>
  );
}
