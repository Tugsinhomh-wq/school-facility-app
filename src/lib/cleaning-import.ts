// Pure parser for the classroom spreadsheet (rows already read from .xlsx/.csv).
// No I/O. Advisor emails are only validated for shape here; matching them to
// profiles happens in the upload action.

export type ParsedClassroom = {
  name: string;
  building: string | null;
  advisorEmails: string[];
  zone: string;
};

export type ImportError = { row: number; message: string };

const COL_NAME = "ห้อง";
const COL_BUILDING = "อาคาร";
const COL_EMAIL = "อีเมลครูที่ปรึกษา";
const COL_ZONE = "เขต";

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

// Strip BOM / zero-width chars, trim, collapse inner whitespace.
function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/[﻿​-‍]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function thaiDigitsToAscii(s: string): string {
  return s.replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)));
}

export function parseClassroomRows(rows: string[][]): { ok: ParsedClassroom[]; errors: ImportError[] } {
  const ok: ParsedClassroom[] = [];
  const errors: ImportError[] = [];

  const headerCells = (rows[0] ?? []).map(clean);
  const col = {
    name: headerCells.indexOf(COL_NAME),
    building: headerCells.indexOf(COL_BUILDING),
    email: headerCells.indexOf(COL_EMAIL),
    zone: headerCells.indexOf(COL_ZONE),
  };
  const missing = [
    [COL_NAME, col.name],
    [COL_BUILDING, col.building],
    [COL_EMAIL, col.email],
    [COL_ZONE, col.zone],
  ]
    .filter(([, i]) => i === -1)
    .map(([label]) => label);
  if (missing.length > 0) {
    return {
      ok,
      errors: [{ row: 1, message: `แถวหัวตารางไม่มีคอลัมน์: ${missing.join(", ")}` }],
    };
  }

  const seen = new Map<string, number>(); // name -> first row number

  for (let i = 1; i < rows.length; i++) {
    const row = i + 1; // 1-based spreadsheet row
    const cells = rows[i] ?? [];
    const rawName = clean(cells[col.name]);
    const building = clean(cells[col.building]);
    const rawEmails = clean(cells[col.email]);
    const zone = clean(cells[col.zone]);

    if (!rawName && !building && !rawEmails && !zone) continue; // empty row

    const name = thaiDigitsToAscii(rawName);
    const problems: string[] = [];

    if (!name) {
      problems.push("ไม่ได้ระบุชื่อห้อง");
    } else {
      const first = seen.get(name);
      if (first !== undefined) problems.push(`ชื่อห้อง "${name}" ซ้ำกับแถวที่ ${first}`);
      else seen.set(name, row);
    }

    const emailTokens = rawEmails.split(/[\s,;，；]+/).filter(Boolean).map((e) => e.toLowerCase());
    const advisorEmails = [...new Set(emailTokens)];
    if (advisorEmails.length === 0) {
      problems.push("ไม่ได้ระบุอีเมลครูที่ปรึกษา");
    } else {
      for (const e of advisorEmails) {
        if (!EMAIL_RE.test(e)) problems.push(`รูปแบบอีเมลไม่ถูกต้อง: ${e}`);
      }
    }

    if (!zone) problems.push("ไม่ได้ระบุเขตทำความสะอาด");

    if (problems.length > 0) {
      for (const message of problems) errors.push({ row, message });
      continue;
    }
    ok.push({ name, building: building || null, advisorEmails, zone });
  }

  return { ok, errors };
}
