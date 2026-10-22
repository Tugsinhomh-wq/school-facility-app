import test from "node:test";
import assert from "node:assert/strict";
import {
  FISCAL_YEAR_MAX,
  FISCAL_YEAR_MIN,
  MAX_NAME,
  MAX_TEXT,
  cleanText,
  isUuid,
  parseActionForm,
  parseAssessmentForm,
  parseBudget,
  parseDue,
  parseFiscalYear,
  parseGroupKey,
  parseLevel,
  parseMissionForm,
  parseOwnerEmail,
  parseProjectForm,
  parseReviewForm,
  parseRiskType,
  parseScoreForm,
  parseStatus,
  parseText,
} from "./parse.ts";
import { CSA_FIELD, CSA_STEPS } from "./forms.ts";

// A Map stands in for FormData: both have get(name).
const form = (o: Record<string, string>) => new Map(Object.entries(o));
const UUID = "0b9f2c4e-3a1d-4e7b-9c55-1f2a3b4c5d6e";

function ok<T>(r: { ok: boolean; value?: T; message?: string }): T {
  assert.equal(r.ok, true, r.message);
  return r.value as T;
}
function bad(r: { ok: boolean; message?: string }): string {
  assert.equal(r.ok, false);
  return r.message as string;
}

test("cleanText: trims, turns CRLF and CR into LF and drops NUL; a non-string is empty", () => {
  assert.equal(cleanText("  สวัสดี  "), "สวัสดี");
  assert.equal(cleanText("บรรทัดหนึ่ง\r\nบรรทัดสอง\rบรรทัดสาม"), "บรรทัดหนึ่ง\nบรรทัดสอง\nบรรทัดสาม");
  assert.equal(cleanText("a\0b"), "ab");
  assert.equal(cleanText(null), "");
  assert.equal(cleanText(undefined), "");
  assert.equal(cleanText(42), "");
});

test("isUuid accepts a UUID and nothing else", () => {
  assert.equal(isUuid(UUID), true);
  assert.equal(isUuid(UUID.toUpperCase()), true);
  for (const v of ["", "abc", UUID + "0", ` ${UUID}`, "0b9f2c4e3a1d4e7b9c551f2a3b4c5d6e", null, undefined, 7]) {
    assert.equal(isUuid(v), false, String(v));
  }
});

test("parseText: required, trimmed, length-limited, with the field name in the message", () => {
  assert.equal(ok(parseText("  ชื่อ  ", "ชื่อโครงการ", MAX_NAME, true)), "ชื่อ");
  assert.match(bad(parseText("   ", "ชื่อโครงการ", MAX_NAME, true)), /ชื่อโครงการ/);
  assert.equal(ok(parseText("   ", "วัตถุประสงค์", MAX_TEXT, false)), "");
  assert.equal(ok(parseText("ก".repeat(MAX_NAME), "ชื่อโครงการ", MAX_NAME, true)).length, MAX_NAME);
  const msg = bad(parseText("ก".repeat(MAX_NAME + 1), "ชื่อโครงการ", MAX_NAME, true));
  assert.match(msg, /ชื่อโครงการ/);
  assert.match(msg, new RegExp(String(MAX_NAME)));
});

test("parseText: the limit counts the text as it will be stored (CRLF is one character)", () => {
  const stored = "ก\r\n".repeat(MAX_TEXT / 2 - 1) + "ก"; // MAX_TEXT - 1 characters once CRLF is LF
  assert.equal(ok(parseText(stored, "วัตถุประสงค์", MAX_TEXT, false)).length, MAX_TEXT - 1);
});

test("parseFiscalYear: a whole Buddhist-era year inside the sane range", () => {
  assert.equal(ok(parseFiscalYear("2569")), 2569);
  assert.equal(ok(parseFiscalYear(" 2569 ")), 2569);
  assert.equal(ok(parseFiscalYear(String(FISCAL_YEAR_MIN))), FISCAL_YEAR_MIN);
  assert.equal(ok(parseFiscalYear(String(FISCAL_YEAR_MAX))), FISCAL_YEAR_MAX);
  for (const v of [String(FISCAL_YEAR_MIN - 1), String(FISCAL_YEAR_MAX + 1), "2026", "", "abc", "25 69", "2569.5", "-2569", "NaN", "2569e0", "0x9C9"]) {
    assert.match(bad(parseFiscalYear(v)), /ปีงบประมาณ/, v);
  }
});

