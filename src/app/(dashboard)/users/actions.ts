"use server";

import { revalidatePath } from "next/cache";

import { parseUuidList, planAdvisorSave } from "@/lib/advisors";
import { latestTermRooms, setUserRooms } from "@/lib/data/advisors";
import { getSession } from "@/lib/data/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

export type UserResult = { ok: boolean; message: string } | null;

const ROLES: UserRole[] = [
  "user",
  "staff",
  "head",
  "room_staff",
  "executive",
  "super_admin",
];
const UUID = /^[0-9a-f-]{36}$/i;

/** System administrator only (checked here and again by Row Level Security). */
async function adminSession() {
  const session = await getSession();
  return session && session.viewer.role === "super_admin" ? session : null;
}

export async function updateUser(
  _prev: UserResult,
  formData: FormData,
): Promise<UserResult> {
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "") as UserRole;
  const fullName = String(formData.get("full_name") ?? "").trim();
  const position = String(formData.get("position") ?? "").trim();
  if (!UUID.test(id) || !ROLES.includes(role))
    return { ok: false, message: "ข้อมูลไม่ถูกต้อง" };
  if (!fullName || fullName.length > 120 || position.length > 120)
    return { ok: false, message: "กรุณากรอกชื่อ (ไม่เกิน 120 ตัวอักษร)" };

  const session = await adminSession();
  if (!session) return { ok: false, message: "เฉพาะผู้ดูแลระบบ" };
  // Changing your own role could lock the last administrator out.
  if (id === session.userId && role !== "super_admin")
    return { ok: false, message: "เปลี่ยนบทบาทของตัวเองไม่ได้" };

  const { data, error } = await session.supabase
    .from("profiles")
    .update({ role, full_name: fullName, position: position || null })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { ok: false, message: "บันทึกไม่สำเร็จ" };
  revalidatePath("/users");
  return { ok: true, message: "บันทึกแล้ว" };
}

/**
 * Homeroom-advisor rooms of one user for the latest term: ticked rooms are added, unticked ones
 * removed, judged only over the rooms the form showed (`shown`). If the latest term's active rooms
 * are no longer exactly those, nothing is written. Executives and closed accounts can only lose
 * rooms (cleanup), never gain them. Older terms are not touched; roles are not changed.
 */
export async function saveAdvisorRooms(
  _prev: UserResult,
  formData: FormData,
): Promise<UserResult> {
  const user = parseUuidList([String(formData.get("id") ?? "")]);
  const rooms = parseUuidList(formData.getAll("room"));
  const shown = parseUuidList(formData.getAll("shown"));
  if (user?.length !== 1 || !rooms || !shown)
    return { ok: false, message: "ข้อมูลไม่ถูกต้อง" };

  const session = await adminSession();
  if (!session) return { ok: false, message: "เฉพาะผู้ดูแลระบบ" };
  // Profiles are readable here by the policy "profiles: super_admin read all" (supabase/schema.sql).
  const { data: target, error: targetError } = await session.supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user[0])
    .maybeSingle();
  if (targetError) return { ok: false, message: "บันทึกไม่สำเร็จ" };
  if (!target) return { ok: false, message: "ไม่พบบัญชีนี้" };
  const latest = await latestTermRooms(session.supabase);
  if (!latest) return { ok: false, message: "บันทึกไม่สำเร็จ" };

  const latestIds = latest.rooms.map((r) => r.id);
  const plan = planAdvisorSave(shown, rooms, [], latestIds);
  if ("error" in plan)
    return {
      ok: false,
      message:
        plan.error === "stale"
          ? "รายการห้องมีการเปลี่ยนแปลง โหลดหน้าใหม่แล้วลองอีกครั้ง"
          : "ข้อมูลไม่ถูกต้อง",
    };
  if (rooms.length > 0 && target.role === "executive")
    return { ok: false, message: "ผู้บริหารเป็นครูที่ปรึกษาไม่ได้ (ถอดห้องออกได้อย่างเดียว)" };
  if (rooms.length > 0 && !target.is_active)
    return { ok: false, message: "บัญชีนี้ปิดใช้งานอยู่ เพิ่มห้องไม่ได้ (ถอดห้องออกได้อย่างเดียว)" };

  const done = await setUserRooms(session.supabase, user[0], shown, rooms);
  if ("code" in done) {
    console.error("advisor rooms failed", { code: done.code });
    return {
      ok: false,
      message: "บันทึกไม่สำเร็จ อาจบันทึกไปบางส่วน กรุณากดบันทึกอีกครั้ง",
    };
  }
  revalidatePath("/users");
  revalidatePath("/cleaning/manage");
  revalidatePath("/cleaning");
  return {
    ok: true,
    message: rooms.length
      ? `บันทึกแล้ว เป็นครูที่ปรึกษา ${rooms.length} ห้อง`
      : "บันทึกแล้ว ไม่ได้เป็นครูที่ปรึกษาห้องใด",
  };
}

/** Closing an account bans the sign-in; the data stays. Reopening lifts the ban. */
export async function setUserActive(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "1";
  if (!UUID.test(id)) return;
  const session = await adminSession();
  if (!session || id === session.userId) return;

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, {
    ban_duration: active ? "none" : "876000h",
  });
  if (error) return;
  await session.supabase
    .from("profiles")
    .update({ is_active: active })
    .eq("id", id);
  revalidatePath("/users");
}
