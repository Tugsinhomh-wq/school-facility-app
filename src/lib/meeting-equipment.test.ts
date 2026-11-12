import assert from "node:assert/strict";
import { test } from "node:test";

import { equipmentGroupsFor } from "./meeting-equipment.ts";

const items = (groups: ReturnType<typeof equipmentGroupsFor>) => groups.flatMap((g) => g.items);

test("a normal hall gets the full standard checklist, grouped, with no service group", () => {
  const groups = equipmentGroupsFor("HALL-01", []);
  assert.deepEqual(groups.map((g) => g.title), ["ภาพและเสียง", "ประชุมออนไลน์", "ห้องและที่นั่ง"]);
  const all = items(groups);
  for (const wanted of ["จอภาพ/โปรเจกเตอร์", "เครื่องเสียง/ลำโพง", "ไมโครโฟน (ไมค์ลอย/ไมค์ตั้งโต๊ะ)", "แท่นพูด"]) {
    assert.ok(all.includes(wanted), wanted);
  }
  assert.ok(!all.some((i) => i.includes("น้ำดื่ม") || i.includes("อาหารว่าง")));
});

test("the small hall (HALL-05) shows fewer items than a normal hall", () => {
  const small = items(equipmentGroupsFor("HALL-05", []));
  const normal = items(equipmentGroupsFor("HALL-01", []));
  assert.ok(small.length < normal.length);
  assert.ok(small.includes("จอภาพ/โปรเจกเตอร์"));
  assert.ok(!small.includes("แท่นพูด"));
  assert.ok(!small.includes("เครื่องเสียง/ลำโพง"));
});

test("room-specific equipment is appended, without duplicating a standard item", () => {
  const groups = equipmentGroupsFor("HALL-01", ["จอภาพ/โปรเจกเตอร์", "ไมค์ลอย 2 ตัว"]);
  const last = groups[groups.length - 1];
  assert.equal(last.title, "อุปกรณ์เฉพาะห้อง");
  assert.deepEqual(last.items, ["ไมค์ลอย 2 ตัว"]);
  assert.equal(items(groups).filter((i) => i === "จอภาพ/โปรเจกเตอร์").length, 1);
});

test("no room-specific group when the room has nothing extra", () => {
  assert.ok(!equipmentGroupsFor("HALL-02", []).some((g) => g.title === "อุปกรณ์เฉพาะห้อง"));
  assert.ok(!equipmentGroupsFor("HALL-02", ["  "]).some((g) => g.title === "อุปกรณ์เฉพาะห้อง"));
});
