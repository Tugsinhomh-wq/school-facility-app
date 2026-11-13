import assert from "node:assert/strict";
import { test } from "node:test";

import { isCleaningManager } from "./cleaning-access.ts";

test("staff, head, admin and the cleaning-zone officer manage the cleaning module", () => {
  for (const role of ["staff", "head", "super_admin", "cleaning_staff"] as const)
    assert.equal(isCleaningManager(role), true, role);
});

test("teachers, the meeting-room officer, executives and signed-out visitors do not", () => {
  for (const role of ["user", "room_staff", "executive", null, undefined] as const)
    assert.equal(isCleaningManager(role), false, String(role));
});
