import type { BuildingOption, Viewer } from "@/lib/data/dashboard";
import { MOCK_BUILDINGS, MOCK_TICKETS } from "@/lib/mock-data";
import type { TicketStatus, UrgencyLevel, UserRole } from "@/types/database";
import type { TicketEvent } from "@/lib/ticket-events";
import type { TicketFilters, TicketRow } from "@/types/tickets";
import { getAuth } from "@/lib/supabase/auth";

export const PAGE_SIZE = 15;

const STATUSES: TicketStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
];
const URGENCIES: UrgencyLevel[] = ["low", "medium", "high", "emergency"];
const OPEN: TicketStatus[] = ["pending", "in_progress"];
/** Roles that handle repairs (same set as isStaffRole in session.ts, which this file does not import). */
const STAFF_ROLES: UserRole[] = ["staff", "head", "super_admin"];

/** Reads and validates the list filters from URL search params. */
export function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): TicketFilters {
  const one = (k: string) =>
    (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? undefined;
  const status = one("status") as TicketFilters["status"];
  const urgency = one("urgency") as UrgencyLevel | undefined;
  const page = Number.parseInt(one("page") ?? "1", 10);
  return {
    status: status === "open" || status === "mine" || (status && STATUSES.includes(status as TicketStatus)) ? status : undefined,
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
  /** Staff only: names of the assignees of the tickets on this page, by profile id. */
  assigneeNames: Record<string, string>;
  /** Signed in, but loading failed: show an error with a retry instead of sample data. */
  failed?: boolean;
}

const withReporter = (t: (typeof MOCK_TICKETS)[number]): TicketRow => ({
  ...t,
  reporter: { full_name: "ครู ตัวอย่าง" },
});

function mockList(f: TicketFilters): TicketList {
  const q = f.q?.toLowerCase();
  const open = f.status === "open";
  const all = MOCK_TICKETS.filter(
    (t) =>
      (!f.status ||
        (open ? OPEN.includes(t.status) : f.status === "mine" ? false : t.status === f.status)) &&
      (!f.urgency || t.urgency === f.urgency) &&
      (!f.building || t.building_id === f.building) &&
      (!q ||
        t.title.toLowerCase().includes(q) ||
        t.ticket_number.toLowerCase().includes(q)),
  ).sort((a, b) =>
    open
      ? URGENCIES.indexOf(b.urgency) - URGENCIES.indexOf(a.urgency) || a.created_at.localeCompare(b.created_at)
      : b.created_at.localeCompare(a.created_at),
  );
  return {
    source: "mock",
    viewer: null,
    tickets: all
      .slice((f.page - 1) * PAGE_SIZE, f.page * PAGE_SIZE)
      .map(withReporter),
    total: all.length,
    buildings: MOCK_BUILDINGS,
    assigneeNames: {},
  };
}

const SELECT =
  "*, building:buildings(name), room:rooms(room_number, name), reporter:profiles(full_name), dups:repair_tickets!duplicate_of(count)";

export async function getTicketList(f: TicketFilters): Promise<TicketList> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    return mockList(f);
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: auth } = await getAuth(supabase);
    if (!auth.user) return mockList(f);

    // Merged duplicates stay in the list, tagged "รวมกับ REQ-…" (see DuplicateNote), so they can be found.
    let query = supabase
      .from("repair_tickets")
      .select(SELECT, { count: "exact" });
    const queue = f.status === "open" || f.status === "mine";
    if (queue) query = query.in("status", OPEN);
    else if (f.status) query = query.eq("status", f.status);
    if (f.status === "mine") query = query.eq("assignee_id", auth.user.id);
    if (f.urgency) query = query.eq("urgency", f.urgency);
    if (f.building) query = query.eq("building_id", f.building);
    if (f.q) {
      // PostgREST or() syntax treats these characters as separators, so drop them.
      const term = f.q.replace(/[,()%*\\]/g, " ").trim();
      if (term)
        query = query.or(`title.ilike.%${term}%,ticket_number.ilike.%${term}%`);
    }
    const from = (f.page - 1) * PAGE_SIZE;
    // The urgency enum is declared low → emergency, so descending puts emergencies first.
    const ordered =
      queue
        ? query.order("urgency", { ascending: false }).order("created_at", { ascending: true })
        : query.order("created_at", { ascending: false });
    const [tickets, buildings, profile] = await Promise.all([
      ordered.range(from, from + PAGE_SIZE - 1),
      supabase
        .from("buildings")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", auth.user.id)
        .maybeSingle(),
    ]);
    if (tickets.error)
      return {
        source: "supabase",
        viewer: {
          name: profile.data?.full_name ?? auth.user.email ?? "ผู้ใช้",
          role: (profile.data?.role as UserRole | undefined) ?? "user",
        },
        tickets: [],
        total: 0,
        buildings: [],
        assigneeNames: {},
        failed: true,
      };
    const rows = tickets.data as unknown as TicketRow[];
    // Staff see who is handling each ticket; teachers cannot read other people's profiles, so skip them.
    const isStaff = STAFF_ROLES.includes(profile.data?.role as UserRole);
    const assigneeIds = [...new Set(rows.flatMap((t) => (t.assignee_id ? [t.assignee_id] : [])))];
    const assigneeNames: Record<string, string> = {};
    if (isStaff && assigneeIds.length > 0) {
      const { data: people } = await supabase.from("profiles").select("id, full_name").in("id", assigneeIds);
      for (const p of people ?? []) assigneeNames[p.id as string] = p.full_name as string;
    }
    return {
      source: "supabase",
      viewer: {
        name: profile.data?.full_name ?? auth.user.email ?? "ผู้ใช้",
        role: (profile.data?.role as UserRole | undefined) ?? "user",
      },
      tickets: rows,
      total: tickets.count ?? tickets.data.length,
      buildings: (buildings.data ?? []) as BuildingOption[],
      assigneeNames,
    };
  } catch {
    return {
      source: "supabase",
      viewer: null,
      tickets: [],
      total: 0,
      buildings: [],
      assigneeNames: {},
      failed: true,
    };
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
  /** The signed-in user's profile id (null in the sample-data mode). */
  viewerId: string | null;
  /** Status / owner / urgency changes, oldest first. Empty if the history table is not set up yet. */
  events: TicketEvent[];
  /** Staff only: people a ticket can be assigned to. */
  staffOptions: { id: string; name: string }[];
  /** Staff only: the current assignee's name. */
  assigneeName: string | null;
}

