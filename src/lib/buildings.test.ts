import test from "node:test";
import assert from "node:assert/strict";

import { isOtherBuilding, needsPlace, otherLast } from "./buildings.ts";

test("isOtherBuilding recognises the catch-all building by its code", () => {
  assert.equal(isOtherBuilding("OTHER-01"), true);
  assert.equal(isOtherBuilding("BLD-01"), false);
  assert.equal(isOtherBuilding("HALL-01"), false);
  assert.equal(isOtherBuilding(null), false);
  assert.equal(isOtherBuilding(undefined), false);
});

test("otherLast moves the catch-all building to the end and keeps the rest in order", () => {
  const list = [
    { id: "a", name: "อาคาร 1", code: "BLD-01" },
    { id: "o", name: "อื่นๆ (นอกอาคาร)", code: "OTHER-01" },
    { id: "b", name: "โรงอาหาร", code: "BLD-04" },
  ];
  assert.deepEqual(
    otherLast(list).map((b) => b.id),
    ["a", "b", "o"],
  );
  // The input is not changed.
  assert.equal(list[1].id, "o");
});

test("needsPlace asks for a place only for the catch-all building when none was typed", () => {
  assert.equal(needsPlace("OTHER-01", ""), true);
  assert.equal(needsPlace("OTHER-01", "   "), true);
  assert.equal(needsPlace("OTHER-01", "สนามฟุตบอล"), false);
  assert.equal(needsPlace("BLD-01", ""), false);
  assert.equal(needsPlace(null, ""), false);
});
