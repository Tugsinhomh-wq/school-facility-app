import test from "node:test";
import assert from "node:assert/strict";

import { draftFromTickets } from "./draft.ts";
import type { TicketRow } from "../../types/tickets.ts";

const ticket = (over: Partial<TicketRow> & { id: string; created_at: string }): TicketRow =>
  ({
    ticket_number: `REQ-202611-000${over.id}`,
    reporter_id: "u1",
    building_id: "b1",
    room_id: null,
    location_detail: null,
    title: "หลอดไฟขาด",
    description: "หลอดไฟขาด",
    urgency: "medium",
    status: "pending",
    image_urls: [],
    estimated_cost: 0,
    technician_notes: null,
    updated_at: over.created_at,
    building: { name: "อาคาร 1" },
    room: { room_number: "112", name: "ห้อง 112" },
    reporter: { full_name: "ครู ก" },
    ...over,
  }) as TicketRow;

const t1 = ticket({ id: "1", created_at: "2026-11-01T03:00:00Z" });
const t2 = ticket({ id: "2", created_at: "2026-11-03T03:00:00Z", title: "ประตูเสีย", description: "บานพับหลุด", technician_notes: "ต้องเปลี่ยนบานพับ" });
const t3 = ticket({ id: "3", created_at: "2026-11-05T03:00:00Z", room: null, location_detail: "หน้าอาคาร" });

test("subject, recipient and empty proposal follow the combined form", () => {
  const d = draftFromTickets([t1, t2, t3]);
  assert.equal(d.subject, "ขออนุมัติซ่อมแซมอาคารสถานที่ อาคาร 1 จำนวน 3 รายการ");
  assert.equal(d.recipient, "ผู้อำนวยการโรงเรียนละหานทรายรัชดาภิเษก");
  assert.equal(d.proposal, "");
});

test("body is an opening paragraph, numbered items oldest first, and a total line", () => {
  const lines = draftFromTickets([t3, t1, t2]).body_content.split("\n");
  assert.equal(lines.length, 5);
  assert.match(lines[1], /^1\. /);
  assert.match(lines[2], /^2\. /);
  assert.match(lines[3], /^3\. /);
  assert.ok(lines[1].includes("REQ-202611-0001"));
  assert.ok(lines[3].includes("REQ-202611-0003"));
  assert.equal(lines[4], "รวมทั้งสิ้น 3 รายการ");
});

test("an item shows the damage detail and the technician notes when present", () => {
  const lines = draftFromTickets([t1, t2]).body_content.split("\n");
  assert.ok(lines[2].includes("ประตูเสีย"));
  assert.ok(lines[2].includes("บานพับหลุด"));
  assert.ok(lines[2].includes("ต้องเปลี่ยนบานพับ"));
  assert.equal(lines[1].includes("ต้องเปลี่ยนบานพับ"), false);
});

test("the opening says เร่งด่วน only when a ticket is high or emergency", () => {
  const calm = draftFromTickets([t1, t2]).body_content.split("\n")[0];
  assert.ok(calm.includes("โดยเร็ว"));
  assert.equal(calm.includes("อย่างเร่งด่วน"), false);
  const urgent = draftFromTickets([t1, ticket({ id: "4", created_at: "2026-11-06T03:00:00Z", urgency: "emergency" })]).body_content.split("\n")[0];
  assert.ok(urgent.includes("อย่างเร่งด่วน"));
});

test("there is no cost section", () => {
  const body = draftFromTickets([t1, t2, t3]).body_content;
  assert.equal(body.includes("บาท"), false);
  assert.equal(body.includes("ค่าใช้จ่าย"), false);
});

test("a ticket with no room and no spot still reads cleanly", () => {
  const bare = ticket({ id: "5", created_at: "2026-11-07T03:00:00Z", room: null, location_detail: null });
  const noBuilding = ticket({ id: "6", created_at: "2026-11-08T03:00:00Z", room: null, building: null });
  const body = draftFromTickets([bare, noBuilding]).body_content;
  assert.equal(body.includes("undefined"), false);
  assert.equal(body.includes("null"), false);
  assert.ok(body.split("\n")[2].includes("บริเวณโรงเรียน"));
});

test("the input array is not reordered", () => {
  const input = [t3, t1, t2];
  draftFromTickets(input);
  assert.deepEqual(input.map((t) => t.id), ["3", "1", "2"]);
});
