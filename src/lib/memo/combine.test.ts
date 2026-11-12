import test from "node:test";
import assert from "node:assert/strict";

import { COMBINE_MAX, COMBINE_MIN, liveSelection, parseTicketIds, selectableTicket } from "./combine.ts";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ids = (count: number) => Array.from({ length: count }, (_, i) => id(i + 1));

test("the bounds are 2 and 20", () => {
  assert.equal(COMBINE_MIN, 2);
  assert.equal(COMBINE_MAX, 20);
});

test("two valid ids are accepted in the order given", () => {
  assert.deepEqual(parseTicketIds([id(2), id(1)]), [id(2), id(1)]);
});

test("a repeated id is counted once, so a pair of the same id is too few", () => {
  assert.equal(parseTicketIds([id(1), id(1)]), null);
  assert.deepEqual(parseTicketIds([id(1), id(2), id(1)]), [id(1), id(2)]);
});

test("one ticket is too few", () => {
  assert.equal(parseTicketIds([id(1)]), null);
  assert.equal(parseTicketIds([]), null);
});

test("20 tickets pass and 21 do not", () => {
  assert.equal(parseTicketIds(ids(20))?.length, 20);
  assert.equal(parseTicketIds(ids(21)), null);
});

test("anything that is not a UUID string refuses the whole list", () => {
  assert.equal(parseTicketIds([id(1), "abc"]), null);
  assert.equal(parseTicketIds([id(1), null]), null);
  assert.equal(parseTicketIds([id(1), new File([""], "x.txt")]), null);
  assert.equal(parseTicketIds([id(1), id(2).toUpperCase().slice(0, 35)]), null);
});

test("selectableTicket allows any ticket until one is picked, then only the same building", () => {
  assert.equal(selectableTicket(null, "b1"), true);
  assert.equal(selectableTicket("b1", "b1"), true);
  assert.equal(selectableTicket("b1", "b2"), false);
});

test("liveSelection drops picked ids that are no longer in the list, keeping the order", () => {
  assert.deepEqual(liveSelection([id(3), id(1), id(2)], [id(1), id(2)]), [id(1), id(2)]);
  assert.deepEqual(liveSelection([id(1), id(2)], [id(1), id(2), id(3)]), [id(1), id(2)]);
  assert.deepEqual(liveSelection([id(5)], [id(1)]), []);
  assert.deepEqual(liveSelection([], [id(1)]), []);
});
