import type { RepairTicketWithLocation, TicketStatus, UrgencyLevel } from "@/types/database";

export type TicketRow = RepairTicketWithLocation & {
  reporter: { full_name: string } | null;
  /** Count of reports merged into this ticket (staff queries only). */
  dups?: { count: number }[] | null;
};

export interface TicketFilters {
  status?: TicketStatus;
  urgency?: UrgencyLevel;
  building?: string;
  q?: string;
  page: number;
}