test("parseGroupKey: one of the six GROUPS keys", () => {
  for (const k of ["finance", "student", "personnel", "academic", "general", "royal"]) {
    assert.equal(ok(parseGroupKey(k)), k);
  }
  assert.equal(ok(parseGroupKey(" general ")), "general");
  for (const v of ["", "Finance", "other", "all", "กลุ่มบริหารทั่วไป"]) assert.match(bad(parseGroupKey(v)), /กลุ่มงาน/, v);
});

test("parseRiskType: empty is none, otherwise F, C or O", () => {
  assert.equal(ok(parseRiskType("")), null);
  assert.equal(ok(parseRiskType("  ")), null);
  for (const k of ["F", "C", "O"]) assert.equal(ok(parseRiskType(k)), k);
  for (const v of ["f", "X", "FC", "ด้านการเงิน"]) assert.match(bad(parseRiskType(v)), /ประเภทความเสี่ยง/, v);
});

test("parseBudget: empty is none, otherwise a non-negative amount with at most two decimals", () => {
  assert.equal(ok(parseBudget("")), null);
  assert.equal(ok(parseBudget("  ")), null);
  assert.equal(ok(parseBudget("0")), 0);
  assert.equal(ok(parseBudget("1200000")), 1200000);
  assert.equal(ok(parseBudget("1,200,000")), 1200000);
  assert.equal(ok(parseBudget("1,200,000.50")), 1200000.5);
  assert.equal(ok(parseBudget(" 15000.5 ")), 15000.5);
  assert.equal(ok(parseBudget("1000000000000")), 1e12);
  for (const v of ["-1", "abc", "1e5", "12,34", "1.234", "Infinity", "NaN", "0x10", "1 000", "10000000000000", ".5", "5."]) {
    assert.match(bad(parseBudget(v)), /งบประมาณ/, v);
  }
});

test("parseLevel: empty is none, otherwise a whole number 1-5", () => {
  assert.equal(ok(parseLevel("", "โอกาสเกิด")), null);
  for (const n of [1, 2, 3, 4, 5]) assert.equal(ok(parseLevel(String(n), "โอกาสเกิด")), n);
  for (const v of ["0", "6", "3.5", "-1", "x", "1e0", "03", "١"]) {
    assert.match(bad(parseLevel(v, "โอกาสเกิด")), /โอกาสเกิด/, v);
  }
});

test("parseStatus: open, doing or done", () => {
  for (const k of ["open", "doing", "done"]) assert.equal(ok(parseStatus(k)), k);
  for (const v of ["", "finished", "Open"]) assert.match(bad(parseStatus(v)), /สถานะ/, v);
});

test("parseDue: empty is none, otherwise a real calendar day in a sane year", () => {
  assert.equal(ok(parseDue("")), null);
  assert.equal(ok(parseDue("2026-10-01")), "2026-10-01");
  assert.equal(ok(parseDue(" 2027-02-28 ")), "2027-02-28");
  for (const v of ["2026-02-31", "2026-1-1", "01/10/2026", "0001-01-01", "9999-12-31", "abc", "2026-13-01"]) {
    assert.match(bad(parseDue(v)), /กำหนดเสร็จ/, v);
  }
});

test("parseOwnerEmail: empty is none, otherwise a lower-cased address", () => {
  assert.equal(ok(parseOwnerEmail("")), null);
  assert.equal(ok(parseOwnerEmail("  ")), null);
  assert.equal(ok(parseOwnerEmail(" Teacher.One@LRP.ac.th ")), "teacher.one@lrp.ac.th");
  for (const v of ["not-an-email", "a@b", "a b@c.d", "@lrp.ac.th", `${"a".repeat(250)}@lrp.ac.th`]) {
    assert.match(bad(parseOwnerEmail(v)), /อีเมล/, v);
  }
});

const FULL_PROJECT = {
  fiscal_year: "2569",
  group_key: "general",
  name: " โครงการตัวอย่าง ",
  budget: "50,000",
  objective: "วัตถุประสงค์",
  risk_issue: "ประเด็น",
  risk_cause: "สาเหตุ",
  risk_impact: "ผลกระทบ",
  risk_type: "O",
  existing_controls: "การควบคุมที่มี",
  assessment: "ผลการประเมิน",
  residual_risk: "ความเสี่ยงที่เหลือ",
};

