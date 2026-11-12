import test from "node:test";
import assert from "node:assert/strict";

import { canDeleteMemo } from "./delete-rule.ts";

const mine = { author_id: "u1", final_status: "pending" };

test("the administrator deletes any memo", () => {
  assert.equal(canDeleteMemo("super_admin", "admin1", mine), true);
  assert.equal(canDeleteMemo("super_admin", "admin1", { author_id: "u1", final_status: "approved" }), true);
});

test("staff and heads delete their own memo while it is still a draft (pending)", () => {
  assert.equal(canDeleteMemo("staff", "u1", mine), true);
  assert.equal(canDeleteMemo("head", "u1", mine), true);
});

test("staff cannot delete someone else's memo", () => {
  assert.equal(canDeleteMemo("staff", "u2", mine), false);
  assert.equal(canDeleteMemo("head", "u2", mine), false);
});

test("staff cannot delete their own memo once it has been decided", () => {
  for (const final_status of ["approved", "rejected", "revision_requested"])
    assert.equal(canDeleteMemo("staff", "u1", { author_id: "u1", final_status }), false);
});

test("other roles and unknown viewers never delete", () => {
  for (const role of ["user", "room_staff", "executive", undefined] as const)
    assert.equal(canDeleteMemo(role, "u1", mine), false);
  assert.equal(canDeleteMemo("staff", undefined, mine), false);
});
