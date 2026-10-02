import type { BuildingOption, Viewer } from "@/lib/data/dashboard";
import { MOCK_BUILDINGS, MOCK_TICKETS } from "@/lib/mock-data";
import type { TicketStatus, UrgencyLevel, UserRole } from "@/types/database";
import type { TicketFilters, TicketRow } from "@/types/tickets";
import { getAuth } from "@/lib/supabase/auth";

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

const SELECT = "*, building:buildings(name), room:rooms(room_number, name), reporter:profiles(full_name), dups:repair_tickets!repair_tickets_duplicate_of_fkey(count)";

export async function getTicketList(f: TicketFilters): Promise<TicketList> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return mockList(f);
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: auth } = await getAuth(supabase);
    if (!auth.user) return mockList(f);

    // Merged duplicates stay out of the list (the main ticket carries their count), except your own.
    let query = supabase.from("repair_tickets").select(SELECT, { count: "exact" }).or(`duplicate_of.is.null,reporter_id.eq.${auth.user.id}`);
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
  /** Short-lived signed URLs for ticket.image_urls (the bucket is private). */
  imageUrls: string[];
  /** Signed URLs for ticket.after_image_urls. */
  afterImageUrls: string[];
}

export async function getTicketDetail(id: string): Promise<TicketDetail> {
  const mock = (): TicketDetail => {
    const t = MOCK_TICKETS.find((x) => x.id === id);
    return { source: "mock", viewer: null, ticket: t ? withReporter(t) : null, imageUrls: [], afterImageUrls: [] };
  };
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return mock();
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: auth } = await getAuth(supabase);
    if (!auth.user) return mock();
    const [ticket, profile] = await Promise.all([
      supabase.from("repair_tickets").select(SELECT).eq("id", id).maybeSingle(),
      supabase.from("profiles").select("full_name, role").eq("id", auth.user.id).maybeSingle(),
    ]);
    const row = ticket.error ? null : ((ticket.data as unknown as TicketRow | null) ?? null);
    let imageUrls: string[] = [];
    if (row?.image_urls?.length) {
      const { data: signed } = await supabase.storage.from("repair-images").createSignedUrls(row.image_urls, 3600);
      imageUrls = (signed ?? []).flatMap((s) => (s.signedUrl ? [s.signedUrl] : []));
    }
    let afterImageUrls: string[] = [];
    if (row?.after_image_urls?.length) {
      const { data: signed } = await supabase.storage.from("repair-images").createSignedUrls(row.after_image_urls, 3600);
      afterImageUrls = (signed ?? []).flatMap((s) => (s.signedUrl ? [s.signedUrl] : []));
    }
    return {
      source: "supabase",
      viewer: {
        name: profile.data?.full_name ?? auth.user.email ?? "ผู้ใช้",
        role: (profile.data?.role as UserRole | undefined) ?? "user",
      },
      // A malformed id or an RLS-hidden row both come back as no ticket.
      ticket: row,
      imageUrls,
      afterImageUrls,
    };
  } catch {
    return mock();
  }
}

export interface DuplicateContext {
  /** Open main tickets in the same building this one could be merged into. */
  candidates: { id: string; ticket_number: string; title: string }[];
  /** Reports already merged into this ticket. */
  reports: { id: string; ticket_number: string; reporter_name: string | null; created_at: string }[];
}

/** Staff only (RLS returns nothing for others): what the merge panel on a ticket needs. */
export async function getDuplicateContext(ticket: TicketRow): Promise<DuplicateContext> {
  const empty: DuplicateContext = { candidates: [], reports: [] };
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return empty;
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const [candidates, reports] = await Promise.all([
      ticket.duplicate_of
        ? Promise.resolve({ data: [] })
        : supabase
            .from("repair_tickets")
            .select("id, ticket_number, title")
            .eq("building_id", ticket.building_id)
            .in("status", ["pending", "in_progress"])
            .is("duplicate_of", null)
            .neq("id", ticket.id)
            .order("created_at", { ascending: false })
            .limit(20),
      supabase.from("repair_tickets").select("id, ticket_number, created_at, reporter:profiles(full_name)").eq("duplicate_of", ticket.id).order("created_at"),
    ]);
    return {
      candidates: (candidates.data ?? []) as DuplicateContext["candidates"],
      reports: ((reports.data ?? []) as unknown as { id: string; ticket_number: string; created_at: string; reporter: { full_name: string } | { full_name: string }[] | null }[]).map((r) => ({
        id: r.id,
        ticket_number: r.ticket_number,
        created_at: r.created_at,
        reporter_name: (Array.isArray(r.reporter) ? r.reporter[0] : r.reporter)?.full_name ?? null,
      })),
    };
  } catch {
    return empty;
  }
}
