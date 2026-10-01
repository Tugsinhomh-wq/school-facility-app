import { addDays, bangkokYmd } from "@/lib/time";
import type { Building, Memorandum, RepairTicketWithLocation } from "@/types/database";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const MOCK_BUILDINGS: Pick<Building, "id" | "name">[] = [
  { id: "b1", name: "อาคาร 1" },
  { id: "b2", name: "อาคาร 2" },
  { id: "b3", name: "อาคาร 3" },
  { id: "b4", name: "โรงอาหาร" },
  { id: "b5", name: "อาคารเกษตร" },
];

const base = {
  reporter_id: "00000000-0000-0000-0000-000000000000",
  room_id: null,
  description: "",
  image_urls: [] as string[],
  technician_notes: null,
  updated_at: ago(0),
};

const b = (i: number) => ({ building_id: MOCK_BUILDINGS[i].id, building: { name: MOCK_BUILDINGS[i].name } });
const room = (room_number: string, name: string) => ({ room: { room_number, name } });
const noRoom = { room: null };

/** Sample data so the dashboard renders without Supabase credentials or a signed-in user. */
export const MOCK_TICKETS: RepairTicketWithLocation[] = [
  { ...base, ...b(0), ...room("112", "ห้องเรียน 112"), location_detail: null, id: "t1", ticket_number: "REQ-202609-0012", title: "หลอดไฟห้องเรียนขาด 3 ดวง", urgency: "medium", status: "pending", estimated_cost: 900, created_at: ago(6) },
  { ...base, ...b(3), ...noRoom, location_detail: "ท่อใต้ซิงก์ล้างจาน", id: "t2", ticket_number: "REQ-202609-0011", title: "ท่อน้ำรั่วบริเวณโรงอาหาร", urgency: "emergency", status: "in_progress", estimated_cost: 4500, created_at: ago(38) },
  { ...base, ...b(1), ...room("T01", "ห้องพักครู"), location_detail: null, id: "t3", ticket_number: "REQ-202609-0010", title: "แอร์ห้องพักครูไม่เย็น", urgency: "high", status: "pending", estimated_cost: 3200, created_at: ago(95) },
  { ...base, ...b(4), ...noRoom, location_detail: "ทางเดินหน้าอาคาร", id: "t4", ticket_number: "REQ-202609-0009", title: "ต้นไม้ใหญ่กิ่งหักเสี่ยงล้มทับทางเดิน", urgency: "high", status: "in_progress", estimated_cost: 2500, created_at: ago(60 * 5) },
  { ...base, ...b(0), ...noRoom, location_detail: "ห้องน้ำชั้น 2", id: "t5", ticket_number: "REQ-202609-0008", title: "ประตูห้องน้ำชำรุด ล็อกไม่ได้", urgency: "low", status: "completed", estimated_cost: 650, created_at: ago(60 * 26) },
  { ...base, ...b(2), ...room("301", "ห้องคอมพิวเตอร์"), location_detail: null, id: "t6", ticket_number: "REQ-202609-0007", title: "ปลั๊กไฟช็อตในห้องคอมพิวเตอร์", urgency: "emergency", status: "completed", estimated_cost: 1800, created_at: ago(60 * 50) },
  { ...base, ...b(0), ...room("108", "ห้องเรียน 108"), location_detail: null, id: "t7", ticket_number: "REQ-202609-0006", title: "โต๊ะนักเรียนขาหัก 6 ตัว", urgency: "low", status: "completed", estimated_cost: 1200, created_at: ago(60 * 72) },
  { ...base, ...b(3), ...noRoom, location_detail: "หลังคาด้านทิศตะวันตก", id: "t8", ticket_number: "REQ-202609-0005", title: "หลังคาโรงอาหารรั่วเมื่อฝนตก", urgency: "high", status: "pending", estimated_cost: 12000, created_at: ago(60 * 96) },
];

const memoBase = {
  origin_module: "repair" as const,
  author_id: "00000000-0000-0000-0000-000000000000",
  recipient: "ผู้อำนวยการโรงเรียน",
  body_content: "ฝ่ายอาคารสถานที่ได้ตรวจสอบแล้ว พบว่าควรดำเนินการซ่อมแซมโดยเร็ว เพื่อความปลอดภัยและไม่ให้กระทบการเรียนการสอน",
  proposal: "เห็นควรอนุมัติให้ดำเนินการซ่อมตามที่เสนอ",
  approval_mode: "paper_hybrid" as const,
  current_step: 1,
  updated_at: ago(0),
};

