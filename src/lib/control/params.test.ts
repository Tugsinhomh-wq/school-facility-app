import test from "node:test";
import assert from "node:assert/strict";
import { controlHref, docHref, parseExportQuery, parseYearQuery, resolveGroup, resolveYear } from "./params.ts";
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

test("parseExportQuery: one named group is required, the year defaults to the current one", () => {
  assert.deepEqual(parseExportQuery({ group: "general" }, NOW), { ok: true, value: { fy: NOW, group: "general" } });
  assert.deepEqual(parseExportQuery({ fy: "2568", group: "royal" }, NOW), { ok: true, value: { fy: 2568, group: "royal" } });
  assert.deepEqual(parseExportQuery({ fy: ["2570", "2568"], group: ["finance", "royal"] }, NOW), { ok: true, value: { fy: 2570, group: "finance" } });
});

test("parseExportQuery: a missing, unknown or 'all' group is refused, never widened to every group", () => {
  for (const bad of [undefined, "", "all", "General", "finance,student", "__proto__"]) {
    const r = parseExportQuery({ fy: "2569", group: bad }, NOW);
    assert.equal(r.ok, false, `group=${JSON.stringify(bad)}`);
  }
  assert.equal(parseExportQuery({}, NOW).ok, false);
});

test("parseExportQuery: a malformed year is refused instead of quietly printing another year", () => {
  for (const bad of ["abc", "2569.5", "2499", "2701", "", "-2569", "25 69"]) {
    const r = parseExportQuery({ fy: bad, group: "general" }, NOW);
    assert.equal(r.ok, false, `fy=${JSON.stringify(bad)}`);
  }
  const r = parseExportQuery({ fy: "abc", group: "general" }, NOW);
  assert.ok(!r.ok && r.message.includes("ปีงบประมาณ"));
});

test("parseYearQuery: only the year matters, it defaults to the current one and a group is ignored", () => {
  assert.deepEqual(parseYearQuery({}, NOW), { ok: true, value: { fy: NOW } });
  assert.deepEqual(parseYearQuery({ fy: "2568" }, NOW), { ok: true, value: { fy: 2568 } });
  assert.deepEqual(parseYearQuery({ fy: ["2570", "2568"], group: "bad" }, NOW), { ok: true, value: { fy: 2570 } });
});

test("parseYearQuery: a malformed year is refused instead of quietly printing another year", () => {
  for (const bad of ["abc", "2569.5", "2499", "2701", "", "-2569", "25 69"]) {
    assert.equal(parseYearQuery({ fy: bad }, NOW).ok, false, `fy=${JSON.stringify(bad)}`);
  }
  const r = parseYearQuery({ fy: "abc" }, NOW);
  assert.ok(!r.ok && r.message.includes("ปีงบประมาณ"));
});

test("docHref always names the year and the group", () => {
  assert.equal(docHref("/control/export/pk5", 2569, "general"), "/control/export/pk5?fy=2569&group=general");
  assert.equal(docHref("/control/print", 2570, "royal", "csa"), "/control/print?doc=csa&fy=2570&group=royal");
});

test("docHref: ปค.1 is school-wide, so it never carries a group; ปค.4 does", () => {
  assert.equal(docHref("/control/export/pk1", 2569), "/control/export/pk1?fy=2569");
  assert.equal(docHref("/control/print", 2569, undefined, "pk1"), "/control/print?doc=pk1&fy=2569");
  assert.equal(docHref("/control/print", 2569, "general", "pk1"), "/control/print?doc=pk1&fy=2569");
  assert.equal(docHref("/control/print", 2570, "royal", "pk4"), "/control/print?doc=pk4&fy=2570&group=royal");
  assert.equal(docHref("/control/export/pk4", 2569, "general"), "/control/export/pk4?fy=2569&group=general");
});
