import { bahtText, formatBahtNumber, formatThaiDate, SCHOOL_NAME } from "@/lib/memo/model";
import { URGENCY_LABEL } from "@/lib/ticket-meta";
import { atBangkok, bangkokYmd, formatInstantHm } from "@/lib/time";
import type { TicketRow } from "@/types/tickets";

/** First draft of a repair memo from a ticket. Staff edit it in the editor before exporting. */
export function draftFromTicket(t: TicketRow) {
  // Titles often already name the place ("ท่อน้ำรั่วโรงอาหาร"), so only add what is missing.
  const place = [t.building?.name, t.room?.name ?? t.location_detail]
    .filter((part): part is string => Boolean(part) && !t.title.includes(part as string))
    .join(" ");
  const reporter = t.reporter?.full_name ? `${t.reporter.full_name} ` : "";
  const cost = Number(t.estimated_cost);

  const paragraphs = [
    `ตามที่${reporter}ได้แจ้งว่า ${t.title}${place ? ` บริเวณ${place}` : ""} เมื่อวันที่ ${formatThaiDate(t.created_at)} (เลขที่งาน ${t.ticket_number}, ระดับ${URGENCY_LABEL[t.urgency]})${t.description ? ` โดยมีรายละเอียดดังนี้ ${t.description}` : ""}`,
    t.technician_notes
      ? `ฝ่ายอาคารสถานที่ได้ตรวจสอบแล้ว ${t.technician_notes}`
      : "ฝ่ายอาคารสถานที่ได้ตรวจสอบแล้ว พบว่าควรดำเนินการซ่อมแซมโดยเร็ว เพื่อความปลอดภัยและไม่ให้กระทบการเรียนการสอน",
  ];

  return {
    subject: `ขออนุมัติดำเนินการซ่อม ${t.title}`,
    recipient: `ผู้อำนวยการ${SCHOOL_NAME}`,
    body_content: paragraphs.join("\n"),
    proposal:
      cost > 0
        ? `ฝ่ายอาคารสถานที่ประมาณการค่าใช้จ่ายในการซ่อมเป็นเงิน ${formatBahtNumber(cost)} บาท (${bahtText(cost)}) จึงเห็นควรอนุมัติให้ดำเนินการซ่อมตามที่เสนอ`
        : "เห็นควรอนุมัติให้ดำเนินการซ่อมตามที่เสนอ",
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
