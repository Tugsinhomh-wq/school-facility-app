import { formatThaiDate, SCHOOL_NAME } from "@/lib/memo/model";
import type { SummaryData } from "@/lib/data/summary";
import type { Period } from "@/lib/summary-period";

const n = (v: number) => new Intl.NumberFormat("en-US").format(v);

function duration(hours: number | null) {
  if (hours == null) return null;
  return hours >= 48 ? `${(hours / 24).toFixed(1)} วัน` : `${hours} ชั่วโมง`;
}

/** First draft of the "summary for the director's acknowledgement" memo; staff edit it before exporting. */
export function draftFromSummary(period: Period, d: SummaryData) {
  const from = formatThaiDate(period.from);
  const to = formatThaiDate(new Date(period.to.getTime() - 24 * 3600 * 1000));
  const r = d.repairs;
  const rm = d.rooms;

  const intro = `ด้วยงานอาคารสถานที่ขอรายงานสรุปการดำเนินงานแจ้งซ่อมและการใช้ห้องประชุมของโรงเรียน ในช่วงเวลา ${period.label} (วันที่ ${from} ถึงวันที่ ${to}) จากข้อมูลในระบบแจ้งซ่อมอาคารสถานที่ ดังนี้`;

  const repairParts = [
    `1. งานแจ้งซ่อม มีงานแจ้งทั้งสิ้น ${n(r.total)} งาน ดำเนินการเสร็จแล้ว ${n(r.completed)} งาน คงเหลือระหว่างดำเนินการ ${n(r.open)} งาน`,
  ];
  if (r.cancelled) repairParts.push(`ยกเลิก ${n(r.cancelled)} งาน`);
  const avg = duration(r.avg_hours);
  if (avg)
    repairParts.push(
      `ใช้เวลาซ่อมเฉลี่ย ${avg}${r.on_time_pct != null ? ` และซ่อมเสร็จภายในกำหนดร้อยละ ${r.on_time_pct}` : ""}`,
    );
  if (r.emergency) repairParts.push(`เป็นงานฉุกเฉิน ${n(r.emergency)} งาน`);
  if (r.by_building.length)
    repairParts.push(
      `อาคารหรือสถานที่ที่มีการแจ้งซ่อมมากที่สุด ได้แก่ ${r.by_building
        .slice(0, 3)
        .map((b) => `${b.name} ${n(b.total)} งาน`)
        .join(" ")}`,
    );
  if (r.repeat_spots.length)
    repairParts.push(
      `จุดที่มีการแจ้งซ้ำ ได้แก่ ${r.repeat_spots
        .slice(0, 3)
        .map((s) => `${s.building} ${s.place} ${n(s.reports)} ครั้ง`)
        .join(" ")}`,
    );

  const roomParts = [
    `2. การใช้ห้องประชุม มีการขอใช้ ${n(rm.total)} ครั้ง อนุมัติ ${n(rm.approved)} ครั้ง ไม่อนุมัติ ${n(rm.rejected)} ครั้ง${rm.pending ? ` รอพิจารณา ${n(rm.pending)} ครั้ง` : ""} รวมเวลาใช้งานตามที่อนุมัติ ${n(rm.hours)} ชั่วโมง`,
  ];
  if (rm.by_room.length)
    roomParts.push(
      `ห้องที่ใช้งานมากที่สุด ได้แก่ ${rm.by_room
        .slice(0, 3)
        .map((x) => `${x.name} ${n(x.hours)} ชั่วโมง`)
        .join(" ")}`,
    );

  return {
    subject: `รายงานสรุปการแจ้งซ่อมและการใช้ห้องประชุม ${period.label}`,
    recipient: `ผู้อำนวยการ${SCHOOL_NAME}`,
    body_content: [intro, repairParts.join(" "), roomParts.join(" ")].join(
      "\n",
    ),
    proposal: "",
  };
}
