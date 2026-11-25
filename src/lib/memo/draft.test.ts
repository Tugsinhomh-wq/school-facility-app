import test from "node:test";
import assert from "node:assert/strict";

import { draftFromTicket, draftFromTickets } from "./draft.ts";
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

test("the ticket number is not wrapped in parentheses: LibreOffice splits \"(เลขที่งาน\" mid-syllable at a line end", () => {
  const combined = draftFromTickets([t1, t2, t3]).body_content;
  assert.equal(combined.includes("(เลขที่งาน"), false);
  assert.ok(combined.includes("เลขที่งาน REQ-202611-0001 แจ้งเมื่อ"));
  const single = draftFromTicket(t1, { full_name: "นายทดสอบ ระบบ", position: "ครู" }).body_content;
  assert.equal(single.includes("(เลขที่งาน"), false);
  assert.ok(single.includes("เลขที่งาน REQ-202611-0001"));
});

const hdmi1 = ticket({ id: "11", created_at: "2026-11-02T03:00:00Z", title: "สาย HDMI เสีย", description: "สาย HDMI เสีย", room: { room_number: "101", name: "ห้อง 101" } });
const hdmi2 = ticket({ id: "12", created_at: "2026-11-04T03:00:00Z", title: "สาย HDMI ชำรุด", description: "สาย HDMI ชำรุด", building: { name: "อาคาร 2" }, room: { room_number: "203", name: "ห้อง 203" } });

test("tickets in one group become one item that names every place and ticket number", () => {
  const d = draftFromTickets([hdmi1, t2, hdmi2], { "11": 1, "12": 1 });
  const lines = d.body_content.split("\n");
  assert.equal(lines.length, 4);
  assert.match(lines[1], /^1\. สาย HDMI เสีย จำนวน 2 จุด ได้แก่ /);
  assert.ok(lines[1].includes("อาคาร 1 ห้อง 101") && lines[1].includes("อาคาร 2 ห้อง 203"));
  assert.ok(lines[1].includes("REQ-202611-00011") && lines[1].includes("REQ-202611-00012"));
  assert.match(lines[2], /^2\. .*ประตูเสีย/);
  assert.equal(lines[3], "รวมทั้งสิ้น 3 รายการ");
  assert.equal(d.body_content.includes("(เลขที่งาน"), false);
});

test("orderedIds lists each item's tickets together, items by their first ticket", () => {
  const d = draftFromTickets([hdmi2, t2, hdmi1], { "11": 1, "12": 1 });
  assert.deepEqual(d.orderedIds, ["11", "12", "2"]);
  assert.deepEqual(draftFromTickets([t3, t1, t2]).orderedIds, ["1", "2", "3"]);
});

test("a group of one ticket reads exactly like an ungrouped item", () => {
  assert.equal(draftFromTickets([t1, t2], { "1": 3 }).body_content, draftFromTickets([t1, t2]).body_content);
  assert.equal(draftFromTickets([t1, t2], { "1": 3 }).body_content.includes("จำนวน 1 จุด"), false);
});

test("tickets of two buildings give a generic subject and an opening that names both buildings", () => {
  const d = draftFromTickets([hdmi1, hdmi2]);
  assert.equal(d.subject, "ขออนุมัติซ่อมแซมอาคารสถานที่ จำนวน 2 รายการ");
  const opening = d.body_content.split("\n")[0];
  assert.ok(opening.includes("อาคาร 1") && opening.includes("อาคาร 2"));
  assert.equal(draftFromTickets([t1, t2]).subject, "ขออนุมัติซ่อมแซมอาคารสถานที่ อาคาร 1 จำนวน 2 รายการ");
});

test("a grouped item carries the technician notes of its tickets", () => {
  const noted = ticket({ id: "13", created_at: "2026-11-05T03:00:00Z", title: "สาย HDMI เสีย", technician_notes: "ใช้สายยาว 5 เมตร" });
  const line = draftFromTickets([hdmi1, noted], { "11": 2, "13": 2 }).body_content.split("\n")[1];
  assert.ok(line.includes("ใช้สายยาว 5 เมตร"));
});

test("grouped tickets with a missing building or place still read cleanly and the input is not reordered", () => {
  const noBuilding = ticket({ id: "14", created_at: "2026-11-06T03:00:00Z", title: "สาย HDMI เสีย", room: null, building: null });
  const input = [noBuilding, hdmi2, hdmi1];
  const body = draftFromTickets(input, { "11": 1, "12": 1, "14": 1 }).body_content;
  assert.equal(body.includes("undefined"), false);
  assert.equal(body.includes("null"), false);
  assert.ok(body.includes("บริเวณโรงเรียน"));
  assert.deepEqual(input.map((t) => t.id), ["14", "12", "11"]);
});

test("two groups and an ungrouped ticket make three items numbered by first ticket", () => {
  const w1 = ticket({ id: "21", created_at: "2026-11-07T03:00:00Z", title: "หน้าต่างแตก", description: "หน้าต่างแตก" });
  const w2 = ticket({ id: "22", created_at: "2026-11-08T03:00:00Z", title: "หน้าต่างแตก", description: "หน้าต่างแตก", building: { name: "อาคาร 3" } });
  const lines = draftFromTickets([w2, hdmi1, t2, w1, hdmi2], { "11": 1, "12": 1, "21": 2, "22": 2 }).body_content.split("\n");
  assert.equal(lines.length, 5);
  assert.match(lines[1], /^1\. สาย HDMI เสีย จำนวน 2 จุด/);
  assert.match(lines[2], /^2\. .*ประตูเสีย/);
  assert.match(lines[3], /^3\. หน้าต่างแตก จำนวน 2 จุด/);
  assert.equal(lines[4], "รวมทั้งสิ้น 5 รายการ");
});
