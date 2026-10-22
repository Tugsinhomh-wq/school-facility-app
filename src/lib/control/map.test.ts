import test from "node:test";
import assert from "node:assert/strict";
import { ASSESSMENT_SELECT, PROJECT_SELECT, emptyAssessment, toAction, toAssessment, toMission, toProject, type RawAction, type RawAssessment, type RawProject } from "./map.ts";

const raw = (over: Partial<RawProject> = {}): RawProject => ({
  id: "p1",
  fiscal_year: 2569,
  group_key: "general",
  name: "โครงการตัวอย่าง",
  budget: 25000,
  owner_id: "u1",
  mission_id: null,
  objective: "วัตถุประสงค์",
  risk_issue: "ประเด็น",
  risk_cause: "สาเหตุ",
  risk_impact: "ผลกระทบ",
  risk_type: "O",
  likelihood: 3,
  impact: 4,
  head_likelihood: null,
  head_impact: null,
  existing_controls: "ควบคุมที่มี",
  assessment: "ประเมิน",
  residual_risk: "ที่เหลือ",
  confirmed_at: null,
  owner: { full_name: "ครู ตัวอย่าง" },
  actions: [],
  ...over,
});

const act = (id: string, created_at: string, over: Partial<RawAction> = {}): RawAction => ({
  id,
  project_id: "p1",
  description: `มาตรการ ${id}`,
  responsible: "ผู้รับผิดชอบ",
  due: "2026-12-31",
  status: "open",
  created_at,
  ...over,
});

test("toProject: camelCase mapping of every column", () => {
  assert.deepEqual(toProject(raw()), {
    id: "p1",
    fiscalYear: 2569,
    groupKey: "general",
    name: "โครงการตัวอย่าง",
    budget: 25000,
    ownerId: "u1",
    ownerName: "ครู ตัวอย่าง",
    missionId: null,
    objective: "วัตถุประสงค์",
    riskIssue: "ประเด็น",
    riskCause: "สาเหตุ",
    riskImpact: "ผลกระทบ",
    riskType: "O",
    likelihood: 3,
    impact: 4,
    headLikelihood: null,
    headImpact: null,
    existingControls: "ควบคุมที่มี",
    assessment: "ประเมิน",
    residualRisk: "ที่เหลือ",
    confirmed: false,
    confirmedAt: null,
    score: 12,
    actions: [],
  });
});

test("toProject: score is the owner's L x I until the head overrides an axis", () => {
  assert.equal(toProject(raw()).score, 12);
  assert.equal(toProject(raw({ head_likelihood: 5 })).score, 20, "head likelihood with the owner's impact");
  assert.equal(toProject(raw({ head_impact: 2 })).score, 6, "head impact with the owner's likelihood");
  assert.equal(toProject(raw({ head_likelihood: 1, head_impact: 1 })).score, 1);
});

test("toProject: score is null until both axes have a value", () => {
  assert.equal(toProject(raw({ likelihood: null })).score, null);
  assert.equal(toProject(raw({ impact: null })).score, null);
  assert.equal(toProject(raw({ likelihood: null, impact: null })).score, null);
  // The head can complete an axis the owner left empty.
  assert.equal(toProject(raw({ likelihood: null, head_likelihood: 4 })).score, 16);
});

test("toProject: confirmed follows confirmed_at", () => {
  const p = toProject(raw({ confirmed_at: "2026-10-22T03:00:00+00:00" }));
  assert.equal(p.confirmed, true);
  assert.equal(p.confirmedAt, "2026-10-22T03:00:00+00:00");
});

test("toProject: budget may arrive as text (numeric column) or be missing", () => {
  assert.equal(toProject(raw({ budget: "1250000.50" })).budget, 1250000.5);
  assert.equal(toProject(raw({ budget: null })).budget, null);
  assert.equal(toProject(raw({ budget: "oops" })).budget, null);
});

test("toProject: the owner's name comes from the embed, as an object, a one-item array or missing", () => {
  assert.equal(toProject(raw({ owner: { full_name: "ก" } })).ownerName, "ก");
  assert.equal(toProject(raw({ owner: [{ full_name: "ข" }] })).ownerName, "ข");
  assert.equal(toProject(raw({ owner: null })).ownerName, "ไม่ทราบชื่อ");
  assert.equal(toProject(raw({ owner: [] })).ownerName, "ไม่ทราบชื่อ");
  assert.equal(toProject(raw({ owner: { full_name: "" } })).ownerName, "ไม่ทราบชื่อ");
});

test("toProject: actions are mapped without their database columns and kept in creation order", () => {
  const p = toProject(
    raw({
      actions: [
        act("b", "2026-10-02T00:00:00Z", { status: "done", due: null }),
        act("a", "2026-10-01T00:00:00Z"),
        act("c", "2026-10-02T00:00:00Z"),
      ],
    }),
  );
  assert.deepEqual(
    p.actions.map((a) => a.id),
    ["a", "b", "c"],
  );
  assert.deepEqual(p.actions[1], { id: "b", description: "มาตรการ b", responsible: "ผู้รับผิดชอบ", due: null, status: "done" });
  assert.deepEqual(Object.keys(toAction(act("x", "2026-10-01T00:00:00Z"))).sort(), ["description", "due", "id", "responsible", "status"]);
  assert.deepEqual(toProject(raw({ actions: null })).actions, []);
});

