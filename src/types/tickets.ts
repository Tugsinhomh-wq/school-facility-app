import type { RepairTicketWithLocation, TicketStatus, UrgencyLevel } from "@/types/database";

export type TicketRow = RepairTicketWithLocation & {
  reporter: { full_name: string } | null;
  /** Count of reports merged into this ticket (staff queries only). */
  dups?: { count: number }[] | null;
};

export interface TicketFilters {
  /** "open" = pending + in progress, listed most urgent first, then oldest first (the staff work queue). */
  status?: TicketStatus | "open";
  urgency?: UrgencyLevel;
  building?: string;
  q?: string;
  page: number;
}
