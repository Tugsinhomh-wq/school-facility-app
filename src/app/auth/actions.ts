"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { POLICY_VERSION } from "@/lib/policy";
import { getAuth } from "@/lib/supabase/auth";
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
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function signIn(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const { email, password } = credentials(formData);
  if (!EMAIL.test(email) || !password)
    return { ok: false, message: "กรุณากรอกอีเมลและรหัสผ่านให้ครบ" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: thaiError(error) };
  redirect("/");
}

export async function signUp(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const { email, password } = credentials(formData);
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { ok: false, message: "กรุณากรอกชื่อ-นามสกุล" };
  if (!EMAIL.test(email))
    return { ok: false, message: "รูปแบบอีเมลไม่ถูกต้อง" };
  if (password.length < 8)
    return { ok: false, message: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" };
  if (formData.get("accept") !== "on")
    return {
      ok: false,
      message: "กรุณายอมรับนโยบายความเป็นส่วนตัวและเงื่อนไขการใช้งานก่อนสมัคร",
    };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto =
    h.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        consented_at: new Date().toISOString(),
        consent_version: POLICY_VERSION,
      },
      emailRedirectTo: `${proto}://${host}/auth/confirm`,
    },
  });
  if (error) return { ok: false, message: thaiError(error) };

  // With email confirmation off, signUp returns a session and the user is already in.
  if (data.session) redirect("/");
  return {
    ok: true,
    message:
      "สมัครสำเร็จ ส่งลิงก์ยืนยันไปที่อีเมลแล้ว เปิดลิงก์นั้นก่อนเข้าสู่ระบบ",
  };
}

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto =
    h.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** "Forgot password": emails a link that signs the user in and opens the new-password page. */
export async function requestPasswordReset(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL.test(email))
    return { ok: false, message: "รูปแบบอีเมลไม่ถูกต้อง" };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/reset-password`,
  });
  if (error) {
    if (
      error.code === "over_email_send_rate_limit" ||
      error.code === "over_request_rate_limit"
    )
      return { ok: false, message: thaiError(error) };
    console.error("password reset failed", error.code);
    return {
      ok: false,
      message: "ส่งลิงก์ไม่สำเร็จ ลองใหม่อีกครั้ง หรือแจ้งผู้ดูแลระบบ",
    };
  }
  // Same answer whether or not the address has an account, so the form cannot be used to find out who does.
  return {
    ok: true,
    message:
      "ถ้าอีเมลนี้สมัครไว้ ระบบส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว เปิดลิงก์ในอีเมลภายใน 1 ชั่วโมง ถ้าไม่พบให้ดูในกล่องจดหมายขยะ",
  };
}

/** Sets the new password for the user who arrived through the reset link. */
export async function updatePassword(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const password = String(formData.get("password") ?? "");
  const again = String(formData.get("password_again") ?? "");
  if (password.length < 8)
    return { ok: false, message: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" };
  if (password !== again)
    return { ok: false, message: "รหัสผ่านสองช่องไม่ตรงกัน" };

  const supabase = await createClient();
  const { data } = await getAuth(supabase);
  if (!data.user) redirect("/login?error=confirm");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password")
      return { ok: false, message: "ใช้รหัสผ่านเดิมไม่ได้ ตั้งรหัสผ่านใหม่" };
    if (error.code === "weak_password")
      return { ok: false, message: thaiError(error) };
    console.error("update password failed", error.code);
    return {
      ok: false,
      message: "เปลี่ยนรหัสผ่านไม่สำเร็จ ลองขอลิงก์ใหม่อีกครั้ง",
    };
  }
  redirect("/");
}

/** Google sign-in, restricted to school accounts (the domain is checked again in /auth/confirm). */
export async function signInWithGoogle() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto =
    h.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${proto}://${host}/auth/confirm`,
      queryParams: { hd: "lrp.ac.th", prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
