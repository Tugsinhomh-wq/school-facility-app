/** A combined repair memo covers between COMBINE_MIN and COMBINE_MAX tickets of one building. */
export const COMBINE_MIN = 2;
export const COMBINE_MAX = 20;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The ticket ids of a submitted combine form (formData.getAll("ticket_ids")): unique, in the order
 * first seen, or null when any value is not a UUID string or the unique count is out of range.
 */
export function parseTicketIds(values: unknown[]): string[] | null {
  const seen = new Set<string>();
  for (const v of values) {
    if (typeof v !== "string" || !UUID.test(v)) return null;
    seen.add(v);
  }
  return seen.size >= COMBINE_MIN && seen.size <= COMBINE_MAX ? [...seen] : null;
}

/** Until a ticket is picked any ticket can be; after that only tickets of the same building. */
export const selectableTicket = (selectedBuildingId: string | null, ticketBuildingId: string) =>
  selectedBuildingId === null || selectedBuildingId === ticketBuildingId;

/** The picked ids that are still in the list (it can refresh under the picker), in the order picked. */
export const liveSelection = (picked: string[], candidateIds: string[]) =>
  picked.filter((id) => candidateIds.includes(id));
