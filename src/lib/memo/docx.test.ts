import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";

import { memoToDocx } from "./docx.ts";
import type { MemoDoc } from "./model.ts";

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
  assert.deepEqual([...sizes].sort(), ["28", "48"]);
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
