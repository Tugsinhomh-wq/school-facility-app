import test from "node:test";
import assert from "node:assert/strict";

import { CENSUS_HEADERS, parseCensusRows } from "./census-import.ts";
import { censusTemplateXlsx } from "./census-sheet.ts";
import { readSheet } from "./cleaning-sheet.ts";

test("the template re-imports through readSheet + parser as its two fake rows, zeros intact", async () => {
  const rows = await readSheet(await censusTemplateXlsx(), "xlsx");
  assert.deepEqual(rows[0], CENSUS_HEADERS);
  const r = parseCensusRows(rows);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.ok.map((s) => s.code), ["00001", "00002"]);
});
