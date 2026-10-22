import assert from "node:assert/strict";
import { test } from "node:test";

import { censusHref, resolveTerm, termConfirmed } from "./census-view.ts";

const terms = ["2569/2", "2569/1", "2568/2"];

test("resolveTerm: a known ?term= is kept, anything else is the newest", () => {
  assert.equal(resolveTerm("2569/1", terms), "2569/1");
  assert.equal(resolveTerm(["2568/2", "x"], terms), "2568/2");
  for (const bad of [undefined, "", "abc", "2570/1", "2569/1 ", ["nope"]]) assert.equal(resolveTerm(bad, terms), "2569/2");
});

test("resolveTerm: no terms means no term", () => {
  assert.equal(resolveTerm("2569/1", []), null);
  assert.equal(resolveTerm(undefined, []), null);
});

test("censusHref keeps the term, encoded, or leaves the path alone", () => {
  assert.equal(censusHref("/census", "2569/1"), "/census?term=2569%2F1");
  assert.equal(censusHref("/census/import", null), "/census/import");
});

test("termConfirmed needs the term typed exactly (outer spaces aside)", () => {
  assert.ok(termConfirmed("2569/1", "2569/1"));
  assert.ok(termConfirmed("  2569/1 ", "2569/1"));
  for (const typed of ["", "2569", "2569/2", "2569/10", "2569 / 1"]) assert.ok(!termConfirmed(typed, "2569/1"));
});
