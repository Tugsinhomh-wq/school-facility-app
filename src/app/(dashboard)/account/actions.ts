"use server";

import { headers } from "next/headers";

import { getAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import type { FeedbackKind } from "@/types/database";

export type FeedbackResult = { ok: boolean; message: string };

const KINDS: FeedbackKind[] = ["problem", "request", "praise", "other"];

export async function sendFeedback(
  _prev: FeedbackResult | null,
  formData: FormData,
): Promise<FeedbackResult> {
  const kind = String(formData.get("kind") ?? "") as FeedbackKind;
  const message = String(formData.get("message") ?? "").trim();
  const pageUrl = String(formData.get("page_url") ?? "").slice(0, 300) || null;
  const imagePaths = formData.getAll("image_paths").map(String);

  if (!KINDS.includes(kind))
    return { ok: false, message: "กรุณาเลือกประเภทความคิดเห็น" };
  if (!message) return { ok: false, message: "กรุณาพิมพ์ข้อความ" };
  if (message.length > 2000)
    return { ok: false, message: "ข้อความยาวเกิน 2,000 ตัวอักษร" };

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
  if (!auth.user)
    return { ok: false, message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };

  // Screenshots were uploaded by the browser into the user's own folder of the feedback bucket.
  const ownPath = new RegExp(`^${auth.user.id}/[0-9a-f-]{36}\\.jpg$`);
  if (imagePaths.length > 4 || !imagePaths.every((p) => ownPath.test(p)))
    return { ok: false, message: "รูปที่แนบไม่ถูกต้อง ลองแนบใหม่อีกครั้ง" };

  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  const { error } = await supabase
    .from("feedback")
    .insert({
      kind,
      message,
      image_paths: imagePaths,
      page_url: pageUrl,
      user_agent: userAgent,
    });
  if (error) return { ok: false, message: "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง" };
  return {
    ok: true,
    message: "ขอบคุณสำหรับความคิดเห็น ผู้ดูแลระบบจะนำไปปรับปรุง",
  };
}
