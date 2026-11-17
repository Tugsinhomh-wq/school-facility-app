import test from "node:test";
import assert from "node:assert/strict";

import { clashOf, earliestFit, nextFit, splitRooms, type Seg } from "./meeting-finder.ts";

const h = (hh: number, mm = 0) => hh * 60 + mm;
const CLOSE = h(20);
const segs: Seg[] = [
  { id: "a", roomId: "r1", start: h(9), end: h(10, 30) },
  { id: "b", roomId: "r1", start: h(13), end: h(15) },
  { id: "c", roomId: "r2", start: h(8), end: h(12) },
];

test("a booking that only touches the asked time does not clash", () => {
  assert.equal(clashOf(segs, "r1", h(10, 30), h(11, 30)), undefined);
  assert.equal(clashOf(segs, "r1", h(8), h(9)), undefined);
  assert.equal(clashOf(segs, "r1", h(10), h(11))?.id, "a");
});

test("rooms split into free and busy, in the order given", () => {
  const { free, busy } = splitRooms(["r1", "r2", "r3"], segs, h(10), h(1), CLOSE);
  assert.deepEqual(free, ["r3"]);
  assert.deepEqual(busy.map((b) => b.roomId), ["r1", "r2"]);
  assert.equal(busy[0].clash.id, "a");
});

test("the next fit skips past the booking and keeps to half hours", () => {
  assert.equal(nextFit(segs, "r1", h(9), h(1), CLOSE), h(10, 30));
  assert.equal(nextFit(segs, "r1", h(11), h(2), CLOSE), h(11)); // 11:00-13:00 just fits before 13:00
  assert.equal(nextFit(segs, "r1", h(11), h(3), CLOSE), h(15)); // three hours only fit after 15:00
  assert.equal(nextFit(segs, "r1", h(8, 10), h(30) / 60, CLOSE), h(8, 30));
});

test("no fit before closing time is null", () => {
  assert.equal(nextFit(segs, "r1", h(15), h(6), CLOSE), null);
  assert.equal(nextFit([], "r9", h(19, 30), h(1), CLOSE), null);
});

test("the earliest fit picks the soonest room", () => {
  const { busy } = splitRooms(["r1", "r2"], segs, h(9), h(2), CLOSE);
  // r1 fits two hours from 10:30, r2 only from 12:00
  assert.deepEqual(earliestFit(busy), { roomId: "r1", start: h(10, 30) });
  assert.equal(earliestFit([]), null);
});
