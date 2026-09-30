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
  body_content: "",
  proposal: null,
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
