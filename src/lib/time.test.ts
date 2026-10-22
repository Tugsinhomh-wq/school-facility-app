import test from "node:test";
import assert from "node:assert/strict";

import { formatDateShort, isYmd } from "./time.ts";

test("isYmd accepts real days and refuses ones that roll over", () => {
  assert.equal(isYmd("2026-10-21"), true);
  assert.equal(isYmd("2028-02-29"), true); // leap year
  assert.equal(isYmd("2026-02-31"), false);
  assert.equal(isYmd("2026-02-29"), false);
  assert.equal(isYmd("2026-13-01"), false);
  assert.equal(isYmd("26-10-21"), false);
  assert.equal(isYmd(undefined), false);
});

test("formatDateShort: day, short month and the Buddhist-era year", () => {
  assert.equal(formatDateShort("2026-12-31"), "31 ธ.ค. 2569");
  assert.equal(formatDateShort("2027-03-05"), "5 มี.ค. 2570");
  assert.equal(formatDateShort("2026-10-01"), "1 ต.ค. 2569");
});
