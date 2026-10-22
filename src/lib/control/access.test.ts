import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canEditProject, canReview } from "./access.ts";
import type { UserRole } from "../../types/database.ts";

// Record<UserRole, true> makes `tsc` fail here when a role is added to UserRole but not to this list.
const ROLE_MAP: Record<UserRole, true> = {
  super_admin: true,
  head: true,
  staff: true,
  room_staff: true,
  executive: true,
  user: true,
};
const ALL_ROLES = Object.keys(ROLE_MAP) as UserRole[];
const OFFICERS: UserRole[] = ["staff", "head", "super_admin"];
const NON_OFFICERS = ALL_ROLES.filter((r) => !OFFICERS.includes(r));

const open = { ownerId: "owner-1", confirmed: false };
const done = { ownerId: "owner-1", confirmed: true };
const owner = (role: UserRole | null) => ({ userId: "owner-1", role });
const other = (role: UserRole | null) => ({ userId: "someone-else", role });

test("an owner can edit their project until the head confirms it", () => {
  assert.equal(canEditProject(open, owner("user")), true);
  assert.equal(canEditProject(open, owner(null)), true);
});

test("an owner cannot edit a confirmed project", () => {
  assert.equal(canEditProject(done, owner("user")), false);
  assert.equal(canEditProject(done, owner(null)), false);
});

test("another ordinary user cannot edit, confirmed or not", () => {
  assert.equal(canEditProject(open, other("user")), false);
  assert.equal(canEditProject(done, other("user")), false);
});

test("staff, head and super_admin can edit every project in every state", () => {
  for (const role of OFFICERS) {
    for (const p of [open, done]) {
      assert.equal(canEditProject(p, other(role)), true, `${role} (not owner, confirmed=${p.confirmed})`);
      assert.equal(canEditProject(p, owner(role)), true, `${role} (owner, confirmed=${p.confirmed})`);
    }
  }
});

test("executive, user, room_staff and no role cannot edit someone else's project", () => {
  for (const role of [...NON_OFFICERS, null]) {
    for (const p of [open, done]) {
      assert.equal(canEditProject(p, other(role)), false, `${role} (confirmed=${p.confirmed})`);
    }
  }
});

test("canReview is true for officers only", () => {
  for (const role of OFFICERS) assert.equal(canReview(role), true, role);
  for (const role of NON_OFFICERS) assert.equal(canReview(role), false, role);
  assert.equal(canReview(null), false);
  assert.equal(canReview(undefined), false);
});

// session.ts pulls in next/headers so the test runner cannot import it. Read the role list
// out of its source instead, so the two definitions cannot drift apart unnoticed.
function staffRolesInSession(): UserRole[] {
  const src = readFileSync(new URL("../data/session.ts", import.meta.url), "utf8");
  const m = src.match(/export const isStaffRole\s*=[^;]*;/);
  assert.ok(m, "isStaffRole definition not found in data/session.ts");
  return [...m[0].matchAll(/role === "([a-z_]+)"/g)].map((x) => x[1] as UserRole);
}

test("canReview matches isStaffRole in data/session.ts for every UserRole", () => {
  const staff = new Set(staffRolesInSession());
  assert.ok(staff.size > 0);
  for (const role of ALL_ROLES) assert.equal(canReview(role), staff.has(role), role);
  for (const role of staff) assert.ok(role in ROLE_MAP, `unknown role ${role} in isStaffRole`);
});