test("parseProjectForm (create): every field is read, typed and trimmed", () => {
  assert.deepEqual(ok(parseProjectForm(form(FULL_PROJECT), "create")), {
    fiscal_year: 2569,
    group_key: "general",
    name: "โครงการตัวอย่าง",
    budget: 50000,
    objective: "วัตถุประสงค์",
    risk_issue: "ประเด็น",
    risk_cause: "สาเหตุ",
    risk_impact: "ผลกระทบ",
    risk_type: "O",
    existing_controls: "การควบคุมที่มี",
    assessment: "ผลการประเมิน",
    residual_risk: "ความเสี่ยงที่เหลือ",
  });
});

test("parseProjectForm (create): only year, group and name are required; missing text fields are left out", () => {
  assert.deepEqual(ok(parseProjectForm(form({ fiscal_year: "2569", group_key: "royal", name: "ก" }), "create")), {
    fiscal_year: 2569,
    group_key: "royal",
    name: "ก",
  });
  const msg = bad(parseProjectForm(form({}), "create"));
  assert.match(msg, /ปีงบประมาณ/);
  assert.match(msg, /กลุ่มงาน/);
  assert.match(msg, /ชื่อโครงการ/);
});

test("parseProjectForm: reports every bad field at once", () => {
  const msg = bad(
    parseProjectForm(
      form({ ...FULL_PROJECT, fiscal_year: "NaN", group_key: "x", budget: "-5", risk_type: "Z", objective: "ก".repeat(MAX_TEXT + 1) }),
      "create",
    ),
  );
  for (const part of ["ปีงบประมาณ", "กลุ่มงาน", "งบประมาณ", "ประเภทความเสี่ยง", "วัตถุประสงค์"]) assert.match(msg, new RegExp(part));
});

test("parseProjectForm (update): fields that are not in the form stay out of the patch", () => {
  assert.deepEqual(ok(parseProjectForm(form({ name: "ชื่อใหม่" }), "update")), { name: "ชื่อใหม่" });
  assert.deepEqual(ok(parseProjectForm(form({}), "update")), {});
});

test("parseProjectForm (update): a field that is in the form but empty is cleared; a name cannot be", () => {
  assert.deepEqual(ok(parseProjectForm(form({ budget: "", objective: "", risk_type: "" }), "update")), {
    budget: null,
    objective: "",
    risk_type: null,
  });
  assert.match(bad(parseProjectForm(form({ name: "  " }), "update")), /ชื่อโครงการ/);
});

test("parseProjectForm never lets the form set owner, mission, head scores, scores or confirmation", () => {
  const patch = ok(
    parseProjectForm(
      form({
        ...FULL_PROJECT,
        owner_id: UUID,
        mission_id: UUID,
        head_likelihood: "5",
        head_impact: "5",
        likelihood: "5",
        impact: "5",
        confirmed_at: "2026-01-01",
        confirmed_by: UUID,
        id: UUID,
      }),
      "create",
    ),
  ) as Record<string, unknown>;
  for (const k of ["owner_id", "mission_id", "head_likelihood", "head_impact", "likelihood", "impact", "confirmed_at", "confirmed_by", "id"]) {
    assert.equal(k in patch, false, k);
  }
});

test("parseProjectForm reads a real FormData too, and ignores a File in a text field", () => {
  const fd = new FormData();
  fd.set("fiscal_year", "2570");
  fd.set("group_key", "finance");
  fd.set("name", "จากฟอร์มจริง");
  fd.set("objective", new File(["x"], "x.txt"));
  assert.deepEqual(ok(parseProjectForm(fd, "create")), { fiscal_year: 2570, group_key: "finance", name: "จากฟอร์มจริง" });
});

test("parseScoreForm: both likelihood and impact must be whole numbers 1-5", () => {
  assert.deepEqual(ok(parseScoreForm(form({ likelihood: "4", impact: "5" }))), { likelihood: 4, impact: 5 });
  const incomplete: Record<string, string>[] = [
    { likelihood: "4" },
    { impact: "4" },
    {},
    { likelihood: "", impact: "" },
    { likelihood: "0", impact: "3" },
    { likelihood: "3", impact: "6" },
    { likelihood: "2.5", impact: "3" },
  ];
  for (const f of incomplete) assert.match(bad(parseScoreForm(form(f))), /1–5|1-5/, JSON.stringify(f));
});

test("parseReviewForm: nothing in the form changes nothing", () => {
  assert.deepEqual(ok(parseReviewForm(form({}))), {});
});

test("parseReviewForm: an empty head score clears that axis, a missing one leaves it", () => {
  assert.deepEqual(ok(parseReviewForm(form({ head_likelihood: "", head_impact: "2" }))), { head_likelihood: null, head_impact: 2 });
  assert.deepEqual(ok(parseReviewForm(form({ head_impact: "5" }))), { head_impact: 5 });
  assert.match(bad(parseReviewForm(form({ head_likelihood: "9" }))), /1–5|1-5/);
});

