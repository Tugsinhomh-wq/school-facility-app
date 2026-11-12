import test from "node:test";
import assert from "node:assert/strict";

import { missingCloseEvidence } from "./ticket-close.ts";

test("closing a ticket with no notes and no after photos is refused", () => {
  assert.equal(missingCloseEvidence("in_progress", "completed", "", 0), true);
  assert.equal(missingCloseEvidence("pending", "completed", "   \n", 0), true);
});

test("notes alone, or an after photo alone, is enough to close", () => {
  assert.equal(missingCloseEvidence("in_progress", "completed", "เปลี่ยนหลอดไฟ", 0), false);
  assert.equal(missingCloseEvidence("in_progress", "completed", "", 1), false);
});

test("only the move into completed needs evidence", () => {
  assert.equal(missingCloseEvidence("pending", "in_progress", "", 0), false);
  assert.equal(missingCloseEvidence("pending", "cancelled", "", 0), false);
  assert.equal(missingCloseEvidence("in_progress", "pending", "", 0), false);
});

test("editing a ticket that was already completed does not ask again", () => {
  assert.equal(missingCloseEvidence("completed", "completed", "", 0), false);
});
