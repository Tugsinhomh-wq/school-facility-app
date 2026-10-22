// The roster template as a file. In memory only (reading uploads reuses readSheet).
import ExcelJS from "exceljs";

import { censusTemplateRows } from "./census-import.ts";

/** The three headers and two fake example rows; the code column is text so leading zeros survive. */
export async function censusTemplateXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("รายชื่อนักเรียน");
  const [headers, ...examples] = censusTemplateRows();
  ws.getColumn(2).numFmt = "@";
  ws.addRow(headers).font = { bold: true };
  for (const r of examples) ws.addRow(r);
  ws.columns.forEach((col, i) => (col.width = [12, 16, 40][i]));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
