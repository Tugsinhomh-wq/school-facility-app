import assert from "node:assert/strict";
import { test } from "node:test";

import { visibleModules } from "./modules.ts";

test("executives see no modules", () => {
  assert.deepEqual(visibleModules("executive"), []);
});

test("teachers see all five, every one built: census opens /census, control opens /control", () => {
  const mods = visibleModules("user");
  assert.deepEqual(
    mods.map((m) => m.id),
    ["repair", "rooms", "cleaning", "census", "control"],
  );
  for (const m of mods) assert.ok(m.href && !m.soon);
  assert.equal(mods.find((m) => m.id === "census")?.href, "/census");
  const control = mods.find((m) => m.id === "control");
  assert.equal(control?.href, "/control");
  assert.ok(!control?.soon);
});

test("signed-out visitors see the open modules, never the roster or control", () => {
  const ids = visibleModules(null).map((m) => m.id);
  assert.deepEqual(ids, ["repair", "rooms", "cleaning"]);
  assert.ok(!ids.includes("census") && !ids.includes("control"));
});

test("staff roles see the same five, census and control included", () => {
  for (const role of ["staff", "head", "room_staff", "super_admin"] as const) {
    const mods = visibleModules(role);
    assert.equal(mods.length, 5);
    assert.equal(mods.find((m) => m.id === "census")?.href, "/census");
    assert.equal(mods.find((m) => m.id === "control")?.href, "/control");
  }
});

test("modules are grouped: facility work first, the rest under other", () => {
  const groups = (role: "user") =>
    visibleModules(role).map((m) => `${m.id}:${m.group}`);
  assert.deepEqual(groups("user"), [
    "repair:facility",
    "rooms:facility",
    "cleaning:facility",
    "census:other",
    "control:other",
  ]);
});