test("toMission: camelCase mapping of the five CSA steps", () => {
  assert.deepEqual(
    toMission({
      id: "m1",
      fiscal_year: 2570,
      group_key: "royal",
      name: "ภารกิจ",
      objective: "1",
      procedures: "2",
      practice: "3",
      assessment: "4",
      improvement: "5",
    }),
    { id: "m1", fiscalYear: 2570, groupKey: "royal", name: "ภารกิจ", objective: "1", procedures: "2", practice: "3", assessment: "4", improvement: "5" },
  );
});

test("PROJECT_SELECT names the owner's profile through owner_id (control_projects has two foreign keys to profiles)", () => {
  assert.match(PROJECT_SELECT, /owner:profiles!owner_id\(full_name\)/);
  assert.match(PROJECT_SELECT, /actions:control_actions\(/);
});

const rawAssessment = (items: unknown, over: Partial<RawAssessment> = {}): RawAssessment => ({
  fiscal_year: 2569,
  group_key: "general",
  items,
  updated_at: "2026-10-22T03:00:00+00:00",
  ...over,
});

test("emptyAssessment: principles 1-17 and summaries 1-5 are all present and empty", () => {
  const a = emptyAssessment(2570, "royal");
  assert.equal(a.fiscalYear, 2570);
  assert.equal(a.groupKey, "royal");
  assert.equal(a.updatedAt, null);
  assert.deepEqual(Object.keys(a.principles).map(Number), Array.from({ length: 17 }, (_, i) => i + 1));
  assert.deepEqual(Object.keys(a.summaries).map(Number), [1, 2, 3, 4, 5]);
  assert.deepEqual(a.principles[17], { result: null, text: "" });
  assert.equal(a.summaries[5], "");
});

test("toAssessment: reads the stored principles and summaries", () => {
  const a = toAssessment(
    rawAssessment({
      principles: { "1": { result: "full", text: "มีคำสั่ง" }, "17": { result: "none", text: "" }, "9": { result: "partial", text: "บางข้อ" } },
      summaries: { "1": "ทำต่อ", "5": "ติดตามผล" },
    }),
  );
  assert.deepEqual(a.principles[1], { result: "full", text: "มีคำสั่ง" });
  assert.deepEqual(a.principles[9], { result: "partial", text: "บางข้อ" });
  assert.deepEqual(a.principles[17], { result: "none", text: "" });
  assert.deepEqual(a.principles[2], { result: null, text: "" });
  assert.equal(a.summaries[1], "ทำต่อ");
  assert.equal(a.summaries[5], "ติดตามผล");
  assert.equal(a.summaries[3], "");
  assert.equal(a.updatedAt, "2026-10-22T03:00:00+00:00");
  assert.equal(a.fiscalYear, 2569);
  assert.equal(a.groupKey, "general");
});

test("toAssessment: items of any other shape give an empty assessment and never throw", () => {
  const empty = emptyAssessment(2569, "general");
  empty.updatedAt = "2026-10-22T03:00:00+00:00";
  for (const items of [null, undefined, [], [1, 2], "text", 42, true, {}, { principles: null, summaries: null }, { principles: [], summaries: "x" }, { principles: "x", summaries: 7 }]) {
    assert.deepEqual(toAssessment(rawAssessment(items)), empty, JSON.stringify(items));
  }
});

test("toAssessment: bad parts become empty, good parts beside them are kept", () => {
  const a = toAssessment(
    rawAssessment({
      principles: {
        "1": { result: "FULL", text: "ผิดตัวพิมพ์" }, // not one of the three keys
        "2": { result: "full", text: 42 }, // text of the wrong type
        "3": "full", // entry is not an object
        "4": null,
        "5": [],
        "6": { result: ["full"], text: ["x"] },
        "7": { result: "partial", text: "ดี" },
        "0": { result: "full", text: "นอกช่วง" },
        "18": { result: "full", text: "นอกช่วง" },
        "x": { result: "full", text: "ไม่ใช่เลข" },
        "1.5": { result: "full", text: "ทศนิยม" },
        "__proto__": { result: "full", text: "proto" },
      },
      summaries: { "1": 5, "2": null, "3": ["a"], "4": "ดี", "6": "นอกช่วง", "0": "นอกช่วง", "x": "ไม่ใช่เลข" },
    }),
  );
  assert.deepEqual(a.principles[1], { result: null, text: "ผิดตัวพิมพ์" });
  assert.deepEqual(a.principles[2], { result: "full", text: "" });
  for (const n of [3, 4, 5, 6]) assert.deepEqual(a.principles[n], { result: null, text: "" }, `principle ${n}`);
  assert.deepEqual(a.principles[7], { result: "partial", text: "ดี" });
  assert.deepEqual(Object.keys(a.principles).map(Number), Array.from({ length: 17 }, (_, i) => i + 1), "no out-of-range or unknown key is added");
  assert.deepEqual(Object.keys(a.summaries).map(Number), [1, 2, 3, 4, 5]);
  assert.deepEqual([a.summaries[1], a.summaries[2], a.summaries[3], a.summaries[4], a.summaries[5]], ["", "", "", "ดี", ""]);
});

test("toAssessment: updated_at that is not text is null", () => {
  assert.equal(toAssessment(rawAssessment({}, { updated_at: null })).updatedAt, null);
  assert.equal(toAssessment(rawAssessment({}, { updated_at: 5 as unknown as string })).updatedAt, null);
});

test("ASSESSMENT_SELECT lists the columns toAssessment reads", () => {
  assert.equal(ASSESSMENT_SELECT, "fiscal_year, group_key, items, updated_at");
});
