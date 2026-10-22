import test from "node:test";
import assert from "node:assert/strict";
import { effectiveScore, fiscalYear, LEVEL_LABEL, needsPk5, riskLevel, riskScore, type RiskLevel } from "./risk.ts";

test("fiscalYear: the Thai fiscal year starts on 1 October", () => {
  assert.equal(fiscalYear("2026-09-30"), 2569);
  assert.equal(fiscalYear("2026-10-01"), 2570);
  assert.equal(fiscalYear("2027-01-15"), 2570);
});

test("fiscalYear: first and last day of the calendar year", () => {
  assert.equal(fiscalYear("2026-01-01"), 2569);
  assert.equal(fiscalYear("2026-12-31"), 2570);
});

test("riskScore multiplies likelihood by impact", () => {
  assert.equal(riskScore(4, 4), 16);
  assert.equal(riskScore(5, 3), 15);
  assert.equal(riskScore(1, 1), 1);
  assert.equal(riskScore(5, 5), 25);
});

test("riskScore is null when a value is missing, out of 1-5 or not a whole number", () => {
  assert.equal(riskScore(null, 3), null);
  assert.equal(riskScore(3, null), null);
  assert.equal(riskScore(null, null), null);
  assert.equal(riskScore(0, 3), null);
  assert.equal(riskScore(6, 1), null);
  assert.equal(riskScore(3, 6), null);
  assert.equal(riskScore(-1, 2), null);
  assert.equal(riskScore(2.5, 2), null);
  assert.equal(riskScore(Number.NaN, 2), null);
});

test("riskLevel at the band edges", () => {
  const cases: [number, RiskLevel][] = [
    [1, "low"],
    [3, "low"],
    [4, "moderate"],
    [8, "moderate"],
    [9, "high"],
    [15, "high"],
    [16, "extreme"],
    [25, "extreme"],
  ];
  for (const [score, level] of cases) assert.equal(riskLevel(score), level, `score ${score}`);
});

test("LEVEL_LABEL has a Thai label for every level", () => {
  assert.deepEqual(LEVEL_LABEL, { extreme: "สูงมาก", high: "สูง", moderate: "ปานกลาง", low: "ต่ำ" });
});

test("effectiveScore uses the head's values when both are set", () => {
  assert.equal(effectiveScore({ likelihood: 2, impact: 2, headLikelihood: 5, headImpact: 3 }), 15);
});

test("effectiveScore falls back to the owner's values when the head gave none", () => {
  assert.equal(effectiveScore({ likelihood: 2, impact: 4, headLikelihood: null, headImpact: null }), 8);
});

test("effectiveScore: a head value replaces only its own axis", () => {
  assert.equal(effectiveScore({ likelihood: 2, impact: 4, headLikelihood: 5, headImpact: null }), 20);
  assert.equal(effectiveScore({ likelihood: 2, impact: 4, headLikelihood: null, headImpact: 1 }), 2);
});

test("effectiveScore is null when nothing usable was given", () => {
  assert.equal(effectiveScore({ likelihood: null, impact: null, headLikelihood: null, headImpact: null }), null);
  assert.equal(effectiveScore({ likelihood: 3, impact: null, headLikelihood: null, headImpact: null }), null);
  assert.equal(effectiveScore({ likelihood: 9, impact: 3, headLikelihood: null, headImpact: null }), null);
});

test("needsPk5 starts at 9 and never for an unscored project", () => {
  assert.equal(needsPk5(9), true);
  assert.equal(needsPk5(25), true);
  assert.equal(needsPk5(8), false);
  assert.equal(needsPk5(1), false);
  assert.equal(needsPk5(null), false);
});
