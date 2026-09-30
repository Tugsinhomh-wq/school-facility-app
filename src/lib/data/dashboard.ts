import { MOCK_TICKETS } from "@/lib/mock-data";
import type { RepairTicket, TicketStatus } from "@/types/database";

export interface DashboardData {
  source: "supabase" | "mock";
  stats: Record<Extract<TicketStatus, "pending" | "in_progress" | "completed">, number> & {
    estimatedCost: number;
  };
  recent: RepairTicket[];
  documents: RepairTicket[];
  byBuilding: { building: string; count: number }[];
}

export function summarize(tickets: RepairTicket[], source: DashboardData["source"]): DashboardData {
  const count = (s: TicketStatus) => tickets.filter((t) => t.status === s).length;
  const open = tickets.filter((t) => t.status !== "cancelled");

  const byBuilding = Object.entries(
    open.reduce<Record<string, number>>((acc, t) => {
      acc[t.location_building] = (acc[t.location_building] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([building, n]) => ({ building, count: n }))
    .sort((a, b) => b.count - a.count);

  const byNewest = [...tickets].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return {
    source,
    stats: {
      pending: count("pending"),
      in_progress: count("in_progress"),
      completed: count("completed"),
      estimatedCost: open.reduce((sum, t) => sum + Number(t.estimated_cost ?? 0), 0),
    },
    recent: byNewest.slice(0, 5),
    documents: byNewest.filter((t) => t.document_ref_no).slice(0, 4),
    byBuilding,
  };
}

/**
 * Loads tickets from Supabase when configured and signed in (RLS needs a user);
 * otherwise — or on any error — falls back to mock data so the UI always renders.
 */
export async function getDashboardData(): Promise<DashboardData> {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const { data, error } = await supabase
          .from("repair_tickets")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500);
        if (!error && data) return summarize(data as RepairTicket[], "supabase");
      }
    } catch {
      // fall through to mock data
    }
  }
  return summarize(MOCK_TICKETS, "mock");
}
