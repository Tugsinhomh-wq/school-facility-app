"use server";

import { revalidatePath } from "next/cache";

import { parseUuidList } from "@/lib/advisors";
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
 * removed. Older terms are not touched. Any account may be an advisor; roles are not changed.
 */
export async function saveAdvisorRooms(
  _prev: UserResult,
  formData: FormData,
): Promise<UserResult> {
  const user = parseUuidList([String(formData.get("id") ?? "")]);
  const rooms = parseUuidList(formData.getAll("room"));
  if (user?.length !== 1 || !rooms)
    return { ok: false, message: "ข้อมูลไม่ถูกต้อง" };

  const session = await adminSession();
  if (!session) return { ok: false, message: "เฉพาะผู้ดูแลระบบ" };
  const latest = await latestTermRooms(session.supabase);
  if (!latest) return { ok: false, message: "บันทึกไม่สำเร็จ" };
  const known = new Set(latest.rooms.map((r) => r.id));
  if (
    latest.term !== String(formData.get("term") ?? "") ||
    rooms.some((r) => !known.has(r))
  )
    return {
      ok: false,
      message: "รายการห้องเปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่",
    };

  const done = await setUserRooms(session.supabase, user[0], [...known], rooms);
  if ("code" in done) {
    console.error("advisor rooms failed", { code: done.code });
    return { ok: false, message: "บันทึกไม่สำเร็จ" };
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
