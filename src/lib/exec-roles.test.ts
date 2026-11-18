import assert from "node:assert/strict";
import { test } from "node:test";

import { isExecutive } from "./exec-roles.ts";
import type { UserRole } from "../types/database.ts";

const ALL_ROLES: UserRole[] = ["super_admin", "head", "staff", "room_staff", "cleaning_staff", "executive", "budget_deputy", "user"];

test("executive and budget_deputy are summary-only executives", () => {
  assert.equal(isExecutive("executive"), true);
  assert.equal(isExecutive("budget_deputy"), true);
});

test("no other role, and nobody signed out, is an executive", () => {
  for (const role of ALL_ROLES.filter((r) => r !== "executive" && r !== "budget_deputy")) assert.equal(isExecutive(role), false, role);
  assert.equal(isExecutive(null), false);
  assert.equal(isExecutive(undefined), false);
});
