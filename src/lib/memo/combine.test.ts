import test from "node:test";
import assert from "node:assert/strict";

import { COMBINE_MAX, COMBINE_MIN, GROUP_MAX, groupFieldName, liveSelection, parseGroups, parseTicketIds } from "./combine.ts";

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

test("groupFieldName is group_ plus the ticket id", () => {
  assert.equal(groupFieldName(id(1)), `group_${id(1)}`);
  assert.equal(GROUP_MAX, 9);
});

test("parseGroups keeps whole numbers 1 to 9 and drops everything else", () => {
  const form: Record<string, unknown> = {
    [groupFieldName(id(1))]: "1",
    [groupFieldName(id(2))]: "9",
    [groupFieldName(id(3))]: "0",
    [groupFieldName(id(4))]: "10",
    [groupFieldName(id(5))]: "abc",
    [groupFieldName(id(6))]: "",
    [groupFieldName(id(7))]: null,
    [groupFieldName(id(8))]: new File([""], "x.txt"),
    [groupFieldName(id(9))]: "1.5",
  };
  assert.deepEqual(parseGroups(ids(9), (n) => form[n]), { [id(1)]: 1, [id(2)]: 9 });
});

test("parseGroups reads only the fields of the listed ids", () => {
  const asked: string[] = [];
  const out = parseGroups([id(1)], (n) => {
    asked.push(n);
    return "2";
  });
  assert.deepEqual(asked, [groupFieldName(id(1))]);
  assert.deepEqual(out, { [id(1)]: 2 });
  assert.deepEqual(parseGroups(ids(2), () => undefined), {});
});

test("liveSelection drops picked ids that are no longer in the list, keeping the order", () => {
  assert.deepEqual(liveSelection([id(3), id(1), id(2)], [id(1), id(2)]), [id(1), id(2)]);
  assert.deepEqual(liveSelection([id(1), id(2)], [id(1), id(2), id(3)]), [id(1), id(2)]);
  assert.deepEqual(liveSelection([id(5)], [id(1)]), []);
  assert.deepEqual(liveSelection([], [id(1)]), []);
});
