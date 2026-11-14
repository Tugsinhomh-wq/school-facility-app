import test from "node:test";
import assert from "node:assert/strict";

import { groupByLevel, levelOf, levelsOf } from "./cleaning-level.ts";

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
