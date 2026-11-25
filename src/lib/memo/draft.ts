import { bahtText, formatBahtNumber, formatThaiDate, SCHOOL_NAME } from "./model.ts";
import { atBangkok, bangkokYmd, formatInstantHm } from "../time.ts";
import type { TicketRow } from "@/types/tickets";

/**
 * First draft of a repair memo from a ticket, in the building unit's three-part form:
 * reason, facts and cost, then the request (the closing line is added by the renderer).
 * `author` is the staff member writing the memo ("ข้าพเจ้า"); staff edit the text before exporting.
 */
export function draftFromTicket(t: TicketRow, author?: { full_name: string; position: string | null } | null) {
  const where = [t.building?.name, t.room?.name ?? t.location_detail].filter(Boolean).join(" ");
  const who = author?.full_name ? `ข้าพเจ้า ${author.full_name} ตำแหน่ง ${author.position || "........................"}` : "ข้าพเจ้า";
  const reporter = t.reporter?.full_name ? `ได้รับแจ้งจาก${t.reporter.full_name}` : "ได้รับแจ้ง";
  const cost = Number(t.estimated_cost);
  const urgent = t.urgency === "high" || t.urgency === "emergency";
  const damage = [t.title, t.description && t.description !== t.title ? t.description : ""].filter(Boolean).join(" ");

  const reason = `ด้วย${who} ${reporter} ถึงความชำรุดเสียหายของอาคารสถานที่ ณ ${where || "บริเวณโรงเรียน"} เมื่อวันที่ ${formatThaiDate(t.created_at)} เลขที่งาน ${t.ticket_number} โดยมีสภาพความเสียหายดังนี้ ${damage}`;
  const facts =
    `งานอาคารสถานที่ได้ดำเนินการตรวจสอบสภาพความเสียหายดังกล่าวแล้ว พบว่ามีความจำเป็นต้องดำเนินการซ่อมแซม${urgent ? "อย่างเร่งด่วน" : "โดยเร็ว"} เพื่อความปลอดภัยของนักเรียนและครูผู้สอน และไม่ให้เกิดความเสียหายลุกลาม` +
    (t.technician_notes ? ` ${t.technician_notes}` : "") +
    (cost > 0 ? ` โดยประมาณการค่าใช้จ่ายเบื้องต้น เป็นจำนวนเงิน ${formatBahtNumber(cost)} บาท (${bahtText(cost)}) ตามรายการประมาณการแนบท้ายนี้` : " ทั้งนี้อยู่ระหว่างประมาณการค่าใช้จ่าย");

  return {
    subject: "ขออนุมัติซ่อมแซมอาคารสถานที่และสิ่งอำนวยความสะดวกที่ชำรุด",
    recipient: `ผู้อำนวยการ${SCHOOL_NAME}`,
    body_content: [reason, facts].join("\n"),
    // The request itself is the fixed closing paragraph, so the free proposal field stays empty.
    proposal: "",
  };
}

/** Where a ticket is: building, then room or spot; "บริเวณโรงเรียน" when nothing is known. */
export const placeOfTicket = (t: {
  building?: { name: string } | null;
  room?: { name: string } | null;
  location_detail?: string | null;
}) => [t.building?.name, t.room?.name ?? t.location_detail].filter(Boolean).join(" ") || "บริเวณโรงเรียน";

/**
 * First draft of one repair memo that covers several tickets, from one building or several, to ask the
 * director to approve them together: an opening paragraph, numbered items (oldest first) and a total.
 * `groups` maps a ticket id to a group number; tickets of one group become a single item that lists each
 * place. `orderedIds` is the ticket ids in item order, for the memo's attachments. No cost section.
 * Staff edit the text before exporting.
 */
