import assert from "node:assert/strict";
import { test } from "node:test";

import { navGroups } from "./nav.ts";

const headings = (role: Parameters<typeof navGroups>[0]) => navGroups(role).map((g) => g.heading);
const hrefs = (role: Parameters<typeof navGroups>[0]) =>
  navGroups(role).flatMap((g) => g.items.map((i) => i.href));

test("executives see only the summary", () => {
  assert.deepEqual(hrefs("executive"), ["/summary"]);
});

test("teachers and signed-out visitors have no manage group", () => {
  for (const role of ["user", null] as const)
    assert.deepEqual(headings(role), [null, "งานอาคารสถานที่", "งานอื่น"]);
});

test("the unbuilt modules are disabled entries under งานอื่น", () => {
  const other = navGroups("user").find((g) => g.heading === "งานอื่น");
  assert.deepEqual(other?.items.map((i) => [i.label, i.href, i.soon]), [
    ["สำมะโนผู้เรียน", null, true],
    ["ควบคุมภายใน", null, true],
  ]);
});

test("staff roles get memos; only the administrator gets the rest", () => {
  for (const role of ["staff", "head", "room_staff"] as const) {
    assert.ok(hrefs(role).includes("/memos"));
    assert.ok(!hrefs(role).includes("/users"));
  }
  assert.deepEqual(hrefs("super_admin").slice(-5), ["/memos", "/summary", "/feedback", "/users", "/trash"]);
});
