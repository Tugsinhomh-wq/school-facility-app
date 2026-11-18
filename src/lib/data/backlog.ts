import type { SupabaseClient } from "@supabase/supabase-js";

import type { BacklogTicket } from "@/lib/backlog";

/**
 * Every repair still open (waiting or in progress), merged duplicates left out. Trashed tickets never come back
 * (a restrictive policy hides them). Null when the query fails.
 * shortcut: capped at 500 rows, far above this school's open backlog, so there is no paging.
 */
export async function getBacklog(supabase: SupabaseClient): Promise<BacklogTicket[] | null> {
  const { data, error } = await supabase
    .from("repair_tickets")
    .select("id, ticket_number, title, urgency, status, created_at, location_detail, building:buildings(name), room:rooms(room_number, name)")
    .in("status", ["pending", "in_progress"])
    .is("duplicate_of", null)
    .limit(500);
  if (error) {
    console.error("backlog failed", { code: error.code });
    return null;
  }
  return data as unknown as BacklogTicket[];
}
