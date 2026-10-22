// Form wording for the internal-control module, in one place. The names follow the school's own
// forms; if the official forms differ, change them here only. GROUPS keys are repeated in the
// SQL CHECK lists (supabase/control_01.sql), so changing a key is a schema change.

export type GroupKey = "finance" | "student" | "personnel" | "academic" | "general" | "royal";

export const GROUPS: readonly { key: GroupKey; label: string }[] = [
  { key: "finance", label: "กลุ่มบริหารการเงินและงบประมาณ" },
  { key: "student", label: "กลุ่มบริหารกิจการนักเรียน" },
  { key: "personnel", label: "กลุ่มบริหารงานบุคคล" },
  { key: "academic", label: "กลุ่มบริหารงานวิชาการ" },
  { key: "general", label: "กลุ่มบริหารทั่วไป" },
  { key: "royal", label: "กลุ่มบริหารศาสตร์พระราชา" },
];

/** F = financial, C = compliance (legal), O = operational. */
export const RISK_TYPES: readonly { key: "F" | "C" | "O"; label: string }[] = [
  { key: "F", label: "ด้านการเงิน" },
  { key: "C", label: "ด้านกฎหมาย" },
  { key: "O", label: "ด้านการดำเนินงาน" },
];

export type ActionStatus = "open" | "doing" | "done";

/** Status of an improvement measure; the keys are repeated in the SQL CHECK on control_actions.status. */
export const ACTION_STATUSES: readonly { key: ActionStatus; label: string }[] = [
  { key: "open", label: "ค้าง" },
  { key: "doing", label: "กำลังทำ" },
  { key: "done", label: "เสร็จ" },
];

/** The five steps of the CSA (control self-assessment) of one mission. */
export const CSA_STEPS: readonly { n: 1 | 2 | 3 | 4 | 5; label: string; hint: string }[] = [
  { n: 1, label: "วิเคราะห์ภารกิจและวัตถุประสงค์", hint: "ภารกิจนี้ต้องบรรลุอะไร ตามกฎหมาย แผนงาน หรือนโยบายของโรงเรียน" },
  { n: 2, label: "ขั้นตอนการปฏิบัติงานที่จำเป็น", hint: "ลำดับขั้นตอนที่ต้องทำให้ครบ เพื่อให้งานสำเร็จตามวัตถุประสงค์" },
  { n: 3, label: "วิเคราะห์การปฏิบัติจริงในปัจจุบัน", hint: "ตอนนี้ทำจริงอย่างไร ขั้นตอนไหนยังไม่ได้ทำหรือทำไม่ครบ" },
  { n: 4, label: "สรุปผลการประเมินและระบุความเสี่ยง", hint: "การควบคุมที่มีอยู่เพียงพอหรือไม่ และความเสี่ยงสำคัญที่ยังเหลืออยู่คืออะไร" },
  { n: 5, label: "การวิเคราะห์สาเหตุและแนวทางแก้ไข", hint: "ข้อบกพร่องเกิดจากอะไร และจะปรับปรุงการควบคุมอย่างไร" },
];

/** Column headers of the ปค.5 table, in order. */
export const PK5_COLUMNS: readonly string[] = [
  "ภารกิจตามกฎหมาย/แผนฯ / วัตถุประสงค์",
  "ความเสี่ยง",
  "การควบคุมภายในที่มีอยู่",
  "การประเมินผลการควบคุมภายใน",
  "ความเสี่ยงที่ยังมีอยู่",
  "การปรับปรุงการควบคุมภายใน",
  "หน่วยงานที่รับผิดชอบ/กำหนดเสร็จ",
];

// Plain-language descriptions of levels 1-5 (index 0 = level 1), shown next to the number pickers.
// Written for this app, not copied from the school's files: the school should review the wording.
export const LIKELIHOOD: readonly string[] = [
  "น้อยมาก (แทบไม่เคยเกิดขึ้น)",
  "น้อย (เกิดขึ้นนานๆ ครั้ง)",
  "ปานกลาง (เกิดขึ้นบ้างเป็นบางครั้ง)",
  "สูง (เกิดขึ้นบ่อย)",
  "สูงมาก (เกิดขึ้นเกือบทุกครั้ง หรือแทบแน่นอนว่าจะเกิด)",
];

export const IMPACT: readonly string[] = [
  "น้อยมาก (กระทบงานเล็กน้อย แก้ไขได้ทันที)",
  "น้อย (งานล่าช้าหรือต้องแก้ไขบ้าง แต่ไม่กระทบเป้าหมายของโครงการ)",
  "ปานกลาง (เป้าหมายบางส่วนไม่สำเร็จ หรือต้องใช้งบประมาณหรือเวลาเพิ่ม)",
  "สูง (เป้าหมายส่วนใหญ่ไม่สำเร็จ หรือเสียหายต่อทรัพย์สินหรือชื่อเสียงของโรงเรียน)",
  "สูงมาก (โครงการล้มเหลว ผิดกฎหมายหรือระเบียบ หรือกระทบความปลอดภัยของผู้เรียนและบุคลากร)",
];
