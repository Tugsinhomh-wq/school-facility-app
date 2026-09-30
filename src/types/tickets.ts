import type { RepairTicketWithLocation, TicketStatus, UrgencyLevel } from "@/types/database";

export type TicketRow = RepairTicketWithLocation & { reporter: { full_name: string } | null };

export interface TicketFilters {
  status?: TicketStatus;
  urgency?: UrgencyLevel;
  building?: string;
  q?: string;
  page: number;
}
