import test from "node:test";
import assert from "node:assert/strict";

import { describeEvent, repairDuration } from "./ticket-events.ts";

const ev = (kind: "status" | "assignee" | "urgency", from_value: string | null, to_value: string | null, actor_name: string | null = "สมชาย") => ({
  id: "e1",
  kind,
  from_value,
  to_value,
  actor_name,
  created_at: "2026-11-12T03:00:00Z",
});

test("a status change names the new status in Thai", () => {
  assert.deepEqual(describeEvent(ev("status", "pending", "in_progress")), { who: "สมชาย", what: "เปลี่ยนสถานะเป็น “กำลังดำเนินการ”" });
  assert.equal(describeEvent(ev("status", "in_progress", "completed")).what, "เปลี่ยนสถานะเป็น “ซ่อมเสร็จสิ้น”");
});

test("an urgency change names the new level in Thai", () => {
  assert.equal(describeEvent(ev("urgency", "medium", "emergency")).what, "ปรับความเร่งด่วนเป็น “ฉุกเฉิน”");
});

test("an owner change reads as assigned, changed or removed", () => {
  assert.equal(describeEvent(ev("assignee", null, "สมหญิง")).what, "มอบหมายงานให้ สมหญิง");
  assert.equal(describeEvent(ev("assignee", "สมหญิง", "วิชัย")).what, "เปลี่ยนผู้รับผิดชอบจาก สมหญิง เป็น วิชัย");
  assert.equal(describeEvent(ev("assignee", "สมหญิง", null)).what, "ยกเลิกผู้รับผิดชอบ (เดิม สมหญิง)");
});

test("a change that did not come from a signed-in user is attributed to the system", () => {
  assert.equal(describeEvent(ev("status", "pending", "completed", null)).who, "ระบบ");
});

test("an unknown status or level is shown as stored, not hidden", () => {
  assert.equal(describeEvent(ev("status", "pending", "paused")).what, "เปลี่ยนสถานะเป็น “paused”");
});

test("repair time is shown in days when a day or more, else hours", () => {
  const at = (iso: string) => iso;
  assert.equal(repairDuration(at("2026-11-10T00:00:00Z"), at("2026-11-13T06:00:00Z")), "3 วัน");
  assert.equal(repairDuration(at("2026-11-12T00:00:00Z"), at("2026-11-12T05:30:00Z")), "5 ชั่วโมง");
  assert.equal(repairDuration(at("2026-11-12T00:00:00Z"), at("2026-11-12T00:20:00Z")), "ไม่ถึง 1 ชั่วโมง");
});

test("a completion time before the report time is treated as no time", () => {
  assert.equal(repairDuration("2026-11-12T10:00:00Z", "2026-11-12T09:00:00Z"), "ไม่ถึง 1 ชั่วโมง");
});
