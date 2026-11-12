import test from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";

import { memoToPdf } from "./pdf.ts";
import type { MemoDoc } from "./model.ts";

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