export const MOCK_MEMOS: Memorandum[] = [
  { ...memoBase, id: "m1", doc_ref_no: "ศธ 04321/พิเศษ 21", reference_id: "t2", subject: "ขออนุมัติซ่อมท่อน้ำรั่วโรงอาหาร", final_status: "pending", created_at: ago(30) },
  { ...memoBase, id: "m2", doc_ref_no: "ศธ 04321/พิเศษ 19", reference_id: "t4", subject: "ขออนุมัติตัดแต่งกิ่งไม้ใหญ่หน้าอาคารเกษตร", final_status: "pending", created_at: ago(60 * 4) },
  { ...memoBase, id: "m3", doc_ref_no: "ศธ 04321/พิเศษ 17", reference_id: "t6", subject: "ขออนุมัติซ่อมระบบไฟห้องคอมพิวเตอร์", final_status: "approved", created_at: ago(60 * 48) },
  { ...memoBase, id: "m4", doc_ref_no: "ศธ 04321/พิเศษ 14", reference_id: "t8", subject: "ขออนุมัติซ่อมหลังคาโรงอาหาร", final_status: "revision_requested", created_at: ago(60 * 90) },
];

// ---- Meeting rooms (demo mode) ----
export interface MockRoom {
  id: string;
  room_number: string;
  name: string;
  building_name: string;
  capacity: number | null;
  requires_approval: boolean;
  equipment: string[];
}

export const MOCK_ROOMS: MockRoom[] = [
  { id: "r1", room_number: "HALL-01", name: "ห้องประชุมภูมินทร์", building_name: "ห้องประชุมภูมินทร์", capacity: null, requires_approval: true, equipment: [] },
  { id: "r2", room_number: "HALL-02", name: "ห้องประชุมมหาชนก", building_name: "ห้องประชุมมหาชนก", capacity: null, requires_approval: true, equipment: [] },
  { id: "r3", room_number: "HALL-03", name: "ห้องประชุมเฉลิมพระเกียรติ", building_name: "ห้องประชุมเฉลิมพระเกียรติ", capacity: null, requires_approval: true, equipment: [] },
  { id: "r4", room_number: "HALL-04", name: "ห้องประชุมบุคลากรครู", building_name: "ห้องประชุมบุคลากรครู", capacity: null, requires_approval: false, equipment: [] },
  { id: "r5", room_number: "HALL-05", name: "ห้องประชุมเล็ก", building_name: "ห้องประชุมเล็ก", capacity: null, requires_approval: false, equipment: [] },
];

export interface MockBooking {
  id: string;
  room_id: string;
  applicant_id: string;
  applicant_name: string | null;
  purpose: string;
  attendee_count: number | null;
  equipment_needed: string | null;
  start_time: string;
  end_time: string;
  status: "pending" | "approved";
}

const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

/** ISO time for today + `dayOffset` at hh:mm Bangkok time. */
function at(dayOffset: number, hhmm: string) {
  const day = addDays(bangkokYmd(new Date()), dayOffset);
  return new Date(`${day}T${hhmm}:00+07:00`).toISOString();
}

/**
 * Sample bookings: fixed daytime slots today and tomorrow so the calendar always has blocks,
 * plus one meeting running "now" so the live status and ticker have something to show.
 */
export function mockBookings(): MockBooking[] {
  const base = { applicant_id: "mock-user", attendee_count: 8, equipment_needed: null };
  return [
    { ...base, id: "b0", room_id: "r4", applicant_name: "ครูนภา ศรีสุข", purpose: "อบรมการใช้โปรแกรมสำนักงาน", attendee_count: 30, start_time: inMinutes(-30), end_time: inMinutes(45), status: "approved" },
    { ...base, id: "b1", room_id: "r5", applicant_name: "ครูสมหญิง ใจดี", purpose: "ประชุมกลุ่มสาระวิทยาศาสตร์", start_time: at(0, "09:00"), end_time: at(0, "10:30"), status: "approved" },
    { ...base, id: "b2", room_id: "r1", applicant_name: "ครูวิชัย มั่นคง", purpose: "ประชุมผู้ปกครองชั้น ม.1", attendee_count: 45, start_time: at(0, "13:00"), end_time: at(0, "15:00"), status: "approved" },
    { ...base, id: "b3", room_id: "r1", applicant_name: "ครูสมชาย รักงาน", purpose: "อบรมการใช้ระบบแจ้งซ่อม", attendee_count: 30, start_time: at(1, "10:00"), end_time: at(1, "12:00"), status: "pending" },
    { ...base, id: "b4", room_id: "r5", applicant_name: "ครูนภา ศรีสุข", purpose: "ประชุมฝ่ายวิชาการ", attendee_count: 10, start_time: at(1, "09:00"), end_time: at(1, "10:00"), status: "approved" },
    { ...base, id: "b5", room_id: "r1", applicant_name: "ครูวิชัย มั่นคง", purpose: "ซ้อมพิธีเปิดกีฬาสี", attendee_count: 50, start_time: at(1, "13:00"), end_time: at(1, "15:00"), status: "approved" },
  ];
}
