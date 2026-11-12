import type { TicketStatus } from "../types/database.ts";

/**
 * True when a save would move a ticket to "completed" with nothing to show for it: no technician notes and no
 * after photo (already stored or just attached). Editing a ticket that is already completed is never blocked.
 */
export function missingCloseEvidence(prev: TicketStatus, next: TicketStatus, notes: string, afterPhotoCount: number) {
  return next === "completed" && prev !== "completed" && notes.trim() === "" && afterPhotoCount === 0;
}
