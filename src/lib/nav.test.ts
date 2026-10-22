import assert from "node:assert/strict";
import { test } from "node:test";

import { navGroups } from "./nav.ts";

const headings = (role: Parameters<typeof navGroups>[0]) => navGroups(role).map((g) => g.heading);
const hrefs = (role: Parameters<typeof navGroups>[0]) =>
  navGroups(role).flatMap((g) => g.items.map((i) => i.href));

test("executives see only the summary", () => {
  assert.deepEqual(hrefs("executive"), ["/summary"]);
});

test("teachers have no manage group; signed-out visitors have no งานอื่น either", () => {
  assert.deepEqual(headings("user"), [null, "งานอาคารสถานที่", "งานอื่น"]);
  assert.deepEqual(headings(null), [null, "งานอาคารสถานที่"]);
});

test("under งานอื่น census and control are both built links, no เร็วๆ นี้ entry", () => {
  const other = navGroups("user").find((g) => g.heading === "งานอื่น");
  assert.deepEqual(other?.items.map((i) => [i.label, i.href, i.soon]), [
    ["สำมะโนผู้เรียน", "/census", undefined],
    ["ควบคุมภายใน", "/control", undefined],
  ]);
});

test("signed-out visitors and executives do not get the census or control entries", () => {
  for (const href of ["/census", "/control"]) {
    assert.ok(!hrefs(null).includes(href));
    assert.ok(!hrefs("executive").includes(href));
    assert.ok(hrefs("head").includes(href));
  }
});

test("staff roles get memos; only the administrator gets the rest", () => {
  for (const role of ["staff", "head", "room_staff"] as const) {
    assert.ok(hrefs(role).includes("/memos"));
    assert.ok(!hrefs(role).includes("/users"));
  }
  assert.deepEqual(hrefs("super_admin").slice(-5), ["/memos", "/summary", "/feedback", "/users", "/trash"]);
});