export function draftFromTickets(tickets: TicketRow[], groups: Record<string, number> = {}) {
  const sorted = [...tickets].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const n = sorted.length;
  const urgent = sorted.some((t) => t.urgency === "high" || t.urgency === "emergency");
  const buildings = [...new Set(sorted.map((t) => t.building?.name).filter((x): x is string => !!x))];
  const where = buildings.join(", ") || "บริเวณโรงเรียน";

  // An item per ungrouped ticket, one per group; items follow their first (oldest) ticket.
  const items: TicketRow[][] = [];
  const byGroup = new Map<number, TicketRow[]>();
  for (const t of sorted) {
    const g = groups[t.id];
    if (g === undefined) {
      items.push([t]);
      continue;
    }
    let item = byGroup.get(g);
    if (!item) {
      item = [];
      byGroup.set(g, item);
      items.push(item);
    }
    item.push(t);
  }

  const damageOf = (t: TicketRow) => [t.title, t.description && t.description !== t.title ? t.description : ""].filter(Boolean).join(" ");
  const when = (t: TicketRow) => `เลขที่งาน ${t.ticket_number} แจ้งเมื่อ ${formatThaiDate(t.created_at)}${t.technician_notes ? ` ${t.technician_notes}` : ""}`;
  const lines = items.map((item, i) => {
    if (item.length === 1) return `${i + 1}. ${placeOfTicket(item[0])}: ${damageOf(item[0])} ${when(item[0])}`;
    return `${i + 1}. ${item[0].title} จำนวน ${item.length} จุด ได้แก่ ${item.map((t) => `${placeOfTicket(t)} ${when(t)}`).join("; ")}`;
  });

  const opening = `ด้วยงานอาคารสถานที่ได้รับแจ้งความชำรุดเสียหายของอาคารสถานที่ ณ ${where} รวม ${n} รายการ และได้ตรวจสอบสภาพความเสียหายแล้ว พบว่ามีความจำเป็นต้องดำเนินการซ่อมแซม${urgent ? "อย่างเร่งด่วน" : "โดยเร็ว"} เพื่อความปลอดภัยของนักเรียนและครูผู้สอน และไม่ให้เกิดความเสียหายลุกลาม ดังรายการต่อไปนี้`;

  return {
    subject: buildings.length > 1 ? `ขออนุมัติซ่อมแซมอาคารสถานที่ จำนวน ${n} รายการ` : `ขออนุมัติซ่อมแซมอาคารสถานที่ ${where} จำนวน ${n} รายการ`,
    recipient: `ผู้อำนวยการ${SCHOOL_NAME}`,
    body_content: [opening, ...lines, `รวมทั้งสิ้น ${n} รายการ`].join("\n"),
    // The request itself is the fixed closing paragraph, so the free proposal field stays empty.
    proposal: "",
    orderedIds: items.flat().map((t) => t.id),
  };
}

export interface ReservationDraftInput {
  applicantName: string | null;
  roomName: string;
  buildingName: string;
  purpose: string;
  startTime: string;
  endTime: string;
  attendeeCount: number | null;
  equipmentNeeded: string | null;
}

/** First draft of a room-use memo from a reservation. The requester edits it in the memo editor. */
export function draftFromReservation(r: ReservationDraftInput) {
  const who = r.applicantName ? `${r.applicantName} ` : "";
  const ymd = bangkokYmd(new Date(r.startTime));
  const times = `${formatInstantHm(r.startTime)}-${formatInstantHm(r.endTime)} น.`;
  const parts = [
    `ด้วย${who}มีความประสงค์ขอใช้${r.roomName}${r.buildingName ? ` (${r.buildingName})` : ""} เพื่อ${r.purpose} ในวันที่ ${formatThaiDate(atBangkok(ymd, 0))} เวลา ${times}${r.attendeeCount ? ` มีผู้เข้าร่วมประมาณ ${r.attendeeCount} คน` : ""}`,
  ];
  if (r.equipmentNeeded) parts.push(`ทั้งนี้ต้องการใช้อุปกรณ์ ได้แก่ ${r.equipmentNeeded}`);
  return {
    subject: `ขออนุญาตใช้${r.roomName} เพื่อ${r.purpose}`,
    recipient: `ผู้อำนวยการ${SCHOOL_NAME}`,
    body_content: parts.join("\n"),
    proposal: `เห็นควรอนุญาตให้ใช้${r.roomName}ตามวันและเวลาข้างต้น`,
  };
}
