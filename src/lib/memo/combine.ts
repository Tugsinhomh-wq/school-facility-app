/** A combined repair memo covers between COMBINE_MIN and COMBINE_MAX tickets, from any buildings. */
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

/** Picked tickets can be put in a group 1..GROUP_MAX; tickets in one group become a single item of the memo. */
export const GROUP_MAX = 9;

/** The form field that carries a ticket's group. */
export const groupFieldName = (ticketId: string) => `group_${ticketId}`;

/**
 * The group of each listed ticket, by ticket id. Only whole numbers 1..GROUP_MAX count; anything else
 * (empty, garbage, out of range) leaves the ticket as an item of its own. `read` gets a field name.
 */
export function parseGroups(ids: string[], read: (name: string) => unknown): Record<string, number> {
  const groups: Record<string, number> = {};
  for (const id of ids) {
    const v = read(groupFieldName(id));
    if (typeof v !== "string" || !/^[1-9]$/.test(v)) continue;
    groups[id] = Number(v);
  }
  return groups;
}

/** The picked ids that are still in the list (it can refresh under the picker), in the order picked. */
export const liveSelection = (picked: string[], candidateIds: string[]) =>
  picked.filter((id) => candidateIds.includes(id));
