import test from "node:test";
import assert from "node:assert/strict";
import { parseCensusRows, censusTemplateRows, CENSUS_HEADERS } from "./census-import.ts";
import { parseClassroomRows } from "./cleaning-import.ts";

const header = ["ห้อง", "เลขประจำตัว", "ชื่อ-สกุล"];

test("header-only file gives no rows and no errors", () => {
  assert.deepEqual(parseCensusRows([header]), { ok: [], errors: [] });
});

test("empty input is a missing-header error on row 1", () => {
  const r = parseCensusRows([]);
  assert.equal(r.ok.length, 0);
  assert.deepEqual(r.errors.map((e) => e.row), [1]);
});

test("a valid file parses with spreadsheet row numbers", () => {
  const r = parseCensusRows([header, ["ม.1/1", "00001", "นักเรียนทดสอบ ก"], ["ม.1/2", "12345", "นักเรียนทดสอบ ข"]]);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.ok, [
    { row: 2, room: "ม.1/1", code: "00001", name: "นักเรียนทดสอบ ก" },
    { row: 3, room: "ม.1/2", code: "12345", name: "นักเรียนทดสอบ ข" },
  ]);
});

test("the template reads back with its zeros, and its example rows are refused", () => {
  assert.deepEqual(censusTemplateRows()[0], CENSUS_HEADERS);
  const r = parseCensusRows(censusTemplateRows());
  assert.equal(r.ok.length, 0);
  assert.deepEqual(r.errors.map((e) => e.row), [2, 3]);
  assert.match(r.errors[0].message, /แถวตัวอย่าง/);
  assert.doesNotMatch(r.errors[0].message, /หลัก/); // the code itself was read fine: 00001 kept its zeros
});

test("a real row with an example's code but another name is fine", () => {
  const r = parseCensusRows([header, ["ม.1/1", "00001", "นักเรียนทดสอบ ก"]]);
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok.length, 1);
});

test("NUL and other control characters are stripped from cells; a code that stays bad is a normal bad-code error", () => {
  const r = parseCensusRows([
    header,
    ["ม.1/1", "00001", "a\u0000b"],
    ["ม.1/1", "12\u000034", "นักเรียนทดสอบ ก"],
    ["ม.1/1", "00003", "c\u0007 d\te"],
  ]);
  assert.deepEqual(r.ok.map((s) => s.name), ["ab", "c d e"]);
  assert.deepEqual(r.errors.map((e) => e.row), [3]);
  assert.match(r.errors[0].message, /4 หลัก/);
});

test("Thai digits in room and code become ASCII", () => {
  const r = parseCensusRows([header, ["ม.๓/๒", "๐๑๒๓๔", "นักเรียนทดสอบ ก"]]);
  assert.deepEqual(r.errors, []);
  assert.deepEqual([r.ok[0].room, r.ok[0].code], ["ม.3/2", "01234"]);
});

test("BOM and odd spacing in the header are tolerated, columns in any order", () => {
  const r = parseCensusRows([
    ["﻿ ชื่อ-สกุล ", "เลขประจำตัว", "  ห้อง"],
    ["  นักเรียนทดสอบ   ก ", "00007", "  ม.1/1 "],
  ]);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.ok, [{ row: 2, room: "ม.1/1", code: "00007", name: "นักเรียนทดสอบ ก" }]);
});

test("a renamed header gives one error on row 1 and parses nothing", () => {
  const r = parseCensusRows([["ห้อง", "รหัสนักเรียน", "ชื่อ-สกุล"], ["ม.1/1", "00001", "นักเรียนทดสอบ ก"]]);
  assert.equal(r.ok.length, 0);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].row, 1);
  assert.match(r.errors[0].message, /เลขประจำตัว/);
});

test("blank rows are skipped silently but keep row numbers", () => {
  const r = parseCensusRows([header, ["", "", ""], [], ["  ", "", " "], ["ม.1/1", "00001", "นักเรียนทดสอบ ก"]]);
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok[0].row, 5);
});

test("a 4-digit code is an error that says to keep leading zeros as text, never padded", () => {
  const r = parseCensusRows([header, ["ม.1/1", "1234", "นักเรียนทดสอบ ก"]]);
  assert.equal(r.ok.length, 0);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].row, 2);
  assert.match(r.errors[0].message, /4 หลัก/);
  assert.match(r.errors[0].message, /ข้อความ/);
  assert.match(r.errors[0].message, /เลข 0 นำหน้า/);
});

