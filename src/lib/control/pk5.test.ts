import test from "node:test";
import assert from "node:assert/strict";
import { CSA_TITLE, CSA_TITLE_LINES, PK5_TITLE, SCHOOL_NAME, SIGNATURE_LINES, csaBlocks, csaHeading, pk5Heading, pk5Rows } from "./pk5.ts";
import { toProject, type RawAction, type RawProject } from "./map.ts";
import { CSA_STEPS } from "./forms.ts";
import type { ControlMission } from "./types.ts";

// Projects go through the real mapper, so the score each test relies on is the one the pages see.
const CONFIRMED = "2026-01-15T03:00:00Z";

const raw = (over: Partial<RawProject> = {}): RawProject => ({
  id: "p1",
  fiscal_year: 2569,
  group_key: "general",
  name: "โครงการตัวอย่าง",
  budget: null,
  owner_id: "u1",
  mission_id: null,
  objective: "วัตถุประสงค์ตัวอย่าง",
  risk_issue: "ประเด็นความเสี่ยง",
  risk_cause: "สาเหตุ",
  risk_impact: "ผลกระทบ",
  risk_type: "O",
  likelihood: 4,
  impact: 4,
  head_likelihood: null,
  head_impact: null,
  existing_controls: "การควบคุมที่มี",
  assessment: "ผลการประเมิน",
  residual_risk: "ความเสี่ยงที่เหลือ",
  confirmed_at: CONFIRMED,
  owner: { full_name: "ครู ตัวอย่าง" },
  actions: [],
  ...over,
});

const act = (n: number, over: Partial<RawAction> = {}): RawAction => ({
  id: `a${n}`,
  project_id: "p1",
  description: `มาตรการ ${n}`,
  responsible: `ผู้รับผิดชอบ ${n}`,
  due: "2026-12-31",
  status: "open",
  created_at: `2026-01-0${n}T00:00:00Z`,
  ...over,
});

const project = (over: Partial<RawProject> = {}) => toProject(raw(over));

test("pk5Rows: only confirmed projects scoring 9 or more get a row", () => {
  const rows = pk5Rows([
    project({ id: "unconfirmed", confirmed_at: null }), // 16 but not confirmed
    project({ id: "eight", likelihood: 2, impact: 4 }), // 8
    project({ id: "unscored", likelihood: null, impact: 4 }),
    project({ id: "out-of-range", likelihood: 6, impact: 5 }), // 6 is not a level, so unscored
    project({ id: "nine", likelihood: 3, impact: 3 }),
  ]);
  assert.deepEqual(rows.map((r) => r.projectId), ["nine"]);
  assert.equal(rows[0].score, 9);
});

test("pk5Rows: highest score first, then by name", () => {
  const rows = pk5Rows([
    project({ id: "a", name: "ข", likelihood: 3, impact: 3 }), // 9
    project({ id: "b", name: "ก", likelihood: 4, impact: 4 }), // 16
    project({ id: "c", name: "ค", likelihood: 3, impact: 4 }), // 12
    project({ id: "d", name: "ก", likelihood: 3, impact: 3 }), // 9, same score as "a", earlier name
  ]);
  assert.deepEqual(
    rows.map((r) => [r.projectId, r.score]),
    [["b", 16], ["c", 12], ["d", 9], ["a", 9]],
  );
  assert.deepEqual(pk5Rows([]), []);
});

test("pk5Rows: the seven cells follow the columns of the form; cell 1 is the project name, then its objective", () => {
  const [row] = pk5Rows([project()]);
  assert.equal(row.cells.length, 7);
  assert.deepEqual(row.cells.slice(0, 5), ["โครงการตัวอย่าง\nวัตถุประสงค์: วัตถุประสงค์ตัวอย่าง", "ประเด็นความเสี่ยง", "การควบคุมที่มี", "ผลการประเมิน", "ความเสี่ยงที่เหลือ"]);
});

test("pk5Rows: an empty column is '-' and a project without measures still gets its row", () => {
  const [row] = pk5Rows([
    project({ objective: "", risk_issue: "  \n ", existing_controls: "", assessment: "", residual_risk: "", actions: [] }),
  ]);
  // With no objective, cell 1 is the project's name alone; every other empty cell is a dash.
  assert.deepEqual(row.cells, ["โครงการตัวอย่าง", "-", "-", "-", "-", "-", "-"]);
});

test("pk5Rows: two measures are numbered, with who does them and by when", () => {
  const [row] = pk5Rows([project({ actions: [act(1), act(2, { due: "2027-03-05" })] })]);
  assert.equal(row.cells[5], "1. มาตรการ 1\n2. มาตรการ 2");
  // Cell 7 is numbered like cell 6; the date's spaces are non-breaking so it never wraps mid-date.
  assert.equal(
    row.cells[6],
    "1. ผู้รับผิดชอบ 1 / กำหนดเสร็จ 31\u00a0ธ.ค.\u00a02569\n2. ผู้รับผิดชอบ 2 / กำหนดเสร็จ 5\u00a0มี.ค.\u00a02570",
  );
});

