import { AlertCircle, TriangleAlert } from "lucide-react";

import { TICKET_TONE, TONE } from "@/components/dashboard/home-actions";
import { STATUS_LABEL, URGENCY_LABEL } from "@/lib/ticket-meta";
import { cn } from "@/lib/utils";
import type { TicketStatus, UrgencyLevel } from "@/types/database";

/** Status as icon + word + colour on a light wash, the same tones as the home rows. */
export function StatusPill({ status, className }: { status: TicketStatus; className?: string }) {
  const tone = TONE[TICKET_TONE[status]];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium whitespace-nowrap",
        tone.className,
        className,
      )}
    >
      <tone.icon className="size-4" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** High and emergency get a restrained icon + coloured word; the rest is plain grey text. */
export function UrgencyMark({ urgency }: { urgency: UrgencyLevel }) {
  const Icon = urgency === "emergency" ? AlertCircle : urgency === "high" ? TriangleAlert : null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap",
        urgency === "emergency" && "font-medium text-red-700",
        urgency === "high" && "font-medium text-amber-800",
      )}
    >
      {Icon && <Icon className="size-4" aria-hidden />}
      {URGENCY_LABEL[urgency]}
    </span>
  );
}
