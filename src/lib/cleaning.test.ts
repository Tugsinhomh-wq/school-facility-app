import test from "node:test";
import assert from "node:assert/strict";
import { canCancelDay, compareRoomNames, isPhotoPath, dayState, lateReachable, overviewOrder, weekGrid, weekTally, type Confirmation } from "./cleaning.ts";

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

test("lateReachable keeps missed days of last week within 7 days of today", () => {
  const lastMonday = "2026-10-12";
  const lastWeek = weekGrid({ monday: lastMonday, today, offDays: new Set(["2026-10-15"]), confirmations: new Map([["2026-10-13", ok]]) });
  // Wednesday 21st: Mon 12th and Tue 13th (confirmed) are too old / done, 14th and 16th are reachable, 15th is a holiday.
  assert.deepEqual(lateReachable(lastWeek, today).map((d) => d.ymd), ["2026-10-14", "2026-10-16"]);
  // Monday 19th: the whole of last week is within 7 days except nothing older than the 12th.
  assert.deepEqual(lateReachable(lastWeek, "2026-10-19").map((d) => d.ymd), ["2026-10-12", "2026-10-14", "2026-10-16"]);
});

test("canCancelDay: today and yesterday only, across month and year ends", () => {
  assert.equal(canCancelDay("2026-10-21", "2026-10-21"), true);
  assert.equal(canCancelDay("2026-10-20", "2026-10-21"), true);
  assert.equal(canCancelDay("2026-10-19", "2026-10-21"), false);
  assert.equal(canCancelDay("2026-10-22", "2026-10-21"), false);
  assert.equal(canCancelDay("2026-09-30", "2026-10-01"), true);
  assert.equal(canCancelDay("2025-12-31", "2026-01-01"), true);
  assert.equal(canCancelDay("2028-02-29", "2028-03-01"), true);
  assert.equal(canCancelDay("2026-02-28", "2026-03-01"), true);
});

test("canCancelDay refuses garbage", () => {
  assert.equal(canCancelDay("", "2026-10-21"), false);
  assert.equal(canCancelDay("2026-02-31", "2026-03-01"), false);
  assert.equal(canCancelDay("21/10/2026", "2026-10-21"), false);
  assert.equal(canCancelDay("2026-10-21", "nope"), false);
  assert.equal(canCancelDay(undefined as unknown as string, "2026-10-21"), false);
});

test("isPhotoPath: only <uuid>/<file>, never a path that climbs out", () => {
  const id = "0b9a4c1e-2d3f-4a5b-8c6d-7e8f9a0b1c2d";
  assert.equal(isPhotoPath(`${id}/${id}.jpg`), true);
  assert.equal(isPhotoPath(`${id}/../other/x.jpg`), false);
  assert.equal(isPhotoPath(`${id}/a/b.jpg`), false);
  assert.equal(isPhotoPath("x/1.jpg"), false);
  assert.equal(isPhotoPath(`/${id}/x.jpg`), false);
  assert.equal(isPhotoPath(null), false);
});
