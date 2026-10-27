// The classroom spreadsheet as a file: read an uploaded .xlsx/.csv into rows for
// parseClassroomRows, and build the downloadable template. In memory only.
import { Readable } from "node:stream";

import ExcelJS from "exceljs";

import { HEADERS } from "./cleaning-import.ts";
import type { reportRows } from "./cleaning-report.ts";

/**
 * First worksheet as display text, rows[i] = spreadsheet row i + 1 (so error row numbers match
 * what the officer sees). Hyperlinked emails and formulas come back as their shown text.
 */
export async function readSheet(data: Buffer, kind: "xlsx" | "csv"): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  if (kind === "xlsx") await wb.xlsx.load(data as unknown as ExcelJS.Buffer);
  // CSV values stay as typed: no number/date guessing.
  else await wb.csv.read(Readable.from(data), { map: (v: unknown) => v });
  const ws = wb.worksheets[0];
  const rows: string[][] = [];
  ws?.eachRow((row, n) => {
    rows[n - 1] = Array.from({ length: row.cellCount }, (_, c) => row.getCell(c + 1).text ?? "");
  });
  return Array.from(rows, (r) => r ?? []);
}

export const TEMPLATE_EXAMPLE = ["ม.3/2", "อาคาร 2", "somying@lrp.ac.th", "ทางเดินหน้าอาคาร 2 ชั้น 1"];

/** The four headers and one example row. */
export async function templateXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("ห้องเรียน");
  ws.addRow(HEADERS).font = { bold: true };
  ws.addRow(TEMPLATE_EXAMPLE);
  ws.getCell("C1").note = "ไม่บังคับ เว้นว่างได้ (ห้องเดิมจะคงครูที่ปรึกษาไว้ตามเดิม)";
  ws.columns.forEach((col, i) => (col.width = [12, 16, 40, 40][i]));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export const REPORT_HEADERS = ["ห้อง", "เขต", "ครูที่ปรึกษา", "วันที่ต้องยืนยัน", "ยืนยันแล้ว", "ร้อยละ", "ยังไม่ยืนยัน"];
/** Rooms below this share of confirmed days are shaded. */
export const REPORT_WARN = 0.8;

/** The cleaning summary: a title line, the headers, one row per room and a school-wide total row. */
export async function reportXlsx(title: string, { rows, total }: ReturnType<typeof reportRows>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("สรุปเขตทำความสะอาด");
  ws.addRow([title]).font = { bold: true, size: 14 };
  ws.addRow(REPORT_HEADERS).font = { bold: true };
  const add = (r: (string | number | null)[], pct: number | null) => {
    const row = ws.addRow(r);
    row.getCell(6).numFmt = "0%";
    if (pct != null && pct < REPORT_WARN) {
      row.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE2E2" } }));
    }
    return row;
  };
  for (const r of rows) add([r.name, r.zone, r.advisors, r.due, r.done, r.pct, r.missing], r.pct);
  add(["รวมทั้งโรงเรียน", "", "", total.due, total.done, total.pct, total.missing], total.pct).font = { bold: true };
  ws.columns.forEach((col, i) => (col.width = [18, 36, 32, 16, 12, 10, 14][i]));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
