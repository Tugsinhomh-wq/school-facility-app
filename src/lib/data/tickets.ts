import type { BuildingOption, Viewer } from "@/lib/data/dashboard";
import { MOCK_BUILDINGS, MOCK_TICKETS } from "@/lib/mock-data";
import type { TicketStatus, UrgencyLevel, UserRole } from "@/types/database";
import type { TicketFilters, TicketRow } from "@/types/tickets";

export const PAGE_SIZE = 15;

const STATUSES: TicketStatus[] = ["pending", "in_progress", "completed", "cancelled"];
const URGENCIES: UrgencyLevel[] = ["low", "medium", "high", "emergency"];

/** Reads and validates the list filters from URL search params. */
export function parseFilters(sp: Record<string, string | string[] | undefined>): TicketFilters {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? undefined;
  const status = one("status") as TicketStatus | undefined;
  const urgency = one("urgency") as UrgencyLevel | undefined;
  const page = Number.parseInt(one("page") ?? "1", 10);
  return {
    status: status && STATUSES.includes(status) ? status : undefined,
    urgency: urgency && URGENCIES.includes(urgency) ? urgency : undefined,
    building: one("building") || undefined,
    q: one("q")?.trim().slice(0, 80) || undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export interface TicketList {
  source: "supabase" | "mock";
  viewer: Viewer | null;
  tickets: TicketRow[];
  total: number;
  buildings: BuildingOption[];
}

const withReporter = (t: (typeof MOCK_TICKETS)[number]): TicketRow => ({ ...t, reporter: { full_name: "ครู ตัวอย่าง" } });

function mockList(f: TicketFilters): TicketList {
  const q = f.q?.toLowerCase();
  const all = MOCK_TICKETS.filter(
    (t) =>
      (!f.status || t.status === f.status) &&
      (!f.urgency || t.urgency === f.urgency) &&
      (!f.building || t.building_id === f.building) &&
      (!q || t.title.toLowerCase().includes(q) || t.ticket_number.toLowerCase().includes(q)),
  ).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return {
    source: "mock",
    viewer: null,
    tickets: all.slice((f.page - 1) * PAGE_SIZE, f.page * PAGE_SIZE).map(withReporter),
    total: all.length,
    buildings: MOCK_BUILDINGS,
  };
}

const SELECT = "*, building:buildings(name), room:rooms(room_number, name), reporter:profiles(full_name)";

export async function getTicketList(f: TicketFilters): Promise<TicketList> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return mockList(f);
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return mockList(f);

    let query = supabase.from("repair_tickets").select(SELECT, { count: "exact" });
    if (f.status) query = query.eq("status", f.status);
    if (f.urgency) query = query.eq("urgency", f.urgency);
    if (f.building) query = query.eq("building_id", f.building);
    if (f.q) {
      // PostgREST or() syntax treats these characters as separators, so drop them.
      const term = f.q.replace(/[,()%*\\]/g, " ").trim();
      if (term) query = query.or(`title.ilike.%${term}%,ticket_number.ilike.%${term}%`);
    }
    const from = (f.page - 1) * PAGE_SIZE;
    const [tickets, buildings, profile] = await Promise.all([
      query.order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1),
      supabase.from("buildings").select("id, name").eq("is_active", true).order("name"),
      supabase.from("profiles").select("full_name, role").eq("id", auth.user.id).maybeSingle(),
    ]);
    if (tickets.error) return mockList(f);
    return {
      source: "supabase",
      viewer: {
        name: profile.data?.full_name ?? auth.user.email ?? "ผู้ใช้",
        role: (profile.data?.role as UserRole | undefined) ?? "user",
      },
      tickets: tickets.data as unknown as TicketRow[],
      total: tickets.count ?? tickets.data.length,
      buildings: (buildings.data ?? []) as BuildingOption[],
    };
  } catch {
    return mockList(f);
  }
}

export interface TicketDetail {
  source: "supabase" | "mock";
  viewer: Viewer | null;
  ticket: TicketRow | null;
}

export async function getTicketDetail(id: string): Promise<TicketDetail> {
  const mock = (): TicketDetail => {
    const t = MOCK_TICKETS.find((x) => x.id === id);
    return { source: "mock", viewer: null, ticket: t ? withReporter(t) : null };
  };
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return mock();
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return mock();
    const [ticket, profile] = await Promise.all([
      supabase.from("repair_tickets").select(SELECT).eq("id", id).maybeSingle(),
      supabase.from("profiles").select("full_name, role").eq("id", auth.user.id).maybeSingle(),
    ]);
    return {
      source: "supabase",
      viewer: {
        name: profile.data?.full_name ?? auth.user.email ?? "ผู้ใช้",
        role: (profile.data?.role as UserRole | undefined) ?? "user",
      },
      // A malformed id or an RLS-hidden row both come back as no ticket.
      ticket: ticket.error ? null : ((ticket.data as unknown as TicketRow | null) ?? null),
    };
  } catch {
    return mock();
  }
}
