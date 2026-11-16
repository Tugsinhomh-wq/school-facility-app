import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import JSZip from "jszip";

import { memoToDocxPython } from "./docx-python.ts";
import type { MemoDoc } from "./model.ts";
import type { MemoPhotoPages } from "./photo-files.ts";
import { makePng } from "./test-images.ts";

const hasPythonDocx = spawnSync(process.env.PYTHON_BIN || "python3", ["-c", "import docx"]).status === 0;
const opts = { skip: hasPythonDocx ? false : "python-docx is not installed" };

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

const png = (i: number, w = 400, h = 300) => ({ data: makePng(w + i, h), width: w + i, height: h, type: "png" as const });
const text = (xml: string) => xml.replace(/<[^>]+>/g, "");
const open = async (photos?: MemoPhotoPages) => {
  const zip = await JSZip.loadAsync(await memoToDocxPython(doc, photos));
  return { zip, xml: await zip.file("word/document.xml")!.async("string"), media: zip.file(/^word\/media\//).length };
};

test("without photos the python-docx file only has the garuda picture", opts, async () => {
  const { media, xml } = await open();
  assert.equal(media, 1);
  assert.equal(text(xml).includes("เอกสารแนบ"), false);
});

test("python-docx adds the photos behind the memo with their caption, rows that do not split", opts, async () => {
  const { media, xml } = await open({ groups: [{ heading: "อาคาร 2 ห้อง 213 – หลอดไฟขาด", photos: [png(0), png(1), png(2)] }], omitted: 0 });
  assert.equal(media, 4);
  assert.ok(text(xml).includes("เอกสารแนบ: ภาพประกอบการแจ้งซ่อม"));
  assert.ok(text(xml).includes("อาคาร 2 ห้อง 213 – หลอดไฟขาด"));
  assert.ok(xml.includes("<w:cantSplit"));
  assert.ok(xml.includes("<w:pageBreakBefore"));
});

test("python-docx: a failed photo is a note and left-out photos are announced", opts, async () => {
  const { media, xml } = await open({ groups: [{ heading: "", photos: [{ failed: true }, png(0)] }], omitted: 5 });
  assert.equal(media, 2);
  assert.ok(text(xml).includes("ไม่สามารถโหลดรูปนี้ได้"));
  assert.ok(text(xml).includes("แสดงรูปไม่ครบ ข้ามอีก 5 รูป"));
});

test("python-docx keeps a very long and a very wide photo inside the 7.6 x 8.5 cm box", opts, async () => {
  const { xml } = await open({ groups: [{ heading: "", photos: [{ data: makePng(20, 2000), width: 20, height: 2000, type: "png" }, { data: makePng(2000, 20), width: 2000, height: 20, type: "png" }] }], omitted: 0 });
  const extents = [...xml.matchAll(/<wp:extent cx="(\d+)" cy="(\d+)"/g)].map((m) => [Number(m[1]), Number(m[2])]).slice(1);
  assert.equal(extents.length, 2);
  for (const [cx, cy] of extents) assert.ok(cx <= 7.6 * 360000 + 1000 && cy <= 8.5 * 360000 + 1000, `extent ${cx} x ${cy} EMU`);
});
