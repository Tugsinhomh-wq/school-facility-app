// The classroom spreadsheet as a file: read an uploaded .xlsx/.csv into rows for
// parseClassroomRows, and build the downloadable template. In memory only.
import { Readable } from "node:stream";

import ExcelJS from "exceljs";

import { HEADERS } from "./cleaning-import.ts";

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
  ws.columns.forEach((col, i) => (col.width = [12, 16, 40, 40][i]));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
