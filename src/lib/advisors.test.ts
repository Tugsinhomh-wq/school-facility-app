import test from "node:test";
import assert from "node:assert/strict";
import { advisorDiff, groupRoomsByLevel, levelOf, parseUuidList, planAdvisorSave, sameIdSet } from "./advisors.ts";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("levelOf takes the level before the slash", () => {
  assert.equal(levelOf("ม.1/1"), "ม.1");
  assert.equal(levelOf(" ม. 6/12 "), "ม.6");
  assert.equal(levelOf("ม.7/1"), "อื่น ๆ");
  assert.equal(levelOf("ห้องสมุด"), "อื่น ๆ");
});

test("rooms group by level in order, others last", () => {
  const rooms = ["ม.2/1", "ห้องพิเศษ", "ม.1/10", "ม.1/2", "ม.1/1"].map((name) => ({ name }));
  const g = groupRoomsByLevel(rooms);
  assert.deepEqual(g.map((x) => x.level), ["ม.1", "ม.2", "อื่น ๆ"]);
  assert.deepEqual(g[0].rooms.map((r) => r.name), ["ม.1/1", "ม.1/2", "ม.1/10"]);
  assert.deepEqual(groupRoomsByLevel([]), []);
});

test("uuid list: dedupes, lower-cases, rejects anything else", () => {
  assert.deepEqual(parseUuidList([id(1), id(1), id(2).toUpperCase()]), [id(1), id(2)]);
  assert.deepEqual(parseUuidList([]), []);
  assert.equal(parseUuidList([id(1), "nope"]), null);
  assert.equal(parseUuidList([id(1), null]), null);
  assert.equal(parseUuidList(Array.from({ length: 201 }, (_, i) => id(i))), null);
});

test("diff adds the missing and removes the unticked", () => {
  assert.deepEqual(advisorDiff([id(1), id(2)], [id(2), id(3)], [id(1), id(2), id(3)]), { add: [id(1)], remove: [id(3)] });
});

test("diff ignores unknown ids, dedupes, and never touches other terms", () => {
  const term = [id(1), id(2)];
  // id(9) is another term's room the user already advises; id(8) is unknown.
  const d = advisorDiff([id(1), id(1), id(8)], [id(2), id(9)], term);
  assert.deepEqual(d, { add: [id(1)], remove: [id(2)] });
  assert.deepEqual(advisorDiff([], [id(9)], term), { add: [], remove: [] });
});

test("diff with nothing changed is empty", () => {
  assert.deepEqual(advisorDiff([id(1)], [id(1)], [id(1)]), { add: [], remove: [] });
});

test("uuid list: exactly 200 ids pass, a File value is rejected", () => {
  assert.equal(parseUuidList(Array.from({ length: 200 }, (_, i) => id(i)))?.length, 200);
  assert.equal(parseUuidList([new File([""], "a.txt")]), null);
});

test("level of a two-digit class number is not a level", () => {
  assert.equal(levelOf("ม.10/1"), "อื่น ๆ");
});

test("sameIdSet ignores order, case and duplicates", () => {
  assert.equal(sameIdSet([id(1), id(2)], [id(2).toUpperCase(), id(1), id(1)]), true);
  assert.equal(sameIdSet([id(1)], [id(1), id(2)]), false);
  assert.equal(sameIdSet([], []), true);
});

test("plan: diffs over the shown rooms when they match the current set", () => {
  const all = [id(1), id(2), id(3)];
  assert.deepEqual(planAdvisorSave(all, [id(1)], [id(2), id(9)], all), { add: [id(1)], remove: [id(2)] });
  assert.deepEqual(planAdvisorSave(all.map((x) => x.toUpperCase()), [id(3).toUpperCase()], [], all), { add: [id(3)], remove: [] });
});

test("plan: refuses when a room appeared or vanished since the page loaded", () => {
  const shown = [id(1), id(2)];
  assert.deepEqual(planAdvisorSave(shown, [id(1)], [], [...shown, id(3)]), { error: "stale" });
  assert.deepEqual(planAdvisorSave(shown, [id(1)], [], [id(1)]), { error: "stale" });
});

test("plan: empty shown is refused, even with nothing ticked", () => {
  assert.deepEqual(planAdvisorSave([], [], [id(1)], [id(1)]), { error: "stale" });
  assert.deepEqual(planAdvisorSave([], [], [], []), { error: "stale" });
});

test("plan: ticked ids that were not shown are refused; duplicates are fine", () => {
  const shown = [id(1), id(2)];
  assert.deepEqual(planAdvisorSave(shown, [id(8)], [], shown), { error: "unshown" });
  assert.deepEqual(planAdvisorSave([...shown, id(1)], [id(1), id(1)], [], shown), { add: [id(1)], remove: [] });
});
