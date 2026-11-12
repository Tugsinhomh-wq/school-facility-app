import test from "node:test";
import assert from "node:assert/strict";

import { DUE_HOURS, overdueDays } from "./ticket-aging.ts";

const NOW = Date.parse("2026-11-12T12:00:00Z");
const ago = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();

test("due limits match the on-time rule in executive_summary: 1, 3, 7 and 14 days", () => {
  assert.deepEqual(DUE_HOURS, { emergency: 24, high: 72, medium: 168, low: 336 });
});

test("an open ticket inside its limit is not overdue", () => {
  assert.equal(overdueDays({ status: "pending", urgency: "emergency", created_at: ago(23) }, NOW), null);
  assert.equal(overdueDays({ status: "in_progress", urgency: "medium", created_at: ago(167) }, NOW), null);
});

test("an open ticket past its limit reports whole days waiting", () => {
  assert.equal(overdueDays({ status: "pending", urgency: "emergency", created_at: ago(30) }, NOW), 1);
  assert.equal(overdueDays({ status: "in_progress", urgency: "high", created_at: ago(100) }, NOW), 4);
  assert.equal(overdueDays({ status: "pending", urgency: "low", created_at: ago(24 * 20) }, NOW), 20);
});

test("exactly at the limit is still on time", () => {
  assert.equal(overdueDays({ status: "pending", urgency: "high", created_at: ago(72) }, NOW), null);
});

test("closed tickets are never overdue", () => {
  assert.equal(overdueDays({ status: "completed", urgency: "emergency", created_at: ago(1000) }, NOW), null);
  assert.equal(overdueDays({ status: "cancelled", urgency: "emergency", created_at: ago(1000) }, NOW), null);
});
