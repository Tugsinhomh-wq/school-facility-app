import { STATUS_LABEL, URGENCY_LABEL } from "./ticket-meta.ts";

/** One row of repair_ticket_events as the detail page reads it. */
export interface TicketEvent {
  id: string;
  kind: "status" | "assignee" | "urgency";
  /** Status / urgency value, or the previous owner's name. */
  from_value: string | null;
  /** Status / urgency value, or the new owner's name (null = owner removed). */
  to_value: string | null;
  actor_name: string | null;
  created_at: string;
}

const labelOf = (labels: Record<string, string>, value: string | null) => (value ? (labels[value] ?? value) : "-");

/** Who did it and what, in Thai, for the timeline. An unknown value is shown as stored rather than hidden. */
export function describeEvent(e: TicketEvent): { who: string; what: string } {
  const who = e.actor_name ?? "ระบบ";
  switch (e.kind) {
    case "status":
      return { who, what: `เปลี่ยนสถานะเป็น “${labelOf(STATUS_LABEL, e.to_value)}”` };
    case "urgency":
      return { who, what: `ปรับความเร่งด่วนเป็น “${labelOf(URGENCY_LABEL, e.to_value)}”` };
    case "assignee":
      if (e.to_value && e.from_value) return { who, what: `เปลี่ยนผู้รับผิดชอบจาก ${e.from_value} เป็น ${e.to_value}` };
      if (e.to_value) return { who, what: `มอบหมายงานให้ ${e.to_value}` };
      return { who, what: `ยกเลิกผู้รับผิดชอบ${e.from_value ? ` (เดิม ${e.from_value})` : ""}` };
  }
}

/** How long a repair took, from report to completion: "3 วัน", "5 ชั่วโมง" or "ไม่ถึง 1 ชั่วโมง". */
export function repairDuration(createdAt: string, completedAt: string): string {
  const hours = Math.max(0, (new Date(completedAt).getTime() - new Date(createdAt).getTime()) / 3_600_000);
  if (hours >= 24) return `${Math.floor(hours / 24)} วัน`;
  if (hours >= 1) return `${Math.floor(hours)} ชั่วโมง`;
  return "ไม่ถึง 1 ชั่วโมง";
}
