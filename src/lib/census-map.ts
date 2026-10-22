// Pure step between the parsed roster file and the database: put each student in the term's room
// and build the error list the officer sees. No I/O.
import type { ParsedStudent } from "./census-import.ts";
import type { ImportError } from "./cleaning-import.ts";

export type RosterRow = { classroom_id: string; term: string; student_code: string; full_name: string };

/** More errors than this are counted, not listed. */
export const MAX_SHOWN_ERRORS = 50;

/**
 * Rooms are matched by exact name: the file's room went through the same cleaning as the names stored
 * by the classroom import. A room the term does not have is an error on that student's row.
 */
export function mapToRooms(students: ParsedStudent[], rooms: { id: string; name: string }[], term: string) {
  const idOf = new Map(rooms.map((r) => [r.name, r.id]));
  const rows: RosterRow[] = [];
  const errors: ImportError[] = [];
  for (const s of students) {
    const classroom_id = idOf.get(s.room);
    if (!classroom_id) errors.push({ row: s.row, message: `ไม่พบห้อง ${s.room} ในภาคเรียน ${term}` });
    else rows.push({ classroom_id, term, student_code: s.code, full_name: s.name });
  }
  return { rows, errors };
}

/** Everything wrong with the file, by row: the first `max` to list, how many were left out, and the message. */
export function summarizeErrors(errors: ImportError[], max = MAX_SHOWN_ERRORS) {
  const sorted = [...errors].sort((a, b) => a.row - b.row);
  const more = Math.max(0, sorted.length - max);
  return {
    errors: sorted.slice(0, max),
    more,
    message:
      `พบข้อผิดพลาด ${sorted.length} รายการ ยังไม่ได้บันทึกข้อมูลใด แก้ไฟล์แล้วนำเข้าใหม่` +
      (more > 0 ? ` (แสดง ${max} รายการแรก และอีก ${more} รายการ)` : ""),
  };
}
