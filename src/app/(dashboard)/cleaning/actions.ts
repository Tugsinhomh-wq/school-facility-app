"use server";

import { revalidatePath } from "next/cache";

import { getAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { bangkokYmd, formatDayLong, isYmd } from "@/lib/time";

export type ConfirmResult = { ok: boolean; message: string };

const BUCKET = "cleaning-photos";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One tap: record that the class cleaned its zone on `day` (today unless a past day was picked). */
export async function confirmCleaning(
  _prev: ConfirmResult | null,
  formData: FormData,
): Promise<ConfirmResult> {
  const classroomId = String(formData.get("classroom_id") ?? "").trim();
  // The form sends `day` only for a late (past-day) confirmation. Otherwise "today" is the Bangkok
  // day at the moment of submitting, computed here: a tab left open overnight confirms the new day.
  const day = String(formData.get("day") ?? "").trim() || bangkokYmd(new Date());
  const photos = formData.getAll("photo_paths").map(String);

  if (!UUID.test(classroomId) || !isYmd(day))
    return { ok: false, message: "ข้อมูลห้องหรือวันที่ไม่ถูกต้อง ลองโหลดหน้าใหม่" };

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return {
      ok: true,
      message: "โหมดสาธิต: ยังไม่ได้ตั้งค่า Supabase จึงไม่ได้บันทึกข้อมูลจริง",
    };
  }

  const supabase = await createClient();
  const { data: auth } = await getAuth(supabase);
  if (!auth.user) {
    return {
      ok: true,
      message: "โหมดสาธิต: ยังไม่ได้เข้าสู่ระบบ จึงไม่ได้บันทึกข้อมูลจริง",
    };
  }

  // Photos were uploaded by the browser into the user's own folder; accept only paths we would have made.
  const ownPath = new RegExp(`^${auth.user.id}/[0-9a-f-]{36}\\.jpg$`);
  if (photos.length > 4 || !photos.every((p) => ownPath.test(p))) {
    return { ok: false, message: "รูปที่แนบไม่ถูกต้อง ลองแนบใหม่อีกครั้ง" };
  }

  const { data: result, error } = await supabase.rpc("confirm_cleaning", {
    p_classroom: classroomId,
    p_day: day,
    p_photos: photos,
  });
  if (error) {
    // The function's own refusals (not an advisor, future day, too old, off day, bad photos) are Thai already.
    if (error.code === "P0001") return { ok: false, message: error.message };
    return { ok: false, message: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }

  revalidatePath("/cleaning");
  revalidatePath("/");

  if (result === "already") {
    const { data: row, error: readError } = await supabase
      .from("cleaning_confirmations")
      .select("confirmed_by_name, photo_paths")
      .eq("classroom_id", classroomId)
      .eq("day", day)
      .maybeSingle();
    // Photos of this attempt that the stored row does not use are attached to nothing, so drop them.
    // A retry of a request that already saved posts the row's own photos: those must stay.
    // If the row cannot be read, keep everything (a leftover file is harmless, a lost one is not).
    if (!readError && row) {
      const kept = new Set<string>(row.photo_paths ?? []);
      const orphans = photos.filter((p) => !kept.has(p));
      if (orphans.length > 0)
        await supabase.storage.from(BUCKET).remove(orphans).catch(() => null);
    }
    return {
      ok: true,
      message: row?.confirmed_by_name
        ? `ยืนยันแล้วโดย ${row.confirmed_by_name}`
        : "มีผู้ยืนยันไว้แล้ว",
    };
  }

  // Name the day actually saved: for a today confirmation it is the server's Bangkok day now.
  return {
    ok: true,
    message:
      day < bangkokYmd(new Date())
        ? `บันทึกการยืนยันย้อนหลังของ${formatDayLong(day)}แล้ว`
        : `บันทึกการยืนยันของ${formatDayLong(day)}แล้ว ขอบคุณที่ยืนยัน`,
  };
}
