// Pure parser for the student roster spreadsheet (rows already read from .xlsx/.csv).
// No I/O. Matching the room to the term's classrooms happens in the upload action.
import { clean, thaiDigitsToAscii, type ImportError } from "./cleaning-import.ts";

export type ParsedStudent = {
  /** 1-based spreadsheet row. */
  row: number;
  room: string;
  /** Exactly 5 ASCII digits. */
  code: string;
  name: string;
};

const COL_ROOM = "ห้อง";
const COL_CODE = "เลขประจำตัว";
const COL_NAME = "ชื่อ-สกุล";
/** The template's header row, in column order. */
export const CENSUS_HEADERS = [COL_ROOM, COL_CODE, COL_NAME];

/** Obviously fake, so nobody mistakes them for real students. */
export const CENSUS_EXAMPLES = [
  ["ม.1/1", "00001", "นักเรียนตัวอย่าง หนึ่ง"],
  ["ม.1/1", "00002", "นักเรียนตัวอย่าง สอง"],
];

/** Header row plus the example rows. */
export function censusTemplateRows(): string[][] {
  return [CENSUS_HEADERS, ...CENSUS_EXAMPLES];
}

/** A code as typed: Thai digits become ASCII, and a number cell can come back as "12345.0", which is still 12345. */
const normCode = (raw: string) => thaiDigitsToAscii(raw).replace(/^(\d+)\.0+$/, "$1");

/** clean(), after dropping NUL and other control characters (tab and line breaks stay, and clean() folds them to a space). */
const cell = (v: unknown) => clean(String(v ?? "").replace(/(?![\t\n\v\f\r])\p{Cc}/gu, ""));

/** The template's example rows as parse sees them, so they can be refused. */
const EXAMPLE_KEYS = new Set(CENSUS_EXAMPLES.map(([, code, name]) => `${normCode(cell(code))}|${cell(name)}`));

export const MAX_ROWS = 3000;
const MAX_NAME = 200;
const CODE_LEN = 5;

export function parseCensusRows(rows: string[][]): { ok: ParsedStudent[]; errors: ImportError[] } {
  const ok: ParsedStudent[] = [];
  const errors: ImportError[] = [];

  const headerCells = (rows[0] ?? []).map(cell);
  const col = {
    room: headerCells.indexOf(COL_ROOM),
    code: headerCells.indexOf(COL_CODE),
    name: headerCells.indexOf(COL_NAME),
  };
  const missing = [
    [COL_ROOM, col.room],
    [COL_CODE, col.code],
    [COL_NAME, col.name],
  ]
    .filter(([, i]) => i === -1)
    .map(([label]) => label);
  if (missing.length > 0) {
    return {
      ok,
      errors: [{ row: 1, message: `แถวหัวตารางไม่มีคอลัมน์: ${missing.join(", ")}` }],
    };
  }
  if (rows.length - 1 > MAX_ROWS) {
    return { ok, errors: [{ row: 1, message: `ไฟล์มีมากกว่า ${MAX_ROWS} แถว กรุณาแบ่งไฟล์ตามห้องหรือระดับชั้น` }] };
  }

  const seen = new Map<string, number>(); // code -> first row number

  for (let i = 1; i < rows.length; i++) {
    const row = i + 1; // 1-based spreadsheet row
    const cells = rows[i] ?? [];
    const rawRoom = cell(cells[col.room]);
    const rawCode = cell(cells[col.code]);
    const name = cell(cells[col.name]);

    if (!rawRoom && !rawCode && !name) continue; // empty row

    const room = thaiDigitsToAscii(rawRoom);
    const code = normCode(rawCode);
    const problems: string[] = [];

    if (!room) problems.push("ไม่ได้ระบุห้อง");

    if (!code) {
      problems.push("ไม่ได้ระบุเลขประจำตัว");
    } else if (!/^\d+$/.test(code)) {
      problems.push(`เลขประจำตัว "${code}" ต้องเป็นตัวเลข ${CODE_LEN} หลักเท่านั้น`);
    } else if (code.length < CODE_LEN) {
      problems.push(
        `เลขประจำตัว "${code}" มี ${code.length} หลัก ต้องมี ${CODE_LEN} หลักพอดี (Excel มักตัดเลข 0 นำหน้า ให้ตั้งรูปแบบคอลัมน์เป็นข้อความ แล้วพิมพ์เลข 0 นำหน้าให้ครบ)`,
      );
    } else if (code.length > CODE_LEN) {
      problems.push(`เลขประจำตัว "${code}" มี ${code.length} หลัก ต้องมี ${CODE_LEN} หลักพอดี`);
    } else {
      const first = seen.get(code);
      if (first !== undefined) problems.push(`เลขประจำตัว "${code}" ซ้ำกับแถวที่ ${first}`);
      else seen.set(code, row);
    }

    if (EXAMPLE_KEYS.has(`${code}|${name}`)) problems.push("แถวนี้เป็นแถวตัวอย่างจากแม่แบบ ลบออกก่อนนำเข้า");

    if (!name) problems.push("ไม่ได้ระบุชื่อ-สกุล");
    else if (name.length > MAX_NAME) problems.push(`ชื่อ-สกุลยาวเกิน ${MAX_NAME} ตัวอักษร`);

    if (problems.length > 0) {
      for (const message of problems) errors.push({ row, message });
      continue;
    }
    ok.push({ row, room, code, name });
  }

  return { ok, errors };
}
