"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type AuthResult = { ok: boolean; message: string } | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function thaiError(error: { code?: string; message: string }) {
  switch (error.code) {
    case "invalid_credentials":
      return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    case "email_not_confirmed":
      return "ยังไม่ได้ยืนยันอีเมล กรุณาเปิดลิงก์ในอีเมลที่ส่งให้ตอนสมัคร";
    case "user_already_exists":
    case "email_exists":
      return "อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน";
    case "weak_password":
      return "รหัสผ่านคาดเดาง่ายเกินไป ลองใช้ตัวอักษรและตัวเลขผสมกัน";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "ส่งคำขอถี่เกินไป รอสักครู่แล้วลองใหม่";
    default:
      return `เข้าสู่ระบบไม่สำเร็จ: ${error.message}`;
  }
}

function credentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function signIn(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const { email, password } = credentials(formData);
  if (!EMAIL.test(email) || !password) return { ok: false, message: "กรุณากรอกอีเมลและรหัสผ่านให้ครบ" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: thaiError(error) };
  redirect("/");
}

export async function signUp(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const { email, password } = credentials(formData);
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { ok: false, message: "กรุณากรอกชื่อ-นามสกุล" };
  if (!EMAIL.test(email)) return { ok: false, message: "รูปแบบอีเมลไม่ถูกต้อง" };
  if (password.length < 8) return { ok: false, message: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName }, emailRedirectTo: `${proto}://${host}/auth/confirm` },
  });
  if (error) return { ok: false, message: thaiError(error) };

  // With email confirmation off, signUp returns a session and the user is already in.
  if (data.session) redirect("/");
  return { ok: true, message: "สมัครสำเร็จ ส่งลิงก์ยืนยันไปที่อีเมลแล้ว เปิดลิงก์นั้นก่อนเข้าสู่ระบบ" };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
