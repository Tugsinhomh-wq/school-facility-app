import test from "node:test";
import assert from "node:assert/strict";
import {
  PK1_ADDRESSEE,
  PK1_SIGNATURE_LINES,
  PK1_TITLE_LINES,
  pk1Heading,
  pk1ImproveLabel,
  pk1Improvements,
  pk1Paragraphs,
  pk1RiskLabel,
  pk1Sections,
} from "./pk1.ts";
import { SCHOOL_NAME, pk5Rows } from "./pk5.ts";
import { toProject, type RawAction, type RawProject } from "./map.ts";
import { GROUPS } from "./forms.ts";

// Projects go through the real mapper, so the score each test relies on is the one the pages see.
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
  confirmed_at: "2026-01-15T03:00:00Z",
  owner: { full_name: "ครู ตัวอย่าง" },
  actions: [],
  ...over,
});

const act = (n: number, over: Partial<RawAction> = {}): RawAction => ({
  id: `a${n}`,
  project_id: "p1",
  description: `มาตรการ ${n}`,
  responsible: "ผู้รับผิดชอบ",
  due: "2026-12-31",
  status: "open",
  created_at: `2026-01-0${n}T00:00:00Z`,
  ...over,
});

const project = (over: Partial<RawProject> = {}) => toProject(raw(over));

test("the fixed wording: titles, addressee and the three paragraphs with the school and the year filled in", () => {
  assert.deepEqual(PK1_TITLE_LINES, ["แบบ ปค.1", "หนังสือรับรองการประเมินผลการควบคุมภายใน"]);
  assert.deepEqual(pk1Heading(2569), [...PK1_TITLE_LINES, "สำหรับระยะเวลาการดำเนินงานสิ้นสุด วันที่ 30 เดือน กันยายน พ.ศ. 2569"]);
  assert.equal(PK1_ADDRESSEE, "เรียน ผู้อำนวยการสำนักงานเขตพื้นที่การศึกษามัธยมศึกษาบุรีรัมย์");
  const [p1, p2, p3] = pk1Paragraphs(2569);
  assert.ok(p1.startsWith(`${SCHOOL_NAME} ได้ประเมินผลการควบคุมภายในของหน่วยงานสำหรับปีสิ้นสุดวันที่ 30 เดือน กันยายน พ.ศ. 2569 ด้วยวิธีการที่โรงเรียนกำหนด`));
  assert.ok(p1.endsWith("ที่เกี่ยวข้องกับการดำเนินงาน"));
  assert.ok(p2.startsWith(`จากผลการประเมินดังกล่าว ${SCHOOL_NAME} เห็นว่า`));
  assert.ok(p2.endsWith("ภายใต้การกำกับดูแลของผู้อำนวยการสำนักงานเขตพื้นที่การศึกษามัธยมศึกษาบุรีรัมย์"));
  assert.equal(p3, "อย่างไรก็ดี มีความเสี่ยงและได้กำหนดปรับปรุงการควบคุมภายใน ในปีงบประมาณถัดไป สรุปได้ ดังนี้");
  assert.ok(pk1Paragraphs(2570)[0].includes("พ.ศ.\u00a02570"));
  // Every "พ.ศ." in the three paragraphs is joined to its year by a no-break space, so a line never splits the year.
  const all = pk1Paragraphs(2569).join(" ");
  assert.equal(all.match(/พ\.ศ\./g)?.length, 3);
  assert.equal(all.match(/พ\.ศ\.\u00a0\d{4}/g)?.length, 3);
});

test("PK1_SIGNATURE_LINES: blanks to fill in by hand, an empty name line, the director's position and no name", () => {
  assert.deepEqual(PK1_SIGNATURE_LINES, [
    "ลายมือชื่อ ................ ผู้รายงาน",
    "(................................)",
    `ตำแหน่ง ผู้อำนวยการ${SCHOOL_NAME}`,
    "วันที่ ........ เดือน ........ พ.ศ. ........",
  ]);
});

test("pk1Sections: always the six groups in GROUPS order; groups without projects have no items", () => {
  const sections = pk1Sections([]);
  assert.deepEqual(sections.map((s) => s.groupLabel), GROUPS.map((g) => g.label));
  for (const s of sections) assert.deepEqual(s.items, []);
});

test("pk1Sections: lists exactly the ปค.5 projects, per group, numbered from 1 per group in ปค.5 order", () => {
  const projects = [
    project({ id: "unconfirmed", group_key: "finance", confirmed_at: null }),
    project({ id: "low", group_key: "finance", likelihood: 2, impact: 4 }), // 8
    project({ id: "f1", group_key: "finance", name: "การเงิน ก", likelihood: 3, impact: 3 }), // 9
    project({ id: "f2", group_key: "finance", name: "การเงิน ข", likelihood: 5, impact: 5 }), // 25
    project({ id: "g1", group_key: "general", name: "ทั่วไป" }),
  ];
  const sections = pk1Sections(projects);
  const byLabel = (key: string) => sections[GROUPS.findIndex((g) => g.key === key)];
  assert.deepEqual(byLabel("finance").items.map((i) => [i.n, i.title]), [
    [1, "งาน/กิจกรรม การเงิน ข วัตถุประสงค์ วัตถุประสงค์ตัวอย่าง"],
    [2, "งาน/กิจกรรม การเงิน ก วัตถุประสงค์ วัตถุประสงค์ตัวอย่าง"],
  ]);
  assert.deepEqual(byLabel("general").items.map((i) => i.n), [1]);
  assert.equal(sections.flatMap((s) => s.items).length, pk5Rows(projects).length, "the same projects as ปค.5");
});

test("pk1Sections: title has the objective when there is one, the risk is the remaining risk, improvements keep their order", () => {
  const [item] = pk1Sections([project({ actions: [act(2), act(1)] })])[4].items;
  assert.equal(item.title, "งาน/กิจกรรม โครงการตัวอย่าง วัตถุประสงค์ วัตถุประสงค์ตัวอย่าง");
  assert.equal(item.risk, "ความเสี่ยงที่เหลือ");
  assert.deepEqual(item.improvements, ["มาตรการ 1", "มาตรการ 2"]);
});

test("pk1Sections: nothing typed gives dashes, and the title is the name alone", () => {
  const [item] = pk1Sections([project({ objective: "  ", residual_risk: "", actions: [] })])[4].items;
  assert.equal(item.title, "งาน/กิจกรรม โครงการตัวอย่าง");
  assert.equal(item.risk, "-");
  assert.deepEqual(item.improvements, ["-"]);
  assert.deepEqual(pk1Sections([project({ actions: [act(1, { description: " " })] })])[4].items[0].improvements, ["-"]);
});

test("labels and improvements: n.1 and n.2, numbered '1) ...' only when there is more than one", () => {
  assert.equal(pk1RiskLabel(3), "3.1 ความเสี่ยงที่มีอยู่ที่ต้องกำหนดปรับปรุงการควบคุมภายใน");
  assert.equal(pk1ImproveLabel(3), "3.2 การปรับปรุงการควบคุมภายใน");
  const item = { n: 1, title: "t", risk: "r" };
  assert.deepEqual(pk1Improvements({ ...item, improvements: ["เดียว"] }), ["เดียว"]);
  assert.deepEqual(pk1Improvements({ ...item, improvements: ["ก", "ข"] }), ["1) ก", "2) ข"]);
  assert.deepEqual(pk1Improvements({ ...item, improvements: ["-"] }), ["-"]);
});
