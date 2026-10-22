import assert from "node:assert/strict";
import { test } from "node:test";

import { visibleModules } from "./modules.ts";

test("executives see no modules", () => {
  assert.deepEqual(visibleModules("executive"), []);
});

test("teachers see all five; only census is unbuilt (no link), control opens /control", () => {
  const mods = visibleModules("user");
  assert.deepEqual(
    mods.map((m) => m.id),
    ["repair", "rooms", "cleaning", "census", "control"],
  );
  for (const m of mods) assert.equal(m.href === null, Boolean(m.soon));
  const control = mods.find((m) => m.id === "control");
  assert.equal(control?.href, "/control");
  assert.ok(!control?.soon);
});

test("signed-out visitors see the open modules but not control", () => {
  const ids = visibleModules(null).map((m) => m.id);
  assert.deepEqual(ids, ["repair", "rooms", "cleaning", "census"]);
  assert.ok(!ids.includes("control"));
});

test("staff roles see the same five, control included", () => {
  for (const role of ["staff", "head", "room_staff", "super_admin"] as const) {
    const mods = visibleModules(role);
    assert.equal(mods.length, 5);
    assert.equal(mods.find((m) => m.id === "control")?.href, "/control");
  }
});

test("modules are grouped: facility work first, the unbuilt ones under other", () => {
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
