import test from "node:test";
import assert from "node:assert/strict";

import ExcelJS from "exceljs";

import { HEADERS, parseClassroomRows } from "./cleaning-import.ts";
import { readSheet, templateXlsx } from "./cleaning-sheet.ts";

test("the template re-imports through readSheet + parser as its one example row", async () => {
  const rows = await readSheet(await templateXlsx(), "xlsx");
  assert.deepEqual(rows[0], HEADERS);
  assert.deepEqual(parseClassroomRows(rows), {
    ok: [
      {
        row: 2,
        name: "ม.3/2",
        building: "อาคาร 2",
        advisorEmails: ["somying@lrp.ac.th"],
        zone: "ทางเดินหน้าอาคาร 2 ชั้น 1",
      },
    ],
    errors: [],
  });
});

test("csv: BOM, Thai digits, two emails in one cell, blank line keeps row numbers", async () => {
  const csv =
    "\uFEFFห้อง,อาคาร,อีเมลครูที่ปรึกษา,เขต\n" +
    'ม.๓/๒,อาคาร 2,"a@lrp.ac.th, b@lrp.ac.th",หน้าอาคาร\n' +
    "\n" +
    "ม.3/2,,c@lrp.ac.th,\n";
  const r = parseClassroomRows(await readSheet(Buffer.from(csv), "csv"));
  assert.deepEqual(r.ok, [
    { row: 2, name: "ม.3/2", building: "อาคาร 2", advisorEmails: ["a@lrp.ac.th", "b@lrp.ac.th"], zone: "หน้าอาคาร" },
  ]);
  assert.deepEqual(
    r.errors.map((e) => e.row),
    [4, 4], // duplicate of row 2 + blank zone, on spreadsheet row 4
  );
});

test("csv values are not turned into numbers or dates", async () => {
  const rows = await readSheet(Buffer.from("ห้อง\n2026-10-21\n007\n"), "csv");
  assert.deepEqual(rows, [["ห้อง"], ["2026-10-21"], ["007"]]);
});

test("xlsx: hyperlinked email reads as its text; gaps keep row numbers", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("s");
  ws.addRow(HEADERS);
  ws.getRow(3).values = ["ม.1/1", "", { text: "x@lrp.ac.th", hyperlink: "mailto:x@lrp.ac.th" }, "z"];
  const rows = await readSheet(Buffer.from(await wb.xlsx.writeBuffer()), "xlsx");
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[1], []);
  assert.equal(rows[2][2], "x@lrp.ac.th");
});
