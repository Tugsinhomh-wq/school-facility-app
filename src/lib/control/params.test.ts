import test from "node:test";
import assert from "node:assert/strict";
import { controlHref, resolveGroup, resolveYear } from "./params.ts";
import { GROUPS } from "./forms.ts";

const NOW = 2569;

test("resolveYear: a whole year in range is used", () => {
  assert.equal(resolveYear("2568", NOW), 2568);
  assert.equal(resolveYear("2500", NOW), 2500);
  assert.equal(resolveYear("2700", NOW), 2700);
  assert.equal(resolveYear(" 2570 ", NOW), 2570);
});

test("resolveYear: a missing, malformed or out-of-range year falls back", () => {
  for (const bad of [undefined, "", "abc", "2569.5", "-2569", "25 69", "2499", "2701", "99999", "1e3", "0x9c9", "2569abc"]) {
    assert.equal(resolveYear(bad, NOW), NOW, `fy=${JSON.stringify(bad)}`);
  }
});

test("resolveYear: a repeated ?fy=&fy= uses the first value", () => {
  assert.equal(resolveYear(["2568", "2570"], NOW), 2568);
  assert.equal(resolveYear(["abc", "2570"], NOW), NOW);
  assert.equal(resolveYear([], NOW), NOW);
});

test("resolveGroup: only the six known keys pass", () => {
  for (const g of GROUPS) assert.equal(resolveGroup(g.key), g.key);
  for (const bad of [undefined, "", "all", "General", "general ", "finance,student", "__proto__", "constructor"]) {
    assert.equal(resolveGroup(bad), undefined, `group=${JSON.stringify(bad)}`);
  }
  assert.equal(resolveGroup(["royal", "finance"]), "royal");
  assert.equal(resolveGroup([]), undefined);
});

test("controlHref leaves the defaults out", () => {
  assert.equal(controlHref("/control", { fy: NOW }, NOW), "/control");
  assert.equal(controlHref("/control", { fy: 2568 }, NOW), "/control?fy=2568");
  assert.equal(controlHref("/control", { fy: NOW, group: "general" }, NOW), "/control?group=general");
  assert.equal(controlHref("/control", { fy: 2570, group: "royal" }, NOW), "/control?fy=2570&group=royal");
  assert.equal(controlHref("/control/projects/new", { fy: 2568, group: "academic" }, NOW), "/control/projects/new?fy=2568&group=academic");
});