test("parseReviewForm: mission is empty (unlink), a UUID, or refused", () => {
  assert.deepEqual(ok(parseReviewForm(form({ mission_id: "" }))), { mission_id: null });
  assert.deepEqual(ok(parseReviewForm(form({ mission_id: UUID }))), { mission_id: UUID });
  assert.match(bad(parseReviewForm(form({ mission_id: "not-a-uuid" }))), /ภารกิจ/);
});

test("parseReviewForm: confirm is 1 (confirm), 0 (unconfirm) or left alone when empty", () => {
  assert.deepEqual(ok(parseReviewForm(form({ confirm: "1" }))), { confirm: true });
  assert.deepEqual(ok(parseReviewForm(form({ confirm: "0" }))), { confirm: false });
  assert.deepEqual(ok(parseReviewForm(form({ confirm: "" }))), {});
  assert.match(bad(parseReviewForm(form({ confirm: "yes" }))), /ยืนยัน/);
});

test("parseMissionForm: year, group and name are required to create; the five CSA steps are optional text", () => {
  const all = {
    fiscal_year: "2569",
    group_key: "academic",
    name: " ภารกิจตัวอย่าง ",
    objective: "ขั้น 1",
    procedures: "ขั้น 2",
    practice: "ขั้น 3",
    assessment: "ขั้น 4",
    improvement: "ขั้น 5",
  };
  assert.deepEqual(ok(parseMissionForm(form(all), "create")), { ...all, fiscal_year: 2569, name: "ภารกิจตัวอย่าง" });
  const msg = bad(parseMissionForm(form({}), "create"));
  for (const part of ["ปีงบประมาณ", "กลุ่มงาน", "ชื่อภารกิจ"]) assert.match(msg, new RegExp(part));
  assert.match(bad(parseMissionForm(form({ ...all, group_key: "nope", improvement: "ก".repeat(MAX_TEXT + 1) }), "create")), /กลุ่มงาน/);
});

test("CSA_FIELD: every CSA step has its own mission field, and parseMissionForm reads all five", () => {
  const fields = Object.fromEntries(CSA_STEPS.map((s) => [CSA_FIELD[s.n], `ขั้น ${s.n}`]));
  assert.equal(Object.keys(fields).length, 5);
  assert.deepEqual(ok(parseMissionForm(form(fields), "update")), fields);
});

test("parseMissionForm (update): only what is in the form is changed", () => {
  assert.deepEqual(ok(parseMissionForm(form({ practice: "ปรับแล้ว" }), "update")), { practice: "ปรับแล้ว" });
  assert.match(bad(parseMissionForm(form({ name: "" }), "update")), /ชื่อภารกิจ/);
});

test("parseActionForm: description is required to create; status, due and responsible are typed", () => {
  assert.deepEqual(
    ok(parseActionForm(form({ description: " ทำให้ครบ ", responsible: " ครูตัวอย่าง ", due: "2026-12-31", status: "doing" }), "create")),
    { description: "ทำให้ครบ", responsible: "ครูตัวอย่าง", due: "2026-12-31", status: "doing" },
  );
  assert.deepEqual(ok(parseActionForm(form({ description: "ก" }), "create")), { description: "ก" });
  assert.match(bad(parseActionForm(form({}), "create")), /มาตรการ/);
  assert.match(bad(parseActionForm(form({ description: "ก", status: "stuck", due: "31/12/2026", responsible: "ก".repeat(MAX_NAME + 1) }), "create")), /สถานะ/);
});

test("parseActionForm (update): empty due clears it, missing fields stay", () => {
  assert.deepEqual(ok(parseActionForm(form({ due: "" }), "update")), { due: null });
  assert.deepEqual(ok(parseActionForm(form({ status: "done" }), "update")), { status: "done" });
  assert.match(bad(parseActionForm(form({ description: " " }), "update")), /มาตรการ/);
});

// The whole ปค.4 form: year, group, 17 results and comments, 5 summaries.
const assessForm = (o: Record<string, string> = {}) => form({ fiscal_year: "2569", group_key: "general", ...o });

