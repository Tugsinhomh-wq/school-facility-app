import test from "node:test";
import assert from "node:assert/strict";

import { CENSUS_HEADERS, parseCensusRows } from "./census-import.ts";
import { censusTemplateXlsx } from "./census-sheet.ts";
import { readSheet } from "./cleaning-sheet.ts";

test("the template reads back through readSheet with its zeros intact, and the parser refuses its two fake rows", async () => {
  const rows = await readSheet(await censusTemplateXlsx(), "xlsx");
  assert.deepEqual(rows[0], CENSUS_HEADERS);
  assert.deepEqual(rows.slice(1).map((r) => r[1]), ["00001", "00002"]);
  const r = parseCensusRows(rows);
  assert.equal(r.ok.length, 0);
  assert.deepEqual(r.errors.map((e) => e.row), [2, 3]);
  assert.match(r.errors[0].message, /แถวตัวอย่าง/);
});
