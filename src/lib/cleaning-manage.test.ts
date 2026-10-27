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

import { filterRooms, parseGap, roomGaps } from "./cleaning-manage.ts";

const room = (name: string, zone: string, n: number, isActive = true) => ({ name, zone, isActive, advisorEmails: Array(n).fill("a@x") });

test("gaps count active rooms only", () => {
  const rooms = [room("ม.1/1", "", 0), room("ม.1/2", "หน้าอาคาร", 1), room("ม.1/3", " ", 0, false)];
  assert.deepEqual(roomGaps(rooms), { total: 2, noZone: 1, noAdvisor: 1 });
});

test("filter by name and gap", () => {
  const rooms = [room("ม.1/1", "", 0), room("ม.1/12", "x", 1), room("ม.2/1", "", 1)];
  assert.equal(filterRooms(rooms, "ม.1 /1", "").length, 2);
  assert.equal(filterRooms(rooms, "", "zone").length, 2);
  assert.equal(filterRooms(rooms, "", "advisor").length, 1);
  assert.equal(parseGap("zone"), "zone");
  assert.equal(parseGap("x"), "");
});
