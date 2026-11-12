import type { TicketStatus, UrgencyLevel } from "../types/database.ts";

/** The levels staff can set, lowest first. The teachers' report form offers only the middle three. */
export const URGENCY_CHOICES: readonly UrgencyLevel[] = ["low", "medium", "high", "emergency"];

export function parseUrgency(value: unknown): UrgencyLevel | null {
  return URGENCY_CHOICES.find((u) => u === value) ?? null;
}

/** Closed tickets (completed or cancelled) keep their level, so the summary figures for past periods do not move. */
export const canChangeUrgency = (status: TicketStatus) => status === "pending" || status === "in_progress";
