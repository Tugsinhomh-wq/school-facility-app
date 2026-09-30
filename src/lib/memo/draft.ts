import { bahtText, formatBahtNumber, formatThaiDate, SCHOOL_NAME } from "@/lib/memo/model";
import { URGENCY_LABEL } from "@/lib/ticket-meta";
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
