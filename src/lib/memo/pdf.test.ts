import test from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";

import { memoToPdf } from "./pdf.ts";
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
  paragraphs: ["ด้วยงานอาคารสถานที่ได้รับแจ้งความชำรุดเสียหาย", "1. อาคาร 2 ห้อง 213: หลอดไฟขาด เลขที่งาน REQ-202611-0012 แจ้งเมื่อ 12 พฤศจิกายน 2569"],
  proposal: null,
  closing: "จึงเรียนมาเพื่อโปรดทราบ",
  signerName: "นายทดสอบ ระบบ",
  signerPosition: "ครูชำนาญการพิเศษ",
  decisionBlock: true,
};

/** Every font size the PDF sets (the "NN Tf" operators), read out of its compressed content streams. */
function fontSizes(pdf: Buffer): Set<number> {
  const sizes = new Set<number>();
  const text = pdf.toString("latin1");
  for (const m of text.matchAll(/stream\r?\n/g)) {
    const start = m.index! + m[0].length;
    const end = text.indexOf("endstream", start);
    let content: string;
    try {
      content = inflateSync(pdf.subarray(start, end)).toString("latin1");
    } catch {
      continue; // fonts and images are not text streams
    }
    for (const t of content.matchAll(/\s([\d.]+) Tf/g)) sizes.add(Number(t[1]));
  }
  return sizes;
}

test("the PDF body text is 14 pt, not 15", async () => {
  const sizes = fontSizes(await memoToPdf(doc));
  assert.ok(sizes.has(14), `sizes used: ${[...sizes].join(", ")}`);
  assert.equal(sizes.has(15), false, `sizes used: ${[...sizes].join(", ")}`);
});

const pageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type \/Page(?![s\w])/g) ?? []).length;
const photosOf = (heading: string, count: number, w = 400, h = 300): MemoPhotoPages => ({
  groups: [{ heading, photos: Array.from({ length: count }, () => ({ data: makePng(w, h), width: w, height: h, type: "png" as const })) }],
  omitted: 0,
});

test("without photos the PDF is the same length as before", async () => {
  const plain = pageCount(await memoToPdf(doc));
  assert.equal(pageCount(await memoToPdf(doc, { groups: [], omitted: 0 })), plain);
});

test("four photos add one attachment page", async () => {
  const plain = pageCount(await memoToPdf(doc));
  assert.equal(pageCount(await memoToPdf(doc, photosOf("อาคาร 2 ห้อง 213 – หลอดไฟขาด", 4))), plain + 1);
});

test("a photo that failed to load still gives a PDF with the attachment page", async () => {
  const plain = pageCount(await memoToPdf(doc));
  const pages = await memoToPdf(doc, { groups: [{ heading: "", photos: [{ failed: true }] }], omitted: 0 });
  assert.equal(pageCount(pages), plain + 1);
});

test("twelve tall photos need more than one attachment page", async () => {
  const plain = pageCount(await memoToPdf(doc));
  assert.ok(pageCount(await memoToPdf(doc, photosOf("", 12, 300, 400))) >= plain + 2);
});

test("a very long and a very wide photo are drawn without error", async () => {
  const pdf = await memoToPdf(doc, {
    groups: [{ heading: "x", photos: [{ data: makePng(20, 2000), width: 20, height: 2000, type: "png" }, { data: makePng(2000, 20), width: 2000, height: 20, type: "png" }] }],
    omitted: 3,
  });
  assert.ok(pdf.length > 1000);
});
