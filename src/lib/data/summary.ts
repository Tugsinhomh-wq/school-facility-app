import type { SupabaseClient } from "@supabase/supabase-js";

import type { Period } from "@/lib/summary-period";

/** What the database function executive_summary() returns: counts and place names only. */
export interface SummaryData {
  generated_at: string;
  today: {
    open_pending: number;
    open_in_progress: number;
    open_emergency: number;
    new_today: number;
    done_today: number;
    rooms_total: number;
    rooms_busy_now: number;
    meetings_today: number;
    reservations_pending: number;
    oldest_open: {
      building: string;
      place: string | null;
      urgency: "low" | "medium" | "high" | "emergency";
      status: "pending" | "in_progress";
      age_days: number;
    }[];
  };
  repairs: {
    total: number;
    total_prev: number;
    reports: number;
    completed: number;
    cancelled: number;
    open: number;
    emergency: number;
    avg_hours: number | null;
    on_time_pct: number | null;
    by_building: { name: string; total: number; open: number }[];
    repeat_spots: { building: string; place: string; reports: number }[];
  };
  rooms: {
    total: number;
    total_prev: number;
    approved: number;
    rejected: number;
    pending: number;
    hours: number;
    by_room: { name: string; bookings: number; hours: number }[];
  };
  trend: {
    bucket: string;
    tickets: number;
    completed: number;
    reservations: number;
  }[];
}

export async function fetchSummary(
  supabase: SupabaseClient,
  period: Period,
): Promise<SummaryData | null> {
  const { data, error } = await supabase.rpc("executive_summary", {
    p_from: period.from.toISOString(),
    p_to: period.to.toISOString(),
    p_bucket: period.bucket,
  });
  if (error || !data) return null;
  return data as SummaryData;
}
