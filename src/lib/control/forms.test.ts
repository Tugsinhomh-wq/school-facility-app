import test from "node:test";
import assert from "node:assert/strict";
import { ACTION_STATUSES, CSA_STEPS, GROUPS, IMPACT, LIKELIHOOD, PK5_COLUMNS, RISK_TYPES } from "./forms.ts";

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