test("parseAssessmentForm: an empty form for a year and group gives all 17 principles and 5 summaries, unanswered", () => {
  const v = ok(parseAssessmentForm(assessForm()));
  assert.equal(v.fiscalYear, 2569);
  assert.equal(v.groupKey, "general");
  assert.deepEqual(Object.keys(v.principles), Array.from({ length: 17 }, (_, i) => String(i + 1)));
  assert.deepEqual(Object.keys(v.summaries), ["1", "2", "3", "4", "5"]);
  assert.deepEqual(v.principles["1"], { result: null, text: "" });
  assert.equal(v.summaries["5"], "");
});

test("parseAssessmentForm: results and comments are read per principle, text is trimmed and CRLF becomes LF", () => {
  const v = ok(
    parseAssessmentForm(
      assessForm({
        principle_1_result: "full",
        principle_1_text: "  มีคำสั่ง\r\nและประกาศ  ",
        principle_2_result: "partial",
        principle_17_result: " none ",
        principle_17_text: "ไม่มีหลักฐาน",
        principle_5_text: "ไม่เลือกผล",
        summary_1: "  ทำต่อ  ",
        summary_5: "ติดตาม\0ผล",
      }),
    ),
  );
  assert.deepEqual(v.principles["1"], { result: "full", text: "มีคำสั่ง\nและประกาศ" });
  assert.deepEqual(v.principles["2"], { result: "partial", text: "" });
  assert.deepEqual(v.principles["17"], { result: "none", text: "ไม่มีหลักฐาน" });
  assert.deepEqual(v.principles["5"], { result: null, text: "ไม่เลือกผล" });
  assert.equal(v.summaries["1"], "ทำต่อ");
  assert.equal(v.summaries["5"], "ติดตามผล");
});

test("parseAssessmentForm: year and group are checked like the project form's", () => {
  assert.match(bad(parseAssessmentForm(form({ group_key: "general" }))), /ปีงบประมาณ/);
  assert.match(bad(parseAssessmentForm(form({ fiscal_year: "2569", group_key: "nope" }))), /กลุ่มงาน/);
  assert.match(bad(parseAssessmentForm(form({ fiscal_year: "99999" }))), /ปีงบประมาณ.*กลุ่มงาน/);
});

test("parseAssessmentForm: a result other than full, partial, none or empty is refused with the principle's number", () => {
  assert.match(bad(parseAssessmentForm(assessForm({ principle_3_result: "FULL" }))), /ข้อ 3/);
  assert.match(bad(parseAssessmentForm(assessForm({ principle_17_result: "yes" }))), /ข้อ 17/);
});

test("parseAssessmentForm: a comment or summary over MAX_TEXT is refused, one of exactly MAX_TEXT is kept", () => {
  assert.match(bad(parseAssessmentForm(assessForm({ principle_4_text: "ก".repeat(MAX_TEXT + 1) }))), /ความเห็นข้อ 4.*2000/);
  assert.match(bad(parseAssessmentForm(assessForm({ summary_2: "ก".repeat(MAX_TEXT + 1) }))), /สรุปองค์ประกอบที่ 2.*2000/);
  const v = ok(parseAssessmentForm(assessForm({ principle_4_text: "ก".repeat(MAX_TEXT), summary_2: "ข".repeat(MAX_TEXT) })));
  assert.equal(v.principles["4"].text.length, MAX_TEXT);
  assert.equal(v.summaries["2"].length, MAX_TEXT);
});

test("parseAssessmentForm: reports every bad field at once", () => {
  const msg = bad(parseAssessmentForm(assessForm({ principle_1_result: "x", principle_2_result: "y", summary_1: "ก".repeat(MAX_TEXT + 1) })));
  assert.match(msg, /ข้อ 1.*ข้อ 2.*สรุปองค์ประกอบที่ 1/);
});

test("parseAssessmentForm: fields outside 1-17 and 1-5 are ignored, and so is a File in a text field", () => {
  const v = ok(
    parseAssessmentForm(
      assessForm({ principle_0_result: "full", principle_18_result: "bogus", principle_18_text: "นอกช่วง", summary_0: "นอก", summary_6: "นอก", other: "x" }),
    ),
  );
  assert.deepEqual(Object.keys(v.principles).length, 17);
  assert.deepEqual(Object.keys(v.summaries).length, 5);
  assert.deepEqual(Object.keys(v).sort(), ["fiscalYear", "groupKey", "principles", "summaries"]);
  const fd = new FormData();
  fd.set("fiscal_year", "2569");
  fd.set("group_key", "general");
  fd.set("principle_1_text", new File(["x"], "x.txt"));
  fd.set("principle_1_result", "full");
  const r = ok(parseAssessmentForm(fd));
  assert.deepEqual(r.principles["1"], { result: "full", text: "" });
});
