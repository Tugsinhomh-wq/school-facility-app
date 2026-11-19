import type { TicketStatus, UrgencyLevel } from "../types/database.ts";

export type BacklogTicket = {
  id: string;
  ticket_number: string;
  title: string;
  urgency: UrgencyLevel;
  status: TicketStatus;
  created_at: string;
  /** Set when the report was merged into another ticket. */
  duplicate_of: string | null;
  location_detail: string | null;
  building: { name: string } | null;
  room: { room_number: string; name: string | null } | null;
};

export type BacklogRow = {
  id: string;
  ticketNumber: string;
  place: string;
  title: string;
  urgency: UrgencyLevel;
  status: TicketStatus;
  ageDays: number;
  unread: boolean;
};

export type BacklogGroup = { building: string; total: number; urgent: number; rows: BacklogRow[] };

const DAY = 86_400_000;
const th = (a: string, b: string) => a.localeCompare(b, "th", { numeric: true });

/**
 * The open repairs for the budget deputy: one group per building (with how many are open and how many are
 * urgent), plus the rows that hold an unread comment. An open row with an unread comment also stays in its
 * building so the count is true. A closed or merged ticket is never counted in a building: it goes to `closed`
 * (newest first), and to the top list too when it holds an unread comment.
 */
export function groupBacklog(tickets: BacklogTicket[], unreadIds: ReadonlySet<string>, now: number) {
  const byBuilding = new Map<string, BacklogGroup>();
  const unread: BacklogRow[] = [];
  const closed: BacklogRow[] = [];
  const sorted = [...tickets].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const t of sorted) {
    const row: BacklogRow = {
      id: t.id,
      ticketNumber: t.ticket_number,
      place: t.room?.name ?? t.room?.room_number ?? t.location_detail ?? "ไม่ระบุจุด",
      title: t.title,
      urgency: t.urgency,
      status: t.status,
      ageDays: Math.floor((now - new Date(t.created_at).getTime()) / DAY),
      unread: unreadIds.has(t.id),
    };
    if (row.unread) unread.push(row);
    if ((t.status !== "pending" && t.status !== "in_progress") || t.duplicate_of) {
      closed.push(row);
      continue;
    }
    const name = t.building?.name ?? "ไม่ระบุอาคาร";
    const group = byBuilding.get(name) ?? { building: name, total: 0, urgent: 0, rows: [] };
    group.total += 1;
    if (t.urgency === "high" || t.urgency === "emergency") group.urgent += 1;
    group.rows.push(row);
    byBuilding.set(name, group);
  }
  const groups = [...byBuilding.values()].sort((a, b) => th(a.building, b.building));
  for (const g of groups) g.rows.sort((a, b) => th(a.place, b.place));
  return { unread, groups, closed: closed.reverse() };
}
