import assert from "node:assert/strict";
import { test } from "node:test";

import { visibleModules } from "./modules.ts";

test("executives see no modules", () => {
  assert.deepEqual(visibleModules("executive"), []);
});

test("teachers and signed-out visitors see all five, soon ones have no link", () => {
  for (const role of ["user", null] as const) {
    const mods = visibleModules(role);
    assert.deepEqual(
      mods.map((m) => m.id),
      ["repair", "rooms", "cleaning", "census", "control"],
    );
    for (const m of mods) assert.equal(m.href === null, Boolean(m.soon));
  }
});

test("staff roles see the same modules", () => {
  for (const role of ["staff", "head", "room_staff", "super_admin"] as const)
    assert.equal(visibleModules(role).length, 5);
});
