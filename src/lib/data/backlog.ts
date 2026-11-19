import type { SupabaseClient } from "@supabase/supabase-js";

import type { BacklogTicket } from "@/lib/backlog";

/**
 * Every ticket that was sent to the budget deputy, whatever its status. The inner join keeps only shared tickets even
 * for the administrator, who can read them all. Trashed tickets never come back (a restrictive policy hides them).
 * Null when the query fails.
 * shortcut: capped at 500 rows, far above how many tickets get sent for an opinion, so there is no paging.
 */
export async function getBacklog(supabase: SupabaseClient): Promise<BacklogTicket[] | null> {
  const { data, error } = await supabase
    .from("repair_tickets")
    .select("id, ticket_number, title, urgency, status, created_at, duplicate_of, location_detail, building:buildings(name), room:rooms(room_number, name), repair_ticket_shares!inner(ticket_id)")
    .limit(500);
  if (error) {
    console.error("backlog failed", { code: error.code });
    return null;
  }
  return data as unknown as BacklogTicket[];
}
