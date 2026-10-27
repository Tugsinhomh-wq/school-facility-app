import test from "node:test";
import assert from "node:assert/strict";
import { parseClassroomRows } from "./cleaning-import.ts";

const header = ["ห้อง", "อาคาร", "อีเมลครูที่ปรึกษา", "เขต"];

test("header-only file gives no rows and no errors", () => {
  assert.deepEqual(parseClassroomRows([header]), { ok: [], errors: [] });
});

test("empty input is a missing-header error on row 1", () => {
  const r = parseClassroomRows([]);
  assert.equal(r.ok.length, 0);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].row, 1);
});

test("missing header column gives one error on row 1", () => {
  const r = parseClassroomRows([["ห้อง", "อาคาร", "เขต"], ["ม.1/1", "A", "z"]]);
  assert.equal(r.ok.length, 0);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].row, 1);
  assert.match(r.errors[0].message, /อีเมลครูที่ปรึกษา/);
});

test("Thai digits in name become ASCII", () => {
  const r = parseClassroomRows([header, ["ม.๓/๒", "อาคาร 1", "a@lrp.ac.th", "โซน ก"]]);
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok[0].name, "ม.3/2");
});

test("BOM on first header cell is stripped", () => {
  const r = parseClassroomRows([["﻿ห้อง", "อาคาร", "อีเมลครูที่ปรึกษา", "เขต"], ["ม.1/1", "", "a@lrp.ac.th", "ก"]]);
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok.length, 1);
});

test("columns in any order, extra spaces collapsed and trimmed", () => {
  const r = parseClassroomRows([
    ["เขต", "อีเมลครูที่ปรึกษา", "ห้อง", "อาคาร"],
    ["  สนามหญ้า  หน้า ", "A@LRP.ac.th", "  ม.1/1  ", "  อาคาร   2 "],
  ]);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.ok, [
    { row: 2, name: "ม.1/1", building: "อาคาร 2", advisorEmails: ["a@lrp.ac.th"], zone: "สนามหญ้า หน้า" },
  ]);
});

test("two emails in one cell are split and lower-cased", () => {
  const r = parseClassroomRows([header, ["ม.1/1", "", "A@lrp.ac.th, b@lrp.ac.th", "ก"]]);
  assert.deepEqual(r.ok[0].advisorEmails, ["a@lrp.ac.th", "b@lrp.ac.th"]);
  const r2 = parseClassroomRows([header, ["ม.1/2", "", "a@lrp.ac.th;b@lrp.ac.th c@lrp.ac.th", "ก"]]);
  assert.deepEqual(r2.ok[0].advisorEmails, ["a@lrp.ac.th", "b@lrp.ac.th", "c@lrp.ac.th"]);
});

test("blank building becomes null", () => {
  const r = parseClassroomRows([header, ["ม.1/1", "  ", "a@lrp.ac.th", "ก"]]);
  assert.equal(r.ok[0].building, null);
});

test("duplicate room errors on the second row number", () => {
  const r = parseClassroomRows([
    header,
    ["ม.1/1", "", "a@lrp.ac.th", "ก"],
    ["ม.2/1", "", "a@lrp.ac.th", "ก"],
    ["ม.๑/๑", "", "b@lrp.ac.th", "ข"], // same room written with Thai digits
  ]);
  assert.equal(r.ok.length, 2);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].row, 4);
});

test("blank zone is accepted: the room has no zone", () => {
  const r = parseClassroomRows([header, ["ม.1/1", "", "a@lrp.ac.th", "   "], ["ม.1/2", "", "a@lrp.ac.th"]]);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.ok.map((x) => x.zone), ["", ""]);
});

test("blank zone and blank advisors together are fine", () => {
  const r = parseClassroomRows([header, ["ม.1/1", "", "", ""]]);
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok.length, 1);
});

test("blank zone does not hide other errors or duplicates", () => {
  const r = parseClassroomRows([header, ["ม.1/1", "", "", ""], ["ม.๑/๑", "", "", ""], ["ม.1/2", "", "bad", ""]]);
  assert.equal(r.ok.length, 1);
  assert.deepEqual(r.errors.map((e) => e.row), [3, 4]);
});

test("blank advisor email is accepted: the room has no advisors", () => {
  const r = parseClassroomRows([header, ["ม.1/1", "", "", "ก"], ["ม.1/2", "A", "   ", "ข"], ["ม.1/3", "", " , ; "]]);
  assert.equal(r.ok[0].advisorEmails.length, 0);
  assert.equal(r.ok[1].advisorEmails.length, 0);
  assert.deepEqual(r.errors, []); // short row: advisors and zone both absent
  assert.equal(r.ok.length, 3);
});

test("blank name, malformed email and a bad one among good ones are row-numbered errors", () => {
  const r = parseClassroomRows([
    header,
    ["", "", "a@lrp.ac.th", "ก"],
    ["ม.1/2", "", "not-an-email", "ก"],
    ["ม.1/3", "", "a@lrp.ac.th, bad@", "ก"],
  ]);
  assert.equal(r.ok.length, 0);
  assert.deepEqual(r.errors.map((e) => e.row), [2, 3, 4]);
});

test("duplicate room still errors when both rows have no email", () => {
  const r = parseClassroomRows([header, ["ม.1/1", "", "", "ก"], ["ม.1/1", "", "", "ก"]]);
  assert.equal(r.ok.length, 1);
  assert.deepEqual(r.errors.map((e) => e.row), [3]);
});

test("empty rows are skipped silently but keep row numbers", () => {
  const r = parseClassroomRows([
    header,
    ["", "", "", ""],
    [],
    ["ม.1/1", "", "a@lrp.ac.th", "ก"],
    ["ม.1/1", "", "a@lrp.ac.th", "ก"],
  ]);
  assert.equal(r.ok.length, 1);
  assert.deepEqual(r.errors.map((e) => e.row), [5]);
});

test("short rows (missing trailing cells) are handled", () => {
  const r = parseClassroomRows([header, ["ม.1/1", "A"], ["", "A"]]);
  assert.equal(r.ok.length, 1);
  assert.equal(r.errors[0].row, 3); // only the missing name is an error
});
