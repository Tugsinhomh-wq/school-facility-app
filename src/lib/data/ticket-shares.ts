import type { SupabaseClient } from "@supabase/supabase-js";

/** When a ticket was sent to the budget deputy, and by whom. */
export interface TicketShare {
  shared_at: string;
  shared_by_name: string | null;
}

/** The share of one ticket, or null when it was not sent (or the query fails). */
export async function getTicketShare(supabase: SupabaseClient, ticketId: string): Promise<TicketShare | null> {
  const { data, error } = await supabase
    .from("repair_ticket_shares")
    .select("shared_at, shared_by_name")
    .eq("ticket_id", ticketId)
    .maybeSingle();
  if (error) {
    console.error("ticket share failed", { code: error.code });
    return null;
  }
  return data as TicketShare | null;
}

/** Ids of every ticket sent to the deputy, for the marker in the staff list. Empty when the query fails. */
export async function getSharedTicketIds(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase.from("repair_ticket_shares").select("ticket_id");
  if (error) {
    console.error("shared tickets failed", { code: error.code });
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.ticket_id as string));
}
