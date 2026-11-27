import assert from "node:assert/strict";
import { test } from "node:test";

import { atBangkok } from "./time.ts";
import { findVehicleConflict, itemsOn, tripDays, tripLength, tripSpan, validateRequest, type RequestInput, type VehicleBooking } from "./vehicle.ts";

const NOW = new Date("2026-12-01T03:00:00Z"); // 10:00 on 1 Dec in Bangkok

const booking = (id: string, vehicle: string, from: [string, number], to: [string, number]): VehicleBooking => ({
  id,
  vehicle_id: vehicle,
  applicant_id: "u",
  applicant_name: null,
  destination: "ขอนแก่น",
  purpose: "แข่งขัน",
  passenger_count: 4,
  contact_phone: "0812345678",
  driver_name: null,
  start_time: atBangkok(from[0], from[1]).toISOString(),
  end_time: atBangkok(to[0], to[1]).toISOString(),
  status: "approved",
});

const ok: RequestInput = {
  vehicleId: "v1",
  startYmd: "2026-12-03",
  startMin: 7 * 60,
  endYmd: "2026-12-04",
  endMin: 16 * 60,
  destination: "โรงเรียนอื่น",
  purpose: "แข่งขันทักษะ",
  passengers: 8,
  phone: "081-234 5678",
  driverName: "ครูสมชาย",
};

test("a trip is counted in days from departure to return", () => {
  assert.equal(tripDays("2026-12-03", "2026-12-03"), 1);
  assert.equal(tripDays("2026-12-03", "2026-12-05"), 3);
  assert.equal(tripLength("2026-12-03", "2026-12-03"), "ไป-กลับวันเดียว");
  assert.equal(tripLength("2026-12-03", "2026-12-05"), "3 วัน 2 คืน");
});

test("a trip across midnight clashes with a day trip on its middle day", () => {
  const trip = booking("a", "v1", ["2026-12-03", 7 * 60], ["2026-12-05", 16 * 60]);
  const day = atBangkok("2026-12-04", 9 * 60).getTime();
  assert.ok(findVehicleConflict([trip], "v1", day, day + 3_600_000));
  assert.equal(findVehicleConflict([trip], "v2", day, day + 3_600_000), undefined);
  // Back-to-back is not a clash: the next trip may leave the minute this one returns.
  const ret = atBangkok("2026-12-05", 16 * 60).getTime();
  assert.equal(findVehicleConflict([trip], "v1", ret, ret + 3_600_000), undefined);
});

test("itemsOn clips a multi-day trip to each day it touches", () => {
  const trip = booking("a", "v1", ["2026-12-03", 7 * 60], ["2026-12-05", 16 * 60]);
  assert.deepEqual(itemsOn([trip], "v1", "2026-12-03").map(({ from, to }) => [from, to]), [[420, 1440]]);
  assert.deepEqual(itemsOn([trip], "v1", "2026-12-04").map(({ from, to }) => [from, to]), [[0, 1440]]);
  assert.deepEqual(itemsOn([trip], "v1", "2026-12-05").map(({ from, to }) => [from, to]), [[0, 960]]);
  assert.deepEqual(itemsOn([trip], "v1", "2026-12-06"), []);
});

test("tripSpan reads a stored trip back as Bangkok dates and minutes", () => {
  const trip = booking("a", "v1", ["2026-12-03", 7 * 60], ["2026-12-04", 16 * 60 + 30]);
  assert.deepEqual(tripSpan(trip), { startYmd: "2026-12-03", startMin: 420, endYmd: "2026-12-04", endMin: 990 });
});

test("a complete request passes", () => {
  assert.equal(validateRequest(ok, { seats: 12, has_driver: false }, NOW), null);
});

test("return must be after departure and departure not in the past", () => {
  assert.match(validateRequest({ ...ok, endYmd: "2026-12-03", endMin: 6 * 60 }, { seats: null, has_driver: true }, NOW) ?? "", /เวลากลับ/);
  assert.match(validateRequest({ ...ok, startYmd: "2026-11-30" }, { seats: null, has_driver: true }, NOW) ?? "", /ย้อนหลัง/);
});

test("times are on the half hour inside 05:00-22:00", () => {
  assert.ok(validateRequest({ ...ok, startMin: 4 * 60 }, { seats: null, has_driver: true }, NOW));
  assert.ok(validateRequest({ ...ok, startMin: 7 * 60 + 10 }, { seats: null, has_driver: true }, NOW));
  assert.ok(validateRequest({ ...ok, endMin: 23 * 60 }, { seats: null, has_driver: true }, NOW));
});

test("passengers are checked against seats only when seats are set", () => {
  assert.match(validateRequest({ ...ok, passengers: 13 }, { seats: 12, has_driver: true }, NOW) ?? "", /นั่งได้ 12/);
  assert.equal(validateRequest({ ...ok, passengers: 13 }, { seats: null, has_driver: true }, NOW), null);
});

test("a vehicle without a regular driver needs the driver's name, one with a driver does not", () => {
  assert.match(validateRequest({ ...ok, driverName: " " }, { seats: null, has_driver: false }, NOW) ?? "", /ผู้ขับ/);
  assert.equal(validateRequest({ ...ok, driverName: "" }, { seats: null, has_driver: true }, NOW), null);
});

test("phone, destination, purpose and trip length are required", () => {
  assert.match(validateRequest({ ...ok, phone: "12345" }, { seats: null, has_driver: true }, NOW) ?? "", /เบอร์/);
  assert.match(validateRequest({ ...ok, destination: "" }, { seats: null, has_driver: true }, NOW) ?? "", /จุดหมาย/);
  assert.match(validateRequest({ ...ok, purpose: " " }, { seats: null, has_driver: true }, NOW) ?? "", /เรื่องที่ไป/);
  assert.match(validateRequest({ ...ok, endYmd: "2026-12-20" }, { seats: null, has_driver: true }, NOW) ?? "", /ไม่เกิน 14 วัน/);
});