test("6-digit and letter codes are errors", () => {
  const r = parseCensusRows([
    header,
    ["ม.1/1", "123456", "นักเรียนทดสอบ ก"],
    ["ม.1/1", "12a45", "นักเรียนทดสอบ ข"],
    ["ม.1/1", "1234 5", "นักเรียนทดสอบ ค"], // inner space is not a digit
    ["ม.1/1", "", "นักเรียนทดสอบ ง"],
  ]);
  assert.equal(r.ok.length, 0);
  assert.deepEqual(r.errors.map((e) => e.row), [2, 3, 4, 5]);
  assert.match(r.errors[0].message, /6 หลัก/);
  assert.match(r.errors[1].message, /ตัวเลข/);
  assert.match(r.errors[3].message, /ไม่ได้ระบุเลขประจำตัว/);
});

test("a number cell 12345 or 12345.0 is accepted; 1234.0 is still a 4-digit error", () => {
  const r = parseCensusRows([
    header,
    ["ม.1/1", "12345", "นักเรียนทดสอบ ก"],
    ["ม.1/1", "23456.0", "นักเรียนทดสอบ ข"],
    ["ม.1/1", "1234.0", "นักเรียนทดสอบ ค"],
    ["ม.1/1", "12345.5", "นักเรียนทดสอบ ง"],
  ]);
  assert.deepEqual(r.ok.map((s) => s.code), ["12345", "23456"]);
  assert.deepEqual(r.errors.map((e) => e.row), [4, 5]);
});

test("the same code twice errors on the second row and names the first", () => {
  const r = parseCensusRows([
    header,
    ["ม.1/1", "00001", "นักเรียนทดสอบ ก"],
    ["ม.1/2", "00002", "นักเรียนทดสอบ ข"],
    ["ม.1/2", "๐๐๐๐๑", "นักเรียนทดสอบ ค"], // Thai digits, same code
  ]);
  assert.equal(r.ok.length, 2);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].row, 4);
  assert.match(r.errors[0].message, /แถวที่ 2/);
});

test("empty, whitespace-only and overlong names are errors; 200 characters is fine", () => {
  const r = parseCensusRows([
    header,
    ["ม.1/1", "00001", ""],
    ["ม.1/1", "00002", "   "],
    ["ม.1/1", "00003", "ก".repeat(201)],
    ["ม.1/1", "00004", "ก".repeat(200)],
  ]);
  assert.deepEqual(r.errors.map((e) => e.row), [2, 3, 4]);
  assert.deepEqual(r.ok.map((s) => s.code), ["00004"]);
});

test("a missing room is an error", () => {
  const r = parseCensusRows([header, ["", "00001", "นักเรียนทดสอบ ก"]]);
  assert.equal(r.ok.length, 0);
  assert.deepEqual(r.errors.map((e) => e.row), [2]);
});

test("room names are cleaned exactly like the classroom parser does", () => {
  const rooms = ["ม.๓/๒", "  ม.1/1  ", "ม.​2/1", "ม.  ๔ / ๑", "ม.๑๐/๑"]; // Thai digits, padding, zero-width, inner spaces
  const viaClassrooms = parseClassroomRows([
    ["ห้อง", "อาคาร", "อีเมลครูที่ปรึกษา", "เขต"],
    ...rooms.map((n) => [n, "", "a@lrp.ac.th", "ก"]),
  ]);
  const viaCensus = parseCensusRows([header, ...rooms.map((n, i) => [n, String(10000 + i), "นักเรียนทดสอบ ก"])]);
  assert.deepEqual(viaClassrooms.errors, []);
  assert.deepEqual(viaCensus.errors, []);
  assert.deepEqual(
    viaCensus.ok.map((s) => s.room),
    viaClassrooms.ok.map((c) => c.name),
  );
});

test("row cap: 3000 rows pass, 3001 give one error", () => {
  const body = (n: number) => Array.from({ length: n }, (_, i) => ["ม.1/1", String(10000 + i), "นักเรียนทดสอบ ก"]);
  assert.equal(parseCensusRows([header, ...body(3000)]).ok.length, 3000);
  const r = parseCensusRows([header, ...body(3001)]);
  assert.equal(r.ok.length, 0);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0].message, /3000/);
});

test("bad rows do not stop good rows; errors come in file order", () => {
  const r = parseCensusRows([
    header,
    ["ม.1/1", "1", "นักเรียนทดสอบ ก"],
    ["ม.1/1", "00002", "นักเรียนทดสอบ ข"],
    ["", "00003", ""],
    ["ม.1/1", "00004", "นักเรียนทดสอบ ง"],
  ]);
  assert.deepEqual(r.ok.map((s) => s.row), [3, 5]);
  assert.deepEqual(r.errors.map((e) => e.row), [2, 4, 4]);
});

test("short rows and non-string cells never throw", () => {
  const r = parseCensusRows([header, ["ม.1/1"], [undefined as unknown as string, 12345 as unknown as string, null as unknown as string]]);
  assert.equal(r.ok.length, 0);
  assert.deepEqual(r.errors.map((e) => e.row), [2, 2, 3, 3]);
});
