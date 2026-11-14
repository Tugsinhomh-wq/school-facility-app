import test from "node:test";
import assert from "node:assert/strict";

import { compareRoomNames } from "./cleaning.ts";
import { groupByLevel, levelOf, levelsOf, levelTitles } from "./cleaning-level.ts";

test("the level is the part of the name before the slash", () => {
  assert.equal(levelOf("ม.1/2"), "ม.1");
  assert.equal(levelOf(" ม.6/10 "), "ม.6");
  assert.equal(levelOf("ห้องพิเศษ"), "ห้องพิเศษ");
});

test("levels come out once each in school order, ม.2 before ม.10", () => {
  assert.deepEqual(levelsOf(["ม.3/1", "ม.1/2", "ม.10/1", "ม.1/1", "ม.2/1"]), ["ม.1", "ม.2", "ม.3", "ม.10"]);
});

test("grouping keeps each group's own order and orders the groups", () => {
  const rows = [{ n: "ม.2/2" }, { n: "ม.1/3" }, { n: "ม.2/1" }, { n: "ม.1/1" }];
  const groups = groupByLevel(rows, (r) => r.n);
  assert.deepEqual(groups.map((g) => g.level), ["ม.1", "ม.2"]);
  assert.deepEqual(groups[0].rows.map((r) => r.n), ["ม.1/3", "ม.1/1"]);
  assert.deepEqual(groups[1].rows.map((r) => r.n), ["ม.2/2", "ม.2/1"]);
});

test("ปวช.1-3 share the tray of ม.4-6 and come last in it", () => {
  assert.equal(levelOf("ปวช.1"), "ม.4");
  assert.equal(levelOf("ปวช.3"), "ม.6");
  assert.deepEqual(levelsOf(["ปวช.2", "ม.5/1", "ม.4/1"]), ["ม.4", "ม.5"]);
  const rows = [{ n: "ปวช.1" }, { n: "ม.4/2" }, { n: "ม.4/11" }];
  assert.deepEqual(groupByLevel(rows, (r) => r.n)[0].rows.map((r) => r.n), ["ม.4/2", "ม.4/11", "ปวช.1"]);
  assert.deepEqual(levelTitles(["ม.4/1", "ปวช.1", "ม.5/1"]), { "ม.4": "ม.4 และ ปวช.1", "ม.5": "ม.5" });
});

test("room names sort ปวช.1 after ม.4/11 and before ม.5/1", () => {
  const names = ["ม.5/1", "ปวช.1", "ม.4/11", "ม.4/2", "ปวช.3", "ม.6/11", "ปวช.2", "ม.5/11"];
  assert.deepEqual(names.sort(compareRoomNames), ["ม.4/2", "ม.4/11", "ปวช.1", "ม.5/1", "ม.5/11", "ปวช.2", "ม.6/11", "ปวช.3"]);
});
