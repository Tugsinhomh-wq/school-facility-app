import test from "node:test";
import assert from "node:assert/strict";
import { mapToRooms, summarizeErrors } from "./census-map.ts";

const rooms = [
  { id: "r1", name: "ม.1/1" },
  { id: "r2", name: "ม.1/2" },
];
const s = (row: number, room: string, code: string) => ({ row, room, code, name: `นักเรียนทดสอบ ${code}` });

test("each student gets the id of its room and the term", () => {
  const r = mapToRooms([s(2, "ม.1/1", "00001"), s(3, "ม.1/2", "00002")], rooms, "2569/1");
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.rows, [
    { classroom_id: "r1", term: "2569/1", student_code: "00001", full_name: "นักเรียนทดสอบ 00001" },
    { classroom_id: "r2", term: "2569/1", student_code: "00002", full_name: "นักเรียนทดสอบ 00002" },
  ]);
});

test("a room the term does not have is an error on its row, the others still map", () => {
  const r = mapToRooms([s(2, "ม.1/1", "00001"), s(3, "ม.9/9", "00002")], rooms, "2569/1");
  assert.equal(r.rows.length, 1);
  assert.deepEqual(r.errors, [{ row: 3, message: "ไม่พบห้อง ม.9/9 ในภาคเรียน 2569/1" }]);
});

test("room names match exactly, not by prefix", () => {
  assert.equal(mapToRooms([s(2, "ม.1/", "00001")], rooms, "2569/1").errors.length, 1);
});

test("no students maps to nothing", () => {
  assert.deepEqual(mapToRooms([], rooms, "2569/1"), { rows: [], errors: [] });
});

test("few errors are all listed, sorted by row, with no 'more'", () => {
  const r = summarizeErrors([
    { row: 5, message: "ข" },
    { row: 2, message: "ก" },
  ]);
  assert.deepEqual(r.errors.map((e) => e.row), [2, 5]);
  assert.equal(r.more, 0);
  assert.equal(r.message, "พบข้อผิดพลาด 2 รายการ ยังไม่ได้บันทึกข้อมูลใด แก้ไฟล์แล้วนำเข้าใหม่");
});

test("exactly 50 errors are not capped", () => {
  const r = summarizeErrors(Array.from({ length: 50 }, (_, i) => ({ row: i + 2, message: "x" })));
  assert.equal(r.errors.length, 50);
  assert.equal(r.more, 0);
});

test("past 50 errors the list is cut and the message counts the rest", () => {
  const r = summarizeErrors(Array.from({ length: 120 }, (_, i) => ({ row: 121 - i, message: "x" })));
  assert.equal(r.errors.length, 50);
  assert.equal(r.errors[0].row, 2);
  assert.equal(r.more, 70);
  assert.match(r.message, /พบข้อผิดพลาด 120 รายการ/);
  assert.match(r.message, /แสดง 50 รายการแรก และอีก 70 รายการ/);
});

test("a custom cap is honoured", () => {
  const r = summarizeErrors([{ row: 2, message: "a" }, { row: 3, message: "b" }, { row: 4, message: "c" }], 1);
  assert.equal(r.errors.length, 1);
  assert.equal(r.more, 2);
});
