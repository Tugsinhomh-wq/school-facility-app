/** Standard equipment checklist shown on the meeting-room request form. No imports: node tests load this file directly. */

export interface EquipmentGroup {
  title: string;
  items: string[];
}

const STANDARD: EquipmentGroup[] = [
  {
    title: "ภาพและเสียง",
    items: [
      "จอภาพ/โปรเจกเตอร์",
      "เครื่องเสียง/ลำโพง",
      "ไมโครโฟน (ไมค์ลอย/ไมค์ตั้งโต๊ะ)",
      "คอมพิวเตอร์/โน้ตบุ๊กของห้อง",
      "สาย HDMI/ตัวแปลงสัญญาณ",
      "รีโมทเลื่อนสไลด์/เลเซอร์พอยน์เตอร์",
    ],
  },
  { title: "ประชุมออนไลน์", items: ["กล้องเว็บแคม", "อินเทอร์เน็ต/Wi-Fi", "ปลั๊กพ่วง"] },
  {
    title: "ห้องและที่นั่ง",
    items: [
      "จัดโต๊ะเก้าอี้ (ตัว U / แบบห้องเรียน / โต๊ะกลม)",
      "แท่นพูด",
      "ไวต์บอร์ด + ปากกา",
      "ป้ายชื่อ/ป้ายหน้าห้อง",
      "เปิดแอร์ล่วงหน้า",
    ],
  },
];

/** The small hall has no stage or sound system, so these are not offered there. */
const SMALL_ROOMS = new Set(["HALL-05"]);
const HIDDEN_IN_SMALL_ROOM = new Set([
  "เครื่องเสียง/ลำโพง",
  "ไมโครโฟน (ไมค์ลอย/ไมค์ตั้งโต๊ะ)",
  "รีโมทเลื่อนสไลด์/เลเซอร์พอยน์เตอร์",
  "จัดโต๊ะเก้าอี้ (ตัว U / แบบห้องเรียน / โต๊ะกลม)",
  "แท่นพูด",
  "ป้ายชื่อ/ป้ายหน้าห้อง",
]);

/** Checklist for one room: the standard groups, then anything the room officer added for this room only. */
export function equipmentGroupsFor(roomNumber: string, roomEquipment: string[]): EquipmentGroup[] {
  const small = SMALL_ROOMS.has(roomNumber);
  const groups = STANDARD.map((g) => ({
    title: g.title,
    items: small ? g.items.filter((i) => !HIDDEN_IN_SMALL_ROOM.has(i)) : g.items,
  })).filter((g) => g.items.length > 0);

  const known = new Set(STANDARD.flatMap((g) => g.items));
  const extra = [...new Set(roomEquipment.map((e) => e.trim()).filter((e) => e && !known.has(e)))];
  return extra.length > 0 ? [...groups, { title: "อุปกรณ์เฉพาะห้อง", items: extra }] : groups;
}
