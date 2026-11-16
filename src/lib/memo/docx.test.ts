import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";

import { memoToDocx } from "./docx.ts";
import type { MemoDoc } from "./model.ts";
import type { MemoPhotoPages } from "./photo-files.ts";
import { makePng } from "./test-images.ts";

const doc: MemoDoc = {
  variant: "repair",
  agency: "โรงเรียนละหานทรายรัชดาภิเษก กลุ่มบริหารทั่วไป",
  refNo: "บท ........ / 2569",
  date: "12 พฤศจิกายน 2569",
  subject: "ขออนุมัติซ่อมแซมอาคารสถานที่ อาคาร 2 จำนวน 3 รายการ",
  recipient: "ผู้อำนวยการโรงเรียนละหานทรายรัชดาภิเษก",
  paragraphs: ["ด้วยงานอาคารสถานที่ได้รับแจ้งความชำรุดเสียหาย", "1. อาคาร 2 ห้อง 213: หลอดไฟขาด"],
  proposal: null,
  closing: "จึงเรียนมาเพื่อโปรดทราบ",
  signerName: "นายทดสอบ ระบบ",
  signerPosition: "ครูชำนาญการพิเศษ",
  decisionBlock: true,
};

async function xmlOf(d: MemoDoc) {
  const zip = await JSZip.loadAsync(await memoToDocx(d));
  return zip.file("word/document.xml")!.async("string");
}

test("body text is 14 pt (28 half-points) and only the title is larger", async () => {
  const sizes = new Set([...(await xmlOf(doc)).matchAll(/<w:sz w:val="(\d+)"/g)].map((m) => m[1]));
  assert.deepEqual([...sizes].sort(), ["28", "40"]);
});

test("only the title and the field labels are bold, never the body paragraphs", async () => {
  const xml = await xmlOf(doc);
  const text = (run: string) =>
    [...run.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((t) => t[1]).join("").replaceAll("\u200b", "");
  const boldTexts = xml
    .split("<w:r>")
    .slice(1)
    .filter((run) => run.includes("<w:b/>"))
    .map(text);
  const allowed = ["บันทึกข้อความ", "ส่วนราชการ", "ที่", "วันที่", "เรื่อง", "เรียน"];
  for (const t of boldTexts) assert.ok(allowed.some((a) => t === a) || t.startsWith("ความเห็นของ") || t.startsWith("คำสั่งการ"), `unexpected bold text: ${t}`);
  assert.ok(boldTexts.includes("บันทึกข้อความ"));
});

test("no zero-width spaces: they show as boxes with formatting marks on and can hang past the right margin", async () => {
  assert.equal((await xmlOf(doc)).includes("​"), false);
});

test("the Word package has no folder entries, which some phone and cloud viewers refuse to open", async () => {
  const zip = await JSZip.loadAsync(await memoToDocx(doc));
  const folders = Object.values(zip.files).filter((f) => f.dir).map((f) => f.name);
  assert.deepEqual(folders, []);
});

test('the reporter signature line reads "ลงชื่อ ... ผู้รายงาน" without brackets around ลงชื่อ', async () => {
  const text = (await xmlOf(doc)).replace(/<[^>]+>/g, "");
  assert.equal(text.includes("(ลงชื่อ)"), false);
  assert.ok(text.includes("ลงชื่อ ...................... ผู้รายงาน"));
});

const mediaCount = (zip: JSZip) => zip.file(/^word\/media\//).length;
const text = (xml: string) => xml.replace(/<[^>]+>/g, "");
const pngs = (n: number, w = 400, h = 300): MemoPhotoPages["groups"][number]["photos"] =>
  // Different sizes on purpose: docx-js stores byte-identical pictures once.
  Array.from({ length: n }, (_, i) => ({ data: makePng(w + i, h), width: w + i, height: h, type: "png" as const }));

test("without photos the Word file only has the garuda picture", async () => {
  const zip = await JSZip.loadAsync(await memoToDocx(doc));
  assert.equal(mediaCount(zip), 1);
  assert.equal(text(await zip.file("word/document.xml")!.async("string")).includes("เอกสารแนบ"), false);
});

test("photos are added as pictures behind the memo with their caption", async () => {
  const zip = await JSZip.loadAsync(await memoToDocx(doc, { groups: [{ heading: "อาคาร 2 ห้อง 213 – หลอดไฟขาด", photos: pngs(3) }], omitted: 0 }));
  assert.equal(mediaCount(zip), 4);
  const xml = await zip.file("word/document.xml")!.async("string");
  assert.ok(text(xml).includes("เอกสารแนบ: ภาพประกอบการแจ้งซ่อม"));
  assert.ok(text(xml).includes("อาคาร 2 ห้อง 213 – หลอดไฟขาด"));
  assert.ok(xml.includes("<w:cantSplit"), "rows must not split across pages");
});

test("a photo that failed to load becomes a note, not a picture", async () => {
  const zip = await JSZip.loadAsync(await memoToDocx(doc, { groups: [{ heading: "", photos: [{ failed: true }, ...pngs(1)] }], omitted: 0 }));
  assert.equal(mediaCount(zip), 2);
  assert.ok(text(await zip.file("word/document.xml")!.async("string")).includes("ไม่สามารถโหลดรูปนี้ได้"));
});

test("photos left out past the limit are announced", async () => {
  const zip = await JSZip.loadAsync(await memoToDocx(doc, { groups: [{ heading: "", photos: pngs(1) }], omitted: 5 }));
  assert.ok(text(await zip.file("word/document.xml")!.async("string")).includes("แสดงรูปไม่ครบ ข้ามอีก 5 รูป"));
});

test("a very long and a very wide photo stay inside the 7.6 x 8.5 cm box", async () => {
  const zip = await JSZip.loadAsync(await memoToDocx(doc, { groups: [{ heading: "", photos: [{ data: makePng(20, 2000), width: 20, height: 2000, type: "png" }, { data: makePng(2000, 20), width: 2000, height: 20, type: "png" }] }], omitted: 0 }));
  const xml = await zip.file("word/document.xml")!.async("string");
  const extents = [...xml.matchAll(/<wp:extent cx="(\d+)" cy="(\d+)"/g)].map((m) => [Number(m[1]), Number(m[2])]).slice(1); // skip the garuda
  assert.equal(extents.length, 2);
  for (const [cx, cy] of extents) {
    assert.ok(cx <= 7.6 * 360000 + 1000 && cy <= 8.5 * 360000 + 1000, `extent ${cx} x ${cy} EMU`);
  }
});
