import type { RepairTicket } from "@/types/database";

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const base = {
  reporter_id: "00000000-0000-0000-0000-000000000000",
  image_urls: [] as string[],
  technician_notes: null,
  updated_at: ago(0),
};

/** Sample data so the dashboard renders without Supabase credentials. */
export const MOCK_TICKETS: RepairTicket[] = [
  { ...base, id: "t1", ticket_number: "REQ-202609-0012", title: "หลอดไฟห้องเรียนขาด 3 ดวง", description: "", category: "electrical", location_building: "อาคาร 1", location_room: "ห้อง 112", urgency: "medium", status: "pending", estimated_cost: 900, document_ref_no: null, created_at: ago(6) },
  { ...base, id: "t2", ticket_number: "REQ-202609-0011", title: "ท่อน้ำรั่วบริเวณโรงอาหาร", description: "", category: "plumbing", location_building: "โรงอาหาร", location_room: null, urgency: "emergency", status: "in_progress", estimated_cost: 4500, document_ref_no: "ศธ 04321/พิเศษ 21", created_at: ago(38) },
  { ...base, id: "t3", ticket_number: "REQ-202609-0010", title: "แอร์ห้องพักครูไม่เย็น", description: "", category: "furniture_equipment", location_building: "อาคาร 2", location_room: "ห้องพักครู", urgency: "high", status: "pending", estimated_cost: 3200, document_ref_no: null, created_at: ago(95) },
  { ...base, id: "t4", ticket_number: "REQ-202609-0009", title: "ต้นไม้ใหญ่กิ่งหักเสี่ยงล้มทับทางเดิน", description: "", category: "environment_grounds", location_building: "อาคารเกษตร", location_room: null, urgency: "high", status: "in_progress", estimated_cost: 2500, document_ref_no: "ศธ 04321/พิเศษ 19", created_at: ago(60 * 5) },
  { ...base, id: "t5", ticket_number: "REQ-202609-0008", title: "ประตูห้องน้ำชำรุด ล็อกไม่ได้", description: "", category: "building_structure", location_building: "อาคาร 1", location_room: "ห้องน้ำชั้น 2", urgency: "low", status: "completed", estimated_cost: 650, document_ref_no: null, created_at: ago(60 * 26) },
  { ...base, id: "t6", ticket_number: "REQ-202609-0007", title: "ปลั๊กไฟช็อตในห้องคอมพิวเตอร์", description: "", category: "electrical", location_building: "อาคาร 3", location_room: "ห้อง 301", urgency: "emergency", status: "completed", estimated_cost: 1800, document_ref_no: "ศธ 04321/พิเศษ 17", created_at: ago(60 * 50) },
  { ...base, id: "t7", ticket_number: "REQ-202609-0006", title: "โต๊ะนักเรียนขาหัก 6 ตัว", description: "", category: "furniture_equipment", location_building: "อาคาร 1", location_room: "ห้อง 108", urgency: "low", status: "completed", estimated_cost: 1200, document_ref_no: null, created_at: ago(60 * 72) },
  { ...base, id: "t8", ticket_number: "REQ-202609-0005", title: "หลังคาโรงอาหารรั่วเมื่อฝนตก", description: "", category: "building_structure", location_building: "โรงอาหาร", location_room: null, urgency: "high", status: "pending", estimated_cost: 12000, document_ref_no: "ศธ 04321/พิเศษ 14", created_at: ago(60 * 96) },
];
