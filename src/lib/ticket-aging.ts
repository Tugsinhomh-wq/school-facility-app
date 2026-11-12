import type { TicketStatus, UrgencyLevel } from "../types/database.ts";

/** How long an open ticket may wait, in hours. Same limits as the "on time" figure in executive_summary(). */
export const DUE_HOURS: Record<UrgencyLevel, number> = { emergency: 24, high: 72, medium: 168, low: 336 };

/** Whole days an open ticket has waited once it is past its limit; null if it is closed or still within it. */
export function overdueDays(
  t: { status: TicketStatus; urgency: UrgencyLevel; created_at: string },
  now = Date.now(),
): number | null {
  if (t.status !== "pending" && t.status !== "in_progress") return null;
  const hours = (now - new Date(t.created_at).getTime()) / 3_600_000;
  return hours > DUE_HOURS[t.urgency] ? Math.floor(hours / 24) : null;
}
