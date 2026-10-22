import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { csaToDocx, pk1ToDocx, pk4ToDocx, pk5ToDocx } from "./docx.ts";
import { CSA_TITLE_LINES, PK5_TITLE, SCHOOL_NAME, SIGNATURE_LINES, type Pk5Row } from "./pk5.ts";
import { CSA_STEPS, GROUPS, PK4_COLUMNS, PK4_COMPONENTS, PK5_COLUMNS, SUMMARY_LABEL } from "./forms.ts";
import { DIRECTOR_SIGNATURE_LINES, PK1_ADDRESSEE, PK1_EMPTY, PK1_TITLE_LINES, pk1Heading, pk1ImproveLabel, pk1Paragraphs, pk1RiskLabel, type Pk1Section } from "./pk1.ts";
import { PK4_TITLE } from "./pk4.ts";
import { emptyAssessment } from "./map.ts";
import type { ControlMission } from "./types.ts";

const META = { fiscalYear: 2569, groupLabel: "กลุ่มบริหารทั่วไป" };

async function documentXml(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const file = zip.file("word/document.xml");
  assert.ok(file, "word/document.xml is in the package");
  return file.async("string");
}

const decode = (s: string) =>
  s.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&amp;", "&");

/** The text of every paragraph, without the invisible break hints Word needs for Thai. */
function paragraphs(xml: string): string[] {
  return xml
    .split("</w:p>")
    .map((p) => decode([...p.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("")).replaceAll("\u200b", ""))
    .filter((t) => t !== "");
}

const isZip = (buf: Buffer) => buf[0] === 0x50 && buf[1] === 0x4b; // "PK"

const row = (cells: Pk5Row["cells"]): Pk5Row => ({ projectId: "p1", score: 16, cells });

const longThai = "ระบบควบคุมการใช้จ่ายงบประมาณของโครงการยังไม่มีการตรวจสอบซ้ำโดยผู้ที่ไม่ได้เป็นผู้ปฏิบัติงานโดยตรง ".repeat(8);

test("pk5ToDocx: no rows still gives a Word file with the heading, the seven column titles and the signature", async () => {
  const buf = await pk5ToDocx([], META);
  assert.ok(Buffer.isBuffer(buf));
  assert.ok(isZip(buf), "starts with PK");
  const xml = await documentXml(buf);
  const text = paragraphs(xml);
  assert.deepEqual(text.slice(0, 4), [SCHOOL_NAME, PK5_TITLE, "สำหรับระยะเวลาการดำเนินงานสิ้นสุด วันที่ 30 เดือน กันยายน พ.ศ. 2569", "กลุ่มบริหารทั่วไป"]);
  assert.deepEqual(text.slice(4, 4 + PK5_COLUMNS.length), [...PK5_COLUMNS]);
  assert.deepEqual(text.slice(-SIGNATURE_LINES.length), [...SIGNATURE_LINES]);
  assert.equal(xml.match(/<w:tr[ >]/g)?.length, 1, "only the header row");
  assert.equal(xml.match(/<w:tc>/g)?.length, 7);
});

test("pk5ToDocx: A4 landscape, TH Sarabun New 16 pt, and the header row repeats on every page", async () => {
  const xml = await documentXml(await pk5ToDocx([row(["ก", "ข", "ค", "ง", "จ", "ฉ", "ช"])], META));
  const pgSz = xml.match(/<w:pgSz[^>]*>/)?.[0] ?? "";
  assert.match(pgSz, /w:orient="landscape"/);
  assert.match(pgSz, /w:w="16838"/);
  assert.match(pgSz, /w:h="11906"/);
  assert.match(xml, /<w:tblHeader/);
  assert.match(xml, /w:ascii="TH Sarabun New"/);
  assert.match(xml, /w:cs="TH Sarabun New"/);
  assert.match(xml, /<w:sz w:val="32"\/>/);
});

test("pk5ToDocx: long Thai text with line breaks lands in its own cell, one paragraph per line", async () => {
  const buf = await pk5ToDocx(
    [row([longThai, "ประเด็นแรก\nประเด็นที่สอง", "-", "ผลประเมิน", "-", "1. ทำข้อแรก\n2. ทำข้อสอง", "ผู้รับผิดชอบ / กำหนดเสร็จ 31 ธ.ค. 2569"])],
    META,
  );
  assert.ok(isZip(buf));
  const xml = await documentXml(buf);
  assert.equal(xml.match(/<w:tr[ >]/g)?.length, 2, "header row and one project");
  assert.equal(xml.match(/<w:tc>/g)?.length, 14);
  const text = paragraphs(xml);
  assert.ok(text.includes(longThai), "the long text is whole, apart from the hidden break hints");
  for (const line of ["ประเด็นแรก", "ประเด็นที่สอง", "1. ทำข้อแรก", "2. ทำข้อสอง", "ผู้รับผิดชอบ / กำหนดเสร็จ 31 ธ.ค. 2569"]) {
    assert.ok(text.includes(line), `paragraph "${line}"`);
  }
  // Word does not know where Thai lines may break: the hidden break hints are what lets it fill the line.
  assert.ok(xml.includes("\u200b"));
});

test("pk5ToDocx: text that is not valid in Word's XML is cleaned instead of corrupting the file", async () => {
  const xml = await documentXml(await pk5ToDocx([row(["a & b < c > d\u0001\u000b\u001f", "-", "-", "-", "-", "-", "-"])], META));
  assert.equal(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(xml), false);
  assert.ok(paragraphs(xml).includes("a & b < c > d"));
});

test("the documents carry no name: the signature lines are the only place for a person", async () => {
  const xml = await documentXml(await pk5ToDocx([], META));
  const text = paragraphs(xml).join("\n");
  assert.ok(text.includes("ลงชื่อ ................ ผู้รายงาน"));
  assert.equal(text.includes("ผู้อำนวยการ"), false);
  assert.equal(text.includes("รองผู้อำนวยการ"), false);
});

const mission = (over: Partial<ControlMission> = {}): ControlMission => ({
  id: "m1",
  fiscalYear: 2569,
  groupKey: "general",
  name: "ภารกิจตัวอย่าง",
  objective: "ขั้น 1",
  procedures: "ขั้น 2\nขั้น 2 ต่อ",
  practice: "",
  assessment: "ขั้น 4",
  improvement: "ขั้น 5",
  ...over,
});

test("csaToDocx: no missions does not throw and still gives a portrait A4 file with the heading", async () => {
  const buf = await csaToDocx([], META);
  assert.ok(isZip(buf));
  const xml = await documentXml(buf);
  assert.deepEqual(paragraphs(xml), [SCHOOL_NAME, ...CSA_TITLE_LINES, "กลุ่มบริหารทั่วไป", "ปีงบประมาณ พ.ศ. 2569"]);
  const pgSz = xml.match(/<w:pgSz[^>]*>/)?.[0] ?? "";
  assert.doesNotMatch(pgSz, /landscape/);
  assert.match(pgSz, /w:w="11906"/);
  assert.match(pgSz, /w:h="16838"/);
});

test("csaToDocx: each mission gets the title, group, its name and the five steps; the next one starts a new page", async () => {
  const xml = await documentXml(await csaToDocx([mission(), mission({ id: "m2", name: "ภารกิจที่สอง", objective: "" })], META));
  const text = paragraphs(xml);
  for (const line of CSA_TITLE_LINES) assert.equal(text.filter((t) => t === line).length, 2, line);
  assert.equal(text.filter((t) => t === "กลุ่มบริหารทั่วไป").length, 2);
  assert.ok(text.some((t) => t.includes("ภารกิจตัวอย่าง")));
  assert.ok(text.some((t) => t.includes("ภารกิจที่สอง")));
  for (const s of CSA_STEPS) assert.equal(text.filter((t) => t === `${s.n}. ${s.label}`).length, 2, `step ${s.n}`);
  assert.ok(text.includes("ขั้น 2") && text.includes("ขั้น 2 ต่อ"), "a step's lines are separate paragraphs");
  // Step 3 is empty in both missions, step 1 in the second.
  assert.equal(text.filter((t) => t === "-").length, 3);
  assert.equal(xml.match(/<w:pageBreakBefore/g)?.length, 1, "only between missions, not before the first");
  assert.doesNotMatch(xml, /landscape/);
});

const emptySections = (): Pk1Section[] => GROUPS.map((g) => ({ groupLabel: g.label, items: [] }));

test("pk1ToDocx: no items still gives portrait A4 with the fixed text, all six groups saying 'none to report' and the signature", async () => {
  const buf = await pk1ToDocx(emptySections(), { fiscalYear: 2569 });
  assert.ok(isZip(buf));
  const xml = await documentXml(buf);
  const text = paragraphs(xml);
  assert.deepEqual(text.slice(0, 3), pk1Heading(2569));
  assert.deepEqual(text.slice(0, 2), [...PK1_TITLE_LINES]);
  assert.equal(text[3], PK1_ADDRESSEE);
  assert.deepEqual(text.slice(4, 7), pk1Paragraphs(2569));
  for (const g of GROUPS) assert.ok(text.includes(g.label), g.label);
  assert.equal(text.filter((t) => t === PK1_EMPTY).length, 6);
  assert.deepEqual(text.slice(-DIRECTOR_SIGNATURE_LINES.length), [...DIRECTOR_SIGNATURE_LINES]);
  const pgSz = xml.match(/<w:pgSz[^>]*>/)?.[0] ?? "";
  assert.doesNotMatch(pgSz, /landscape/);
  assert.match(pgSz, /w:w="11906"/);
  assert.match(pgSz, /w:h="16838"/);
  assert.match(xml, /<w:jc w:val="both"\/>/, "the fixed paragraphs are justified");
  assert.equal(xml.includes("<w:tbl>"), false);
});

test("pk1ToDocx: an item prints its title, the two labelled lines, and its improvements one paragraph each", async () => {
  const sections = emptySections();
  sections[4].items = [
    { n: 1, title: "งาน/กิจกรรม ก วัตถุประสงค์ ข\nต่อบรรทัด", risk: "ความเสี่ยงที่เหลือ", improvements: ["ทำข้อแรก", "ทำข้อสอง"] },
    { n: 2, title: "งาน/กิจกรรม ค", risk: "-", improvements: ["-"] },
  ];
  const text = paragraphs(await documentXml(await pk1ToDocx(sections, { fiscalYear: 2569 })));
  for (const t of [
    "1. งาน/กิจกรรม ก วัตถุประสงค์ ข",
    "ต่อบรรทัด",
    pk1RiskLabel(1),
    "ความเสี่ยงที่เหลือ",
    pk1ImproveLabel(1),
    "1) ทำข้อแรก",
    "2) ทำข้อสอง",
    "2. งาน/กิจกรรม ค",
    pk1RiskLabel(2),
    pk1ImproveLabel(2),
  ]) {
    assert.ok(text.includes(t), t);
  }
  assert.equal(text.filter((t) => t === PK1_EMPTY).length, 5, "only the five groups without items");
  // Under the group's heading, in order.
  const i = text.indexOf(GROUPS[4].label);
  assert.equal(text[i + 1], "1. งาน/กิจกรรม ก วัตถุประสงค์ ข");
});

test("pk1ToDocx: text that is not valid in Word's XML is cleaned", async () => {
  const sections = emptySections();
  sections[0].items = [{ n: 1, title: "a & b\u0001", risk: "x < y\u000b", improvements: ["ok\u001f"] }];
  const xml = await documentXml(await pk1ToDocx(sections, { fiscalYear: 2569 }));
  assert.equal(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(xml), false);
  assert.ok(paragraphs(xml).includes("1. a & b"));
});

test("pk4ToDocx: an empty assessment gives portrait A4, the heading, a two-column table and the signature", async () => {
  const buf = await pk4ToDocx(emptyAssessment(2569, "general"), META);
  assert.ok(isZip(buf));
  const xml = await documentXml(buf);
  const text = paragraphs(xml);
  assert.deepEqual(text.slice(0, 4), [SCHOOL_NAME, PK4_TITLE, "สำหรับระยะเวลาการดำเนินงานสิ้นสุด วันที่ 30 เดือน กันยายน พ.ศ. 2569", "กลุ่มบริหารทั่วไป"]);
  assert.deepEqual(text.slice(4, 6), [...PK4_COLUMNS]);
  assert.deepEqual(text.slice(-DIRECTOR_SIGNATURE_LINES.length), [...DIRECTOR_SIGNATURE_LINES]);
  const pgSz = xml.match(/<w:pgSz[^>]*>/)?.[0] ?? "";
  assert.doesNotMatch(pgSz, /landscape/);
  assert.match(pgSz, /w:w="11906"/);
  assert.match(pgSz, /w:h="16838"/);
  assert.equal(xml.match(/<w:gridCol /g)?.length, 2, "two columns");
  // Header row + 5 x (component row + principle rows + summary row).
  assert.equal(xml.match(/<w:tr[ >]/g)?.length, 1 + 5 + 17 + 5);
  assert.equal(xml.match(/<w:gridSpan w:val="2"\/>/g)?.length, 5, "a component row spans both columns");
  for (const c of PK4_COMPONENTS) assert.ok(text.includes(`องค์ประกอบที่ ${c.n} ${c.label}`), c.label);
  assert.equal(text.filter((t) => t === SUMMARY_LABEL).length, 5);
});

test("pk4ToDocx: the header row repeats on every page and no row is kept whole (LibreOffice drops rows that are both)", async () => {
  const xml = await documentXml(await pk4ToDocx(emptyAssessment(2569, "general"), META));
  assert.equal(xml.match(/<w:tblHeader/g)?.length, 1);
  assert.doesNotMatch(xml, /<w:cantSplit/);
  assert.match(xml, /w:ascii="TH Sarabun New"/);
  assert.match(xml, /<w:sz w:val="32"\/>/);
});

test("pk4ToDocx: typed comments, results and summaries land in the table; a 1000-character comment survives whole", async () => {
  const a = emptyAssessment(2569, "general");
  const long = longThai.repeat(2).slice(0, 1000);
  a.principles[1] = { result: "full", text: long };
  a.principles[2] = { result: "partial", text: "บรรทัดแรก\nบรรทัดสอง" };
  a.principles[17] = { result: "none", text: "" };
  a.summaries[3] = "ควรทำแผน\nให้ครบ";
  const xml = await documentXml(await pk4ToDocx(a, META));
  const text = paragraphs(xml);
  assert.ok(text.includes(`${long} (ปฏิบัติครบ)`), "the long comment and its result are whole");
  assert.ok(text.includes("บรรทัดแรก") && text.includes("บรรทัดสอง (บางส่วน)"), "lines are separate paragraphs, the result ends the last");
  assert.ok(text.includes("(ไม่พบ)"));
  assert.ok(text.includes("ควรทำแผน") && text.includes("ให้ครบ"));
  assert.ok(text.includes(`1) ${PK4_COMPONENTS[0].principles[0].text}`));
  assert.ok(xml.includes("\u200b"), "Thai break hints are in");
});

test("pk4ToDocx: text that is not valid in Word's XML is cleaned instead of corrupting the file", async () => {
  const a = emptyAssessment(2569, "general");
  a.principles[1] = { result: null, text: "a & b < c > d\u0001\u000b\u001f" };
  const xml = await documentXml(await pk4ToDocx(a, META));
  assert.equal(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(xml), false);
  assert.ok(paragraphs(xml).includes("a & b < c > d"));
});