export async function getTicketDetail(id: string): Promise<TicketDetail> {
  const mock = (): TicketDetail => {
    const t = MOCK_TICKETS.find((x) => x.id === id);
    return {
      source: "mock",
      viewer: null,
      ticket: t ? withReporter(t) : null,
      imageUrls: [],
      afterImageUrls: [],
      viewerId: null,
      events: [],
      staffOptions: [],
      assigneeName: null,
    };
  };
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    return mock();
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: auth } = await getAuth(supabase);
    if (!auth.user) return mock();
    const [ticket, profile] = await Promise.all([
      supabase.from("repair_tickets").select(SELECT).eq("id", id).maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", auth.user.id)
        .maybeSingle(),
    ]);
    const row = ticket.error
      ? null
      : ((ticket.data as unknown as TicketRow | null) ?? null);
    let imageUrls: string[] = [];
    if (row?.image_urls?.length) {
      const { data: signed } = await supabase.storage
        .from("repair-images")
        .createSignedUrls(row.image_urls, 3600);
      imageUrls = (signed ?? []).flatMap((s) =>
        s.signedUrl ? [s.signedUrl] : [],
      );
    }
    let afterImageUrls: string[] = [];
    if (row?.after_image_urls?.length) {
      const { data: signed } = await supabase.storage
        .from("repair-images")
        .createSignedUrls(row.after_image_urls, 3600);
      afterImageUrls = (signed ?? []).flatMap((s) =>
        s.signedUrl ? [s.signedUrl] : [],
      );
    }
    const isStaff = STAFF_ROLES.includes(profile.data?.role as UserRole);
    const [eventRows, staffRows, assigneeRow] = await Promise.all([
      row
        ? supabase
            .from("repair_ticket_events")
            .select("id, kind, from_value, to_value, actor_name, created_at")
            .eq("ticket_id", row.id)
            .order("created_at")
        : null,
      isStaff
        ? supabase
            .from("profiles")
            .select("id, full_name")
            .in("role", STAFF_ROLES)
            .eq("is_active", true)
            .order("full_name")
        : null,
      isStaff && row?.assignee_id
        ? supabase.from("profiles").select("full_name").eq("id", row.assignee_id).maybeSingle()
        : null,
    ]);
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
      viewerId: auth.user.id,
      // If supabase/ticket_history.sql has not been run yet the query errors: show no history instead of failing the page.
      events: eventRows && !eventRows.error ? ((eventRows.data ?? []) as TicketEvent[]) : [],
      staffOptions: (staffRows?.data ?? []).map((p) => ({ id: p.id as string, name: p.full_name as string })),
      assigneeName: (assigneeRow?.data?.full_name as string | undefined) ?? null,
    };
  } catch {
    return mock();
  }
}

export interface DuplicateContext {
  /** Open main tickets in the same building this one could be merged into. */
  candidates: { id: string; ticket_number: string; title: string }[];
  /** Reports already merged into this ticket. */
  reports: {
    id: string;
    ticket_number: string;
    reporter_name: string | null;
    created_at: string;
  }[];
}

/** Staff only (RLS returns nothing for others): what the merge panel on a ticket needs. */
export async function getDuplicateContext(
  ticket: TicketRow,
): Promise<DuplicateContext> {
  const empty: DuplicateContext = { candidates: [], reports: [] };
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
    return empty;
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
      supabase
        .from("repair_tickets")
        .select("id, ticket_number, created_at, reporter:profiles(full_name)")
        .eq("duplicate_of", ticket.id)
        .order("created_at"),
    ]);
    return {
      candidates: (candidates.data ?? []) as DuplicateContext["candidates"],
      reports: (
        (reports.data ?? []) as unknown as {
          id: string;
          ticket_number: string;
          created_at: string;
          reporter: { full_name: string } | { full_name: string }[] | null;
        }[]
      ).map((r) => ({
        id: r.id,
        ticket_number: r.ticket_number,
        created_at: r.created_at,
        reporter_name:
          (Array.isArray(r.reporter) ? r.reporter[0] : r.reporter)?.full_name ??
          null,
      })),
    };
  } catch {
    return empty;
  }
}
