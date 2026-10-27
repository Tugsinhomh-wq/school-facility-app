import test from "node:test";
import assert from "node:assert/strict";

import { needsConsent, POLICY_VERSION, policyDateThai } from "./policy.ts";

test("the version is a Buddhist-era YYYY-MM-DD date", () => {
  assert.match(POLICY_VERSION, /^25\d{2}-\d{2}-\d{2}$/);
});

test("policyDateThai writes the long Thai date", () => {
  assert.equal(policyDateThai("2569-10-27"), "27 ตุลาคม 2569");
  assert.equal(policyDateThai("2570-01-05"), "5 มกราคม 2570");
  assert.equal(policyDateThai("2570-13-05"), "2570-13-05");
  assert.equal(policyDateThai("เมื่อวาน"), "เมื่อวาน");
});

test("needsConsent is false only when the profile or the sign-up metadata has the current version", () => {
  assert.equal(needsConsent(POLICY_VERSION, null), false);
  assert.equal(needsConsent(null, POLICY_VERSION), false);
  assert.equal(needsConsent(POLICY_VERSION, "2569-10-02"), false);
  assert.equal(needsConsent("2569-10-02", POLICY_VERSION), false);
  assert.equal(needsConsent(null, null), true);
  assert.equal(needsConsent(undefined, undefined), true);
  assert.equal(needsConsent("2569-10-02", "2569-10-02"), true);
  assert.equal(needsConsent("", ""), true);
});
