import test from "node:test";
import assert from "node:assert/strict";

import { buildPhotoGroups, photoHeading, type PhotoTicket } from "./photo-groups.ts";

const ticket = (over: Partial<PhotoTicket> = {}): PhotoTicket => ({
  title: "หลอดไฟขาด",
  location_detail: null,
  building: { name: "อาคาร 2" },
  room: { name: "ห้อง 213" },
  image_urls: [],
  ticket_number: "REQ-202611-0007",
  ...over,
});

test("a single memo caption is place – title", () => {
  assert.equal(photoHeading(ticket()), "อาคาร 2 ห้อง 213 – หลอดไฟขาด");
});

test("a combined memo caption starts with the ticket number, which the memo items also carry", () => {
  assert.equal(photoHeading(ticket(), true), "เลขที่งาน REQ-202611-0007 อาคาร 2 ห้อง 213 – หลอดไฟขาด");
  assert.equal(photoHeading(ticket({ ticket_number: undefined }), true), "อาคาร 2 ห้อง 213 – หลอดไฟขาด");
});

test("without a room the spot detail is the place, and with neither it is the school grounds", () => {
  assert.equal(photoHeading(ticket({ room: null, location_detail: "หน้าเสาธง" })), "อาคาร 2 หน้าเสาธง – หลอดไฟขาด");
  assert.equal(photoHeading(ticket({ room: null, building: null })), "บริเวณโรงเรียน – หลอดไฟขาด");
});

test("a blank title gives no caption at all, never an invented one", () => {
  assert.equal(photoHeading(ticket({ title: "  " })), "");
  assert.equal(photoHeading(ticket({ title: "" }), true), "");
});

test("tickets without photos make no group; a grouped item never gets a wrong item number", () => {
  const signed = new Map([
    ["a/1.jpg", "https://x/1"],
    ["a/2.jpg", "https://x/2"],
    ["c/1.jpg", "https://x/3"],
  ]);
  const groups = buildPhotoGroups(
    [
      { numbered: true, ticket: ticket({ ticket_number: "REQ-1", image_urls: ["a/1.jpg", "a/2.jpg"] }) },
      { numbered: true, ticket: ticket({ image_urls: [] }) },
      { numbered: true, ticket: ticket({ ticket_number: "REQ-3", image_urls: ["c/1.jpg"] }) },
    ],
    signed,
  );
  assert.equal(groups.length, 2);
  assert.ok(groups[0].heading.startsWith("เลขที่งาน REQ-1 "));
  assert.ok(groups[1].heading.startsWith("เลขที่งาน REQ-3 "));
  assert.equal(groups.some((g) => g.heading.includes("ข้อ ")), false);
  assert.deepEqual(groups[0].urls, ["https://x/1", "https://x/2"]);
});

test("a photo whose link could not be signed is kept as an empty url, not dropped", () => {
  const groups = buildPhotoGroups([{ ticket: ticket({ image_urls: ["a/1.jpg", "gone.jpg"] }) }], new Map([["a/1.jpg", "https://x/1"]]));
  assert.deepEqual(groups[0].urls, ["https://x/1", ""]);
  assert.equal(groups[0].heading, "อาคาร 2 ห้อง 213 – หลอดไฟขาด");
});
