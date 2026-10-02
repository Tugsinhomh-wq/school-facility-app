"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/data/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

export type UserResult = { ok: boolean; message: string } | null;

const ROLES: UserRole[] = [
  "user",
  "staff",
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
