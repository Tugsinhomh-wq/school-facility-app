import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { canComment, cleanComment, COMMENT_MAX, COMMENT_ROLES, threadView } from "./ticket-comments.ts";
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

const SQL = readFileSync(new URL("../../supabase/budget_deputy_02_comments.sql", import.meta.url), "utf8");

test("the SQL stamps the author name from the caller's profile, so it cannot be forged", () => {
  assert.ok(SQL.includes("BEFORE INSERT ON public.repair_ticket_comments"));
  assert.ok(SQL.includes("NEW.author_name :="));
});

test("the SQL keeps the deputy out of cleaning staff's advisor lookup, like executives", () => {
  const policy = SQL.slice(SQL.indexOf('"profiles: cleaning staff read non-executives"'));
  assert.ok(policy.includes("'budget_deputy'::public.user_role"));
});

const SQL3 = readFileSync(new URL("../../supabase/budget_deputy_03_share.sql", import.meta.url), "utf8");

test("the share SQL replaces the deputy's read-all ticket policy with a read-shared one", () => {
  assert.ok(SQL3.includes('DROP POLICY IF EXISTS "tickets: budget deputy read all"'));
  const created = SQL3.slice(SQL3.indexOf('CREATE POLICY "tickets: budget deputy read shared"'));
  assert.ok(created.startsWith('CREATE POLICY "tickets: budget deputy read shared"'));
  assert.ok(created.slice(0, 400).includes("repair_ticket_shares"));
});

test("the share SQL narrows the deputy's photo policy to shared tickets", () => {
  const at = SQL3.indexOf('DROP POLICY IF EXISTS "repair images: budget deputy read"');
  assert.ok(at >= 0);
  assert.ok(SQL3.slice(at, at + 700).includes("image_urls"));
});

test("the share goes in with its first comment in one function", () => {
  const fn = SQL3.slice(SQL3.indexOf("share_ticket_with_budget"));
  assert.ok(fn.includes("INSERT INTO public.repair_ticket_shares"));
  assert.ok(fn.includes("INSERT INTO public.repair_ticket_comments"));
});

test("file 02 no longer creates the deputy's read-all ticket or photo policies, so running it again cannot undo file 03", () => {
  assert.ok(!SQL.includes('CREATE POLICY "tickets: budget deputy read all"'));
  assert.ok(!SQL.includes('CREATE POLICY "repair images: budget deputy read"'));
});

test("the thread is shown when the ticket is sent or an old thread exists, and posting needs the ticket to be sent", () => {
  assert.deepEqual(threadView(true, 0), { show: true, canPost: true });
  assert.deepEqual(threadView(true, 3), { show: true, canPost: true });
  assert.deepEqual(threadView(false, 3), { show: true, canPost: false });
  assert.deepEqual(threadView(false, 0), { show: false, canPost: false });
});
