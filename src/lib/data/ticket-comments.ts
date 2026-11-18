import type { SupabaseClient } from "@supabase/supabase-js";

/** One line of the thread on a ticket. */
export interface TicketComment {
  id: string;
  author_name: string | null;
  body: string;
  created_at: string;
}

/** The thread of one ticket, oldest first. Empty when the caller may not read it or the query fails. */
export async function getTicketComments(supabase: SupabaseClient, ticketId: string): Promise<TicketComment[]> {
  const { data, error } = await supabase
    .from("repair_ticket_comments")
    .select("id, author_name, body, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at");
  if (error) {
    console.error("ticket comments failed", { code: error.code });
    return [];
  }
  return (data ?? []) as TicketComment[];
}

/** Tickets with a comment from someone else that the caller has not read yet. Empty when the query fails. */
export async function getUnreadTicketIds(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("unread_comment_tickets");
  if (error) {
    console.error("unread comments failed", { code: error.code });
    return new Set();
  }
  return new Set((data ?? []) as string[]);
}
