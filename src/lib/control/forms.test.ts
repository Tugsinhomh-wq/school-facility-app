import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTION_STATUSES,
  ASSESS_RESULTS,
  COMPONENT_COUNT,
  CSA_STEPS,
  GROUPS,
  IMPACT,
  LIKELIHOOD,
  PK4_COLUMNS,
  PK4_COMPONENTS,
  PK5_COLUMNS,
  PRINCIPLE_COUNT,
  RISK_TYPES,
  SUMMARY_LABEL,
} from "./forms.ts";

// The SQL CHECK lists in supabase/control_01.sql repeat these values, so a change here is a schema change.
test("GROUPS: six fixed groups with the keys the database uses", () => {
  assert.deepEqual(
    GROUPS.map((g) => g.key),
    ["finance", "student", "personnel", "academic", "general", "royal"],
  );
  assert.deepEqual(
    GROUPS.map((g) => g.label),
    [
      "กลุ่มบริหารการเงินและงบประมาณ",
      "กลุ่มบริหารกิจการนักเรียน",
      "กลุ่มบริหารงานบุคคล",
      "กลุ่มบริหารงานวิชาการ",
      "กลุ่มบริหารทั่วไป",
      "กลุ่มบริหารศาสตร์พระราชา",
    ],
  );
});

test("RISK_TYPES: F, C and O", () => {
  assert.deepEqual(
    RISK_TYPES.map((t) => [t.key, t.label]),
    [
      ["F", "ด้านการเงิน"],
      ["C", "ด้านกฎหมาย"],
      ["O", "ด้านการดำเนินงาน"],
    ],
  );
});

test("CSA_STEPS: five steps numbered 1-5 with a label and a hint each", () => {
  assert.deepEqual(
    CSA_STEPS.map((s) => s.n),
    [1, 2, 3, 4, 5],
  );
  assert.deepEqual(
    CSA_STEPS.map((s) => s.label),
    [
      "วิเคราะห์ภารกิจและวัตถุประสงค์",
      "ขั้นตอนการปฏิบัติงานที่จำเป็น",
      "วิเคราะห์การปฏิบัติจริงในปัจจุบัน",
      "สรุปผลการประเมินและระบุความเสี่ยง",
      "การวิเคราะห์สาเหตุและแนวทางแก้ไข",
    ],
  );
  for (const s of CSA_STEPS) assert.ok(s.hint.trim().length > 0, `step ${s.n} hint`);
});

test("PK5_COLUMNS: the seven headers of the ปค.5 table", () => {
  assert.deepEqual(PK5_COLUMNS, [
    "ภารกิจตามกฎหมาย/แผนฯ / วัตถุประสงค์",
    "ความเสี่ยง",
    "การควบคุมภายในที่มีอยู่",
    "การประเมินผลการควบคุมภายใน",
    "ความเสี่ยงที่ยังมีอยู่",
    "การปรับปรุงการควบคุมภายใน",
    "หน่วยงานที่รับผิดชอบ/กำหนดเสร็จ",
  ]);
});

test("LIKELIHOOD and IMPACT: a description for each level 1-5", () => {
  for (const levels of [LIKELIHOOD, IMPACT]) {
    assert.equal(levels.length, 5);
    for (const text of levels) assert.ok(text.trim().length > 0);
    assert.equal(new Set(levels).size, 5);
  }
});

// The SQL CHECK on control_actions.status repeats these keys.
test("ACTION_STATUSES: open, doing and done with a Thai label each", () => {
  assert.deepEqual(
    ACTION_STATUSES.map((s) => [s.key, s.label]),
    [
      ["open", "ค้าง"],
      ["doing", "กำลังทำ"],
      ["done", "เสร็จ"],
    ],
  );
});

// The keys are stored in control_assessments.items; the labels are the short forms the school's file prints in brackets.
test("ASSESS_RESULTS: full, partial and none with the short Thai labels", () => {
  assert.deepEqual(
    ASSESS_RESULTS.map((r) => [r.key, r.label]),
    [
      ["full", "ปฏิบัติครบ"],
      ["partial", "บางส่วน"],
      ["none", "ไม่พบ"],
    ],
  );
});

test("PK4_COMPONENTS: five components, principles 1-17 in order, split 1-5 / 6-9 / 10-12 / 13-15 / 16-17", () => {
  assert.deepEqual(
    PK4_COMPONENTS.map((c) => c.n),
    [1, 2, 3, 4, 5],
  );
  assert.deepEqual(
    PK4_COMPONENTS.map((c) => c.label),
    ["สภาพแวดล้อมการควบคุม", "การประเมินความเสี่ยง", "กิจกรรมการควบคุม", "สารสนเทศและการสื่อสาร", "กิจกรรมการติดตามผล"],
  );
  assert.deepEqual(
    PK4_COMPONENTS.map((c) => [c.principles[0].n, c.principles[c.principles.length - 1].n]),
    [[1, 5], [6, 9], [10, 12], [13, 15], [16, 17]],
  );
  const all = PK4_COMPONENTS.flatMap((c) => c.principles);
  assert.deepEqual(
    all.map((p) => p.n),
    Array.from({ length: 17 }, (_, i) => i + 1),
  );
  for (const p of all) assert.ok(p.text.trim().length > 0, `principle ${p.n}`);
  assert.equal(new Set(all.map((p) => p.text)).size, 17);
  assert.equal(COMPONENT_COUNT, 5);
  assert.equal(PRINCIPLE_COUNT, 17);
});

test("PK4_COMPONENTS: Thai sara am is the single character, never nikhahit + sara aa", () => {
  const text = PK4_COMPONENTS.flatMap((c) => [c.label, ...c.principles.map((p) => p.text)]).join("");
  assert.equal(text.includes("\u0e4d\u0e32"), false);
  assert.ok(text.includes("\u0e33"));
});

test("PK4_COLUMNS and SUMMARY_LABEL: the wording of the ปค.4 table", () => {
  assert.deepEqual(PK4_COLUMNS, ["จุดที่ควรประเมิน", "ความเห็น/คำอธิบาย"]);
  assert.equal(SUMMARY_LABEL, "สรุป/วิธีการที่ควรปฏิบัติ");
});
