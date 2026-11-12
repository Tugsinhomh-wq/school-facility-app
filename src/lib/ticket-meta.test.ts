import test from "node:test";
import assert from "node:assert/strict";

import { formatDateTh } from "./ticket-meta.ts";

test("formatDateTh shows Thailand time even when the server runs in UTC", () => {
  process.env.TZ = "UTC"; // Vercel servers run in UTC
  // 04:40 UTC is 11:40 in Thailand.
  const out = formatDateTh("2026-11-12T04:40:00Z");
  assert.match(out, /11[.:]40/);
  assert.doesNotMatch(out, /04[.:]40/);
});
