import test from "node:test";
import assert from "node:assert/strict";
import { compareRoomNames, dayState, overviewOrder, weekGrid, weekTally, type Confirmation } from "./cleaning.ts";

const today = "2026-10-21"; // Wednesday
const none = new Set<string>();
const ok: Confirmation = { isLate: false, byName: "ครู ก" };
const late: Confirmation = { isLate: true, byName: "ครู ข" };

test("weekend is off", () => {
  assert.equal(dayState({ ymd: "2026-10-24", today, offDays: none, confirmation: null }), "off");
});

test("holiday without confirmation is off", () => {
  assert.equal(dayState({ ymd: "2026-10-23", today, offDays: new Set(["2026-10-23"]), confirmation: null }), "off");
});

test("holiday with a confirmation is confirmed", () => {
  assert.equal(dayState({ ymd: "2026-10-23", today, offDays: new Set(["2026-10-23"]), confirmation: ok }), "confirmed");
});

test("today without confirmation is pending", () => {
  assert.equal(dayState({ ymd: today, today, offDays: none, confirmation: null }), "pending");
});

test("yesterday without confirmation is missed", () => {
  assert.equal(dayState({ ymd: "2026-10-20", today, offDays: none, confirmation: null }), "missed");
});

test("tomorrow is future", () => {
  assert.equal(dayState({ ymd: "2026-10-22", today, offDays: none, confirmation: null }), "future");
});

test("late confirmation is late", () => {
  assert.equal(dayState({ ymd: "2026-10-20", today, offDays: none, confirmation: late }), "late");
});

test("weekGrid returns Mon-Fri", () => {
  const grid = weekGrid({ monday: "2026-10-19", today, offDays: none, confirmations: new Map([["2026-10-20", ok]]) });
  assert.deepEqual(grid.map((g) => g.ymd), ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]);
  assert.deepEqual(grid.map((g) => g.state), ["missed", "confirmed", "pending", "future", "future"]);
  assert.equal(grid[1].confirmation, ok);
  assert.equal(grid[0].confirmation, null);
});

test("room names sort by number, not by character", () => {
  assert.deepEqual(["ม.3/10", "ม.3/2", "ม.1/1"].sort(compareRoomNames), ["ม.1/1", "ม.3/2", "ม.3/10"]);
});

test("overview puts missing rooms first, each group by name", () => {
  const rows = [{ name: "ม.1/2" }, { name: "ม.3/10" }, { name: "ม.1/1" }, { name: "ม.3/2" }];
  const missing = new Set(["ม.3/10", "ม.3/2"]);
  assert.deepEqual(
    overviewOrder(rows, (r) => missing.has(r.name), (r) => r.name).map((r) => r.name),
    ["ม.3/2", "ม.3/10", "ม.1/1", "ม.1/2"],
  );
});

test("week tally counts confirmed and late out of due days; pending, off and future are not due", () => {
  const states = ["confirmed", "late", "missed", "pending", "off"] as const;
  assert.deepEqual(weekTally(states.map((state) => ({ state }))), { done: 2, due: 3 });
  assert.deepEqual(weekTally([{ state: "future" }, { state: "off" }]), { done: 0, due: 0 });
});
