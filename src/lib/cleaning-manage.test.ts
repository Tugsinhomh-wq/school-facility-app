import test from "node:test";
import assert from "node:assert/strict";
import { parseLevel, parseManageTab } from "./cleaning-manage.ts";

test("unknown tab falls back to rooms", () => {
  assert.equal(parseManageTab(undefined), "rooms");
  assert.equal(parseManageTab("x"), "rooms");
  assert.equal(parseManageTab(["dates"]), "rooms");
  assert.equal(parseManageTab("dates"), "dates");
});

test("level must be one that exists", () => {
  assert.equal(parseLevel("ม.2", ["ม.1", "ม.2"]), "ม.2");
  assert.equal(parseLevel("ม.9", ["ม.1", "ม.2"]), "");
  assert.equal(parseLevel(undefined, ["ม.1"]), "");
});
