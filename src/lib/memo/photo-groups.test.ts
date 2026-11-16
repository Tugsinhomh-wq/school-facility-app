import test from "node:test";
import assert from "node:assert/strict";

import { buildPhotoGroups, photoHeading, type PhotoTicket } from "./photo-groups.ts";

const ticket = (over: Partial<PhotoTicket> = {}): PhotoTicket => ({
  title: "หลอดไฟขาด",
  location_detail: null,
  building: { name: "อาคาร 2" },
  room: { name: "ห้อง 213" },
  image_urls: [],
  ...over,
});

test("a single memo caption is place – title", () => {
  assert.equal(photoHeading(ticket()), "อาคาร 2 ห้อง 213 – หลอดไฟขาด");
});

test("a combined memo caption starts with the item number", () => {
  assert.ok(photoHeading(ticket(), 3).startsWith("ข้อ 3 "));
  assert.equal(photoHeading(ticket(), 3), "ข้อ 3 อาคาร 2 ห้อง 213 – หลอดไฟขาด");
});

test("without a room the spot detail is the place, and with neither it is the school grounds", () => {
  assert.equal(photoHeading(ticket({ room: null, location_detail: "หน้าเสาธง" })), "อาคาร 2 หน้าเสาธง – หลอดไฟขาด");
  assert.equal(photoHeading(ticket({ room: null, building: null })), "บริเวณโรงเรียน – หลอดไฟขาด");
});

test("a blank title gives no caption at all, never an invented one", () => {
  assert.equal(photoHeading(ticket({ title: "  " })), "");
  assert.equal(photoHeading(ticket({ title: "" }), 2), "");
});

test("tickets without photos make no group, and the item numbers stay the memo positions", () => {
  const signed = new Map([
    ["a/1.jpg", "https://x/1"],
    ["a/2.jpg", "https://x/2"],
    ["c/1.jpg", "https://x/3"],
  ]);
  const groups = buildPhotoGroups(
    [
      { position: 1, ticket: ticket({ image_urls: ["a/1.jpg", "a/2.jpg"] }) },
      { position: 2, ticket: ticket({ image_urls: [] }) },
      { position: 3, ticket: ticket({ image_urls: ["c/1.jpg"] }) },
    ],
    signed,
  );
  assert.equal(groups.length, 2);
  assert.ok(groups[0].heading.startsWith("ข้อ 1 "));
  assert.ok(groups[1].heading.startsWith("ข้อ 3 "));
  assert.deepEqual(groups[0].urls, ["https://x/1", "https://x/2"]);
});

test("a photo whose link could not be signed is kept as an empty url, not dropped", () => {
  const groups = buildPhotoGroups([{ ticket: ticket({ image_urls: ["a/1.jpg", "gone.jpg"] }) }], new Map([["a/1.jpg", "https://x/1"]]));
  assert.deepEqual(groups[0].urls, ["https://x/1", ""]);
  assert.equal(groups[0].heading, "อาคาร 2 ห้อง 213 – หลอดไฟขาด");
});
