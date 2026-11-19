import assert from "node:assert/strict";
import { test } from "node:test";

import { groupBacklog, type BacklogTicket } from "./backlog.ts";

const NOW = Date.parse("2026-11-18T05:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

let n = 0;
const ticket = (over: Partial<BacklogTicket> = {}): BacklogTicket => ({
  id: `t${++n}`,
  ticket_number: `REQ-${n}`,
  title: "ก๊อกน้ำรั่ว",
  urgency: "medium",
  status: "pending",
  created_at: hoursAgo(1),
  duplicate_of: null,
  location_detail: null,
  building: { name: "อาคาร 1" },
  room: { room_number: "101", name: "ห้อง 101" },
  ...over,
});
const none = new Set<string>();

test("tickets are grouped by building, buildings sorted by name, with the open count", () => {
  const { groups } = groupBacklog([ticket({ building: { name: "อาคาร 2" } }), ticket(), ticket()], none, NOW);
  assert.deepEqual(groups.map((g) => [g.building, g.total]), [["อาคาร 1", 2], ["อาคาร 2", 1]]);
});

test("urgent counts high and emergency only", () => {
  const { groups } = groupBacklog(
    [ticket({ urgency: "low" }), ticket({ urgency: "medium" }), ticket({ urgency: "high" }), ticket({ urgency: "emergency" })],
    none,
    NOW,
  );
  assert.equal(groups[0].urgent, 2);
});

test("rows inside a building sort numerically by place", () => {
  const room = (name: string) => ticket({ room: { room_number: name, name } });
  const { groups } = groupBacklog([room("ห้อง 10"), room("ห้อง 2")], none, NOW);
  assert.deepEqual(groups[0].rows.map((r) => r.place), ["ห้อง 2", "ห้อง 10"]);
});

test("the place falls back from room name to room number to location detail to a default", () => {
  const rows = groupBacklog(
    [
      ticket({ room: { room_number: "5", name: null }, location_detail: "x" }),
      ticket({ room: null, location_detail: "หน้าอาคาร" }),
      ticket({ room: null, location_detail: null }),
    ],
    none,
    NOW,
  ).groups[0].rows.map((r) => r.place);
  assert.deepEqual([...rows].sort(), ["5", "หน้าอาคาร", "ไม่ระบุจุด"].sort());
});

test("a ticket with no building lands under ไม่ระบุอาคาร", () => {
  const { groups } = groupBacklog([ticket({ building: null })], none, NOW);
  assert.equal(groups[0].building, "ไม่ระบุอาคาร");
});

test("an unread ticket is listed on top and stays in its building with unread set", () => {
  const read = ticket();
  const unread = ticket();
  const result = groupBacklog([read, unread], new Set([unread.id]), NOW);
  assert.deepEqual(result.unread.map((r) => r.id), [unread.id]);
  assert.equal(result.groups[0].total, 2);
  assert.deepEqual(result.groups[0].rows.filter((r) => r.unread).map((r) => r.id), [unread.id]);
});

test("ageDays counts whole days since the ticket was reported", () => {
  const { groups } = groupBacklog([ticket({ created_at: hoursAgo(1) }), ticket({ created_at: hoursAgo(84) })], none, NOW);
  assert.deepEqual(groups[0].rows.map((r) => r.ageDays).sort(), [0, 3]);
});

test("an unread ticket that is already closed is listed on top but never counted in a building", () => {
  const open = ticket();
  const closed = ticket({ status: "completed" });
  const result = groupBacklog([open, closed], new Set([closed.id]), NOW);
  assert.deepEqual(result.unread.map((r) => r.id), [closed.id]);
  assert.equal(result.groups[0].total, 1);
  assert.deepEqual(result.groups[0].rows.map((r) => r.id), [open.id]);
});

test("a merged duplicate is never counted in a building, even when it holds an unread comment", () => {
  const merged = ticket({ duplicate_of: "other" });
  const result = groupBacklog([merged], new Set([merged.id]), NOW);
  assert.deepEqual(result.unread.map((r) => r.id), [merged.id]);
  assert.deepEqual(result.groups, []);
});

test("a closed ticket goes to the closed list, newest first, and keeps its unread flag", () => {
  const older = ticket({ status: "completed", created_at: hoursAgo(72) });
  const newer = ticket({ status: "cancelled", created_at: hoursAgo(5) });
  const { closed, groups } = groupBacklog([older, newer], new Set([older.id]), NOW);
  assert.deepEqual(closed.map((r) => [r.id, r.unread]), [[newer.id, false], [older.id, true]]);
  assert.deepEqual(groups, []);
});

test("an open ticket is never in the closed list", () => {
  assert.deepEqual(groupBacklog([ticket()], none, NOW).closed, []);
});

test("an empty backlog gives no groups", () => {
  assert.deepEqual(groupBacklog([], none, NOW), { unread: [], groups: [], closed: [] });
});
