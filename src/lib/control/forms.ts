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

/** The mission column (and form field) that holds each CSA step; the SQL comments on control_missions say the same. */
export const CSA_FIELD = { 1: "objective", 2: "procedures", 3: "practice", 4: "assessment", 5: "improvement" } as const;

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

/** Result of one principle in the ปค.4 assessment; the keys are stored in control_assessments.items. */
export type AssessResult = "full" | "partial" | "none";

/** The labels are the short forms the school's file prints in brackets after a comment, e.g. "(บางส่วน)". */
export const ASSESS_RESULTS: readonly { key: AssessResult; label: string }[] = [
  { key: "full", label: "ปฏิบัติครบ" },
  { key: "partial", label: "บางส่วน" },
  { key: "none", label: "ไม่พบ" },
];

/** Column headers of the ปค.4 table, in order. */
export const PK4_COLUMNS: readonly string[] = ["จุดที่ควรประเมิน", "ความเห็น/คำอธิบาย"];

/** The line that opens the typed summary after each component. */
export const SUMMARY_LABEL = "สรุป/วิธีการที่ควรปฏิบัติ";

/**
 * The five components of internal control and their 17 principles (public wording of the Ministry of
 * Finance standard, as in the school's file), numbered 1-17 across components.
 */
export const PK4_COMPONENTS: readonly { n: 1 | 2 | 3 | 4 | 5; label: string; principles: readonly { n: number; text: string }[] }[] = [
  {
    n: 1,
    label: "สภาพแวดล้อมการควบคุม",
    principles: [
      { n: 1, text: "หน่วยงานแสดงให้เห็นถึงการยึดมั่นในคุณค่าของความซื่อตรงและจริยธรรม" },
      { n: 2, text: "ผู้กำกับดูแลของหน่วยงานแสดงให้เห็นถึงความเป็นอิสระจากฝ่ายบริหารและมีหน้าที่กำกับดูแลให้มีการพัฒนาหรือปรับปรุงการควบคุมภายใน รวมถึงการดำเนินการเกี่ยวกับการควบคุมภายใน" },
      { n: 3, text: "หัวหน้าหน่วยงานจัดให้มีโครงสร้างองค์กร สายการบังคับบัญชา อำนาจหน้าที่และความรับผิดชอบที่เหมาะสมในการบรรลุวัตถุประสงค์ของหน่วยงานภายใต้การกำกับดูแลของผู้กำกับดูแล" },
      { n: 4, text: "หน่วยงานแสดงให้เห็นถึงความมุ่งมั่นในการสร้างแรงจูงใจ พัฒนาและรักษาบุคลากรที่มีความรู้ความสามารถที่สอดคล้องกับวัตถุประสงค์ของหน่วยงาน" },
      { n: 5, text: "หน่วยงานของรัฐกำหนดให้บุคลากรมีหน้าที่และความรับผิดชอบต่อผลการปฏิบัติงานตามระบบการควบคุมภายใน เพื่อให้บรรลุวัตถุประสงค์ของหน่วยงาน" },
    ],
  },
  {
    n: 2,
    label: "การประเมินความเสี่ยง",
    principles: [
      { n: 6, text: "หน่วยงานระบุวัตถุประสงค์การควบคุมภายในของการปฏิบัติงานให้สอดคล้องกับวัตถุประสงค์ขององค์กรไว้อย่างชัดเจนและเพียงพอที่จะสามารถระบุและประเมินความเสี่ยงที่เกี่ยวข้องกับวัตถุประสงค์" },
      { n: 7, text: "หน่วยงานระบุความเสี่ยงที่มีผลต่อการบรรลุวัตถุประสงค์การควบคุมภายในอย่างครอบคลุมทั้งหน่วยงาน และวิเคราะห์ความเสี่ยง เพื่อกำหนดวิธีการจัดการความเสี่ยงนั้น" },
      { n: 8, text: "หน่วยงานพิจารณาโอกาสที่อาจเกิดการทุจริต เพื่อประกอบการประเมินความเสี่ยงที่ส่งผลต่อการบรรลุวัตถุประสงค์" },
      { n: 9, text: "หน่วยงานระบุและประเมินการเปลี่ยนแปลงที่อาจมีผลกระทบอย่างมีนัยสำคัญต่อระบบการควบคุมภายใน" },
    ],
  },
  {
    n: 3,
    label: "กิจกรรมการควบคุม",
    principles: [
      { n: 10, text: "หน่วยงานระบุและพัฒนากิจกรรมการควบคุม เพื่อลดความเสี่ยงในการบรรลุวัตถุประสงค์ให้อยู่ในระดับที่ยอมรับได้" },
      { n: 11, text: "หน่วยงานระบุและพัฒนากิจกรรมการควบคุมทั่วไปด้านเทคโนโลยีเพื่อสนับสนุนการบรรลุวัตถุประสงค์" },
      { n: 12, text: "หน่วยงานจัดให้มีกิจกรรมการควบคุม โดยกำหนดไว้ในนโยบาย ประกอบด้วยผลสำเร็จที่คาดหวังและขั้นตอนการปฏิบัติงาน เพื่อนำนโยบายไปสู่การปฏิบัติจริง" },
    ],
  },
  {
    n: 4,
    label: "สารสนเทศและการสื่อสาร",
    principles: [
      { n: 13, text: "หน่วยงานจัดทำหรือจัดหาและใช้สารสนเทศที่เกี่ยวข้องและมีคุณภาพ เพื่อสนับสนุนให้มีการปฏิบัติตามการควบคุมภายในที่กำหนด" },
      { n: 14, text: "หน่วยงานมีการสื่อสารภายในเกี่ยวกับสารสนเทศ รวมถึงวัตถุประสงค์และความรับผิดชอบที่มีต่อการควบคุมภายใน ซึ่งมีความจำเป็นในการสนับสนุนให้มีการปฏิบัติตามการควบคุมภายในที่กำหนด" },
      { n: 15, text: "หน่วยงานมีการสื่อสารกับบุคคลภายนอกเกี่ยวกับเรื่องที่มีผลกระทบต่อการปฏิบัติตามการควบคุมภายในที่กำหนด" },
    ],
  },
  {
    n: 5,
    label: "กิจกรรมการติดตามผล",
    principles: [
      { n: 16, text: "หน่วยงานระบุ พัฒนา และดำเนินการประเมินผลระหว่างการปฏิบัติงานและหรือเป็นรายครั้งตามที่กำหนด เพื่อให้เกิดความมั่นใจว่าได้มีการปฏิบัติตามองค์ประกอบของการควบคุมภายใน" },
      { n: 17, text: "หน่วยงานประเมินผลและสื่อสารข้อบกพร่องหรือจุดอ่อนของการควบคุมภายในอย่างทันเวลาต่อฝ่ายบริหารและผู้กำกับดูแล เพื่อให้ผู้รับผิดชอบสามารถสั่งการแก้ไขได้อย่างเหมาะสม" },
    ],
  },
];

export const COMPONENT_COUNT = PK4_COMPONENTS.length;
export const PRINCIPLE_COUNT = PK4_COMPONENTS.reduce((sum, c) => sum + c.principles.length, 0);
