import type { RepairTicketWithLocation, TicketStatus, UrgencyLevel } from "@/types/database";

export type TicketRow = RepairTicketWithLocation & {
  reporter: { full_name: string } | null;
  /** Count of reports merged into this ticket (staff queries only). */
  dups?: { count: number }[] | null;
};

export interface TicketFilters {
  /**
   * "open" = pending + in progress, listed most urgent first, then oldest first (the staff work queue).
   * "mine" = the same queue, only the tickets assigned to the signed-in staff member.
   */
  status?: TicketStatus | "open" | "mine";
  urgency?: UrgencyLevel;
  building?: string;
  q?: string;
  page: number;
}
