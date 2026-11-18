import type { SupabaseClient } from "@supabase/supabase-js";

import type { BacklogTicket } from "@/lib/backlog";

/**
 * Every repair still open (waiting or in progress), merged duplicates left out, plus the tickets with an unread
 * comment whatever their status, so the unread count always points at something the page shows. Trashed tickets
 * never come back (a restrictive policy hides them). Null when the query fails.
 * shortcut: capped at 500 rows, far above this school's open backlog, so there is no paging.
 */
export async function getBacklog(supabase: SupabaseClient, unreadIds: ReadonlySet<string>): Promise<BacklogTicket[] | null> {
  const open = "and(status.in.(pending,in_progress),duplicate_of.is.null)";
  const { data, error } = await supabase
    .from("repair_tickets")
    .select("id, ticket_number, title, urgency, status, created_at, duplicate_of, location_detail, building:buildings(name), room:rooms(room_number, name)")
    .or(unreadIds.size > 0 ? `${open},id.in.(${[...unreadIds].join(",")})` : open)
    .limit(500);
  if (error) {
    console.error("backlog failed", { code: error.code });
    return null;
  }
  return data as unknown as BacklogTicket[];
}
