import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { canComment, cleanComment, COMMENT_MAX, COMMENT_ROLES } from "./ticket-comments.ts";
import type { UserRole } from "../types/database.ts";

const ALL_ROLES: UserRole[] = ["super_admin", "head", "staff", "room_staff", "cleaning_staff", "executive", "budget_deputy", "user"];

test("only the deputy, heads, staff and the administrator can use the thread", () => {
  for (const role of ALL_ROLES) assert.equal(canComment(role), COMMENT_ROLES.includes(role), role);
  assert.deepEqual([...COMMENT_ROLES].sort(), ["budget_deputy", "head", "staff", "super_admin"]);
  assert.equal(canComment(null), false);
  assert.equal(canComment(undefined), false);
});

test("the thread policies in SQL name the same roles (head is covered by staff)", () => {
  const sql = readFileSync(new URL("../../supabase/budget_deputy_02_comments.sql", import.meta.url), "utf8");
  assert.ok(sql.includes("current_role_is('budget_deputy', 'staff', 'super_admin')"));
  assert.deepEqual(COMMENT_ROLES.filter((r) => r !== "head").sort(), ["budget_deputy", "staff", "super_admin"]);
});

test("cleanComment trims the text", () => {
  assert.equal(cleanComment("  สวัสดี  "), "สวัสดี");
});

test("cleanComment refuses empty, blank and non-text input", () => {
  for (const bad of ["", "   ", "\n\t", null, undefined, 42]) assert.equal(cleanComment(bad), null, String(bad));
});

test("cleanComment accepts 1000 characters and refuses 1001", () => {
  assert.equal(COMMENT_MAX, 1000);
  assert.equal(cleanComment("ก".repeat(1000))?.length, 1000);
  assert.equal(cleanComment("ก".repeat(1001)), null);
});
