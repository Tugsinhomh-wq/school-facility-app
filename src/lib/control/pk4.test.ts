import test from "node:test";
import assert from "node:assert/strict";
import { PK4_TITLE, PK4_WIDTHS, pk4Counts, pk4Heading, pk4Rows } from "./pk4.ts";
import { SCHOOL_NAME } from "./pk5.ts";
import { emptyAssessment } from "./map.ts";
import { PK4_COMPONENTS, SUMMARY_LABEL } from "./forms.ts";

test("pk4Heading: school, title, year-end line and group", () => {
  assert.equal(PK4_TITLE, "รายงานการประเมินองค์ประกอบของการควบคุมภายใน");
  assert.deepEqual(pk4Heading({ fiscalYear: 2569, groupLabel: "กลุ่มบริหารทั่วไป" }), [
    SCHOOL_NAME,
    PK4_TITLE,
    "สำหรับระยะเวลาการดำเนินงานสิ้นสุด วันที่ 30 เดือน กันยายน พ.ศ. 2569",
    "กลุ่มบริหารทั่วไป",
  ]);
});

test("PK4_WIDTHS: two columns that add up to 100", () => {
  assert.equal(PK4_WIDTHS.length, 2);
  assert.equal(PK4_WIDTHS[0] + PK4_WIDTHS[1], 100);
});

test("pk4Rows: an empty assessment has 5 component rows, 17 principle rows and 5 summary rows in order, all with dashes", () => {
  const rows = pk4Rows(emptyAssessment(2569, "general"));
  assert.equal(rows.length, 5 + 17 + 5);
  assert.deepEqual(
    rows.map((r) => r.kind),
    PK4_COMPONENTS.flatMap((c) => ["component", ...c.principles.map(() => "principle"), "summary"]),
  );
  assert.deepEqual(rows.filter((r) => r.kind === "component").map((r) => r.left), [
    "องค์ประกอบที่ 1 สภาพแวดล้อมการควบคุม",
    "องค์ประกอบที่ 2 การประเมินความเสี่ยง",
    "องค์ประกอบที่ 3 กิจกรรมการควบคุม",
    "องค์ประกอบที่ 4 สารสนเทศและการสื่อสาร",
    "องค์ประกอบที่ 5 กิจกรรมการติดตามผล",
  ]);
  const principles = rows.filter((r) => r.kind === "principle");
  assert.deepEqual(principles.map((r) => r.n), Array.from({ length: 17 }, (_, i) => i + 1));
  assert.equal(principles[0].left, `1) ${PK4_COMPONENTS[0].principles[0].text}`);
  for (const r of principles) assert.equal(r.right, "-");
  for (const r of rows.filter((x) => x.kind === "summary")) {
    assert.equal(r.left, "");
    assert.equal(r.right, `${SUMMARY_LABEL}\n-`);
  }
});

test("pk4Rows: the comment ends with the result in brackets; a result alone and a comment alone both work", () => {
  const a = emptyAssessment(2569, "general");
  a.principles[1] = { result: "full", text: "มีคำสั่งโรงเรียน" };
  a.principles[2] = { result: "partial", text: "  ทำบางส่วน\nขาดหลักฐาน  " };
  a.principles[3] = { result: "none", text: "" };
  a.principles[4] = { result: null, text: "มีแต่ความเห็น" };
  const right = pk4Rows(a).filter((r) => r.kind === "principle").map((r) => r.right);
  assert.deepEqual(right.slice(0, 5), ["มีคำสั่งโรงเรียน (ปฏิบัติครบ)", "ทำบางส่วน\nขาดหลักฐาน (บางส่วน)", "(ไม่พบ)", "มีแต่ความเห็น", "-"]);
});

test("pk4Rows: the typed summary follows the label; the summary row is the last row of its component", () => {
  const a = emptyAssessment(2569, "general");
  a.summaries[2] = "  ควรจัดทำแผนความเสี่ยง\nทุกปี ";
  const rows = pk4Rows(a);
  const summaries = rows.filter((r) => r.kind === "summary");
  assert.equal(summaries[1].right, `${SUMMARY_LABEL}\nควรจัดทำแผนความเสี่ยง\nทุกปี`);
  assert.equal(summaries[0].right, `${SUMMARY_LABEL}\n-`);
  assert.equal(rows[rows.indexOf(summaries[1]) + 1].kind, "component");
  assert.equal(rows[rows.length - 1].kind, "summary");
});

test("pk4Counts: how many principles are at each result; total is always 17", () => {
  assert.deepEqual(pk4Counts(emptyAssessment(2569, "general")), { full: 0, partial: 0, none: 0, unanswered: 17, total: 17 });
  const a = emptyAssessment(2569, "general");
  for (const n of [1, 2, 3]) a.principles[n].result = "full";
  a.principles[4].result = "partial";
  a.principles[17].result = "none";
  a.principles[5].text = "ความเห็นโดยไม่เลือกผล";
  assert.deepEqual(pk4Counts(a), { full: 3, partial: 1, none: 1, unanswered: 12, total: 17 });
});
