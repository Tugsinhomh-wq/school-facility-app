"use server";

import { redirect, RedirectType } from "next/navigation";

import { getSession } from "@/lib/data/session";
import { POLICY_VERSION } from "@/lib/policy";

export type ConsentResult = { ok: false; message: string } | null;

/** Records that the signed-in user accepted the current policy (RPC accept_policy), then goes home. */
export async function acceptPolicy(_prev: ConsentResult, formData: FormData): Promise<ConsentResult> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (formData.get("accept") !== "on")
    return { ok: false, message: "กรุณาติ๊กยอมรับนโยบายความเป็นส่วนตัวและเงื่อนไขการใช้งานก่อน" };

  const { error } = await session.supabase.rpc("accept_policy", { p_version: POLICY_VERSION });
  if (error) {
    console.error("accept_policy failed", error.code);
    // PGRST202 / 42883: the function does not exist yet (consent_01.sql not run).
    const notReady = error.code === "PGRST202" || error.code === "42883";
    return {
      ok: false,
      message: notReady ? "ระบบยังไม่พร้อมบันทึกการยอมรับ แจ้งผู้ดูแลระบบ" : "บันทึกไม่สำเร็จ ลองอีกครั้ง",
    };
  }
  redirect("/", RedirectType.replace);
}
