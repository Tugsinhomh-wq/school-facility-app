import test from "node:test";
import assert from "node:assert/strict";

import { canChangeUrgency, parseUrgency, URGENCY_CHOICES } from "./ticket-urgency.ts";

test("staff can choose four levels, from not urgent to emergency", () => {
  assert.deepEqual([...URGENCY_CHOICES], ["low", "medium", "high", "emergency"]);
});

test("parseUrgency accepts only the four known levels", () => {
  for (const v of URGENCY_CHOICES) assert.equal(parseUrgency(v), v);
  for (const v of ["", "URGENT", "Low", " high", "critical", null, undefined, 3, {}]) assert.equal(parseUrgency(v), null);
});

test("urgency can be changed only while the ticket is still open", () => {
  assert.equal(canChangeUrgency("pending"), true);
  assert.equal(canChangeUrgency("in_progress"), true);
  assert.equal(canChangeUrgency("completed"), false);
  assert.equal(canChangeUrgency("cancelled"), false);
});