test("pk5Rows: a measure missing its person or date shows dashes and keeps its place", () => {
  const [row] = pk5Rows([
    project({ actions: [act(1, { responsible: "", due: null }), act(2, { description: "  " }), act(3, { due: "2026-02-31" })] }),
  ]);
  assert.equal(row.cells[5], "1. มาตรการ 1\n2. -\n3. มาตรการ 3");
  assert.equal(
    row.cells[6],
    "1. - / กำหนดเสร็จ -\n2. ผู้รับผิดชอบ 2 / กำหนดเสร็จ 31\u00a0ธ.ค.\u00a02569\n3. ผู้รับผิดชอบ 3 / กำหนดเสร็จ -",
  );
});

test("pk5Rows: the head's likelihood and impact decide, not the owner's", () => {
  const rows = pk5Rows([
    project({ id: "raised", likelihood: 2, impact: 2, head_likelihood: 4, head_impact: 4 }), // owner 4, head 16
    project({ id: "lowered", likelihood: 4, impact: 4, head_likelihood: 2, head_impact: 2 }), // owner 16, head 4
    project({ id: "one-axis", likelihood: 4, impact: 4, head_likelihood: 1 }), // 1 x 4
  ]);
  assert.deepEqual(rows.map((r) => [r.projectId, r.score]), [["raised", 16]]);
});

test("pk5Heading: school, report name, the period ending 30 September, and the group", () => {
  assert.deepEqual(pk5Heading({ fiscalYear: 2569, groupLabel: "กลุ่มบริหารทั่วไป" }), [
    SCHOOL_NAME,
    PK5_TITLE,
    "สำหรับระยะเวลาการดำเนินงานสิ้นสุด วันที่ 30 เดือน กันยายน พ.ศ. 2569",
    "กลุ่มบริหารทั่วไป",
  ]);
  assert.equal(SCHOOL_NAME, "โรงเรียนละหานทรายรัชดาภิเษก");
  assert.equal(PK5_TITLE, "รายงานการประเมินผลการควบคุมภายใน");
});

test("the signature is left blank for the reporter to fill in", () => {
  assert.deepEqual(SIGNATURE_LINES, [
    "ลงชื่อ ................ ผู้รายงาน",
    "ตำแหน่ง ................",
    "วันที่ ........ เดือน ........ พ.ศ. ........",
  ]);
});

const mission = (over: Partial<ControlMission> = {}): ControlMission => ({
  id: "m1",
  fiscalYear: 2569,
  groupKey: "general",
  name: "ภารกิจตัวอย่าง",
  objective: "ขั้น 1",
  procedures: "ขั้น 2",
  practice: "ขั้น 3",
  assessment: "ขั้น 4",
  improvement: "ขั้น 5",
  ...over,
});

test("csaBlocks: five steps in order with the form's own labels, '-' for a step left empty", () => {
  const [block] = csaBlocks([mission({ practice: "  ", improvement: "บรรทัดแรก\nบรรทัดสอง" })]);
  assert.equal(block.missionName, "ภารกิจตัวอย่าง");
  assert.deepEqual(
    block.steps.map((s) => [s.n, s.label, s.text]),
    [
      [1, CSA_STEPS[0].label, "ขั้น 1"],
      [2, CSA_STEPS[1].label, "ขั้น 2"],
      [3, CSA_STEPS[2].label, "-"],
      [4, CSA_STEPS[3].label, "ขั้น 4"],
      [5, CSA_STEPS[4].label, "บรรทัดแรก\nบรรทัดสอง"],
    ],
  );
  assert.deepEqual(csaBlocks([]), []);
  assert.equal(csaBlocks([mission({ name: " " })])[0].missionName, "-");
});

test("csaHeading: school, the CSA title on two lines, the group and the year", () => {
  assert.deepEqual(csaHeading({ fiscalYear: 2570, groupLabel: "กลุ่มบริหารงานบุคคล" }), [
    SCHOOL_NAME,
    "แบบประเมินการควบคุมด้วยตนเอง",
    "(Control Self Assessment: CSA)",
    "กลุ่มบริหารงานบุคคล",
    "ปีงบประมาณ พ.ศ. 2570",
  ]);
  assert.deepEqual(CSA_TITLE_LINES, ["แบบประเมินการควบคุมด้วยตนเอง", "(Control Self Assessment: CSA)"]);
  assert.equal(CSA_TITLE, "แบบประเมินการควบคุมด้วยตนเอง (Control Self Assessment: CSA)");
});
