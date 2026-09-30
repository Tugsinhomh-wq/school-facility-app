"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { TicketStatus } from "@/types/database";
import { getAuth } from "@/lib/supabase/auth";

const STATUSES: TicketStatus[] = ["pending", "in_progress", "completed", "cancelled"];
const MAX_COST = 99_999_999.99; // NUMERIC(10,2)

export type UpdateResult = { ok: boolean; message: string } | null;

export async function updateTicket(_prev: UpdateResult, formData: FormData): Promise<UpdateResult> {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as TicketStatus;
  const notes = String(formData.get("technician_notes") ?? "").trim();
  const cost = Number(String(formData.get("estimated_cost") ?? "0").replace(/,/g, "") || 0);

  if (!id || !STATUSES.includes(status)) return { ok: false, message: "สถานะไม่ถูกต้อง" };
  if (!Number.isFinite(cost) || cost < 0 || cost > MAX_COST) return { ok: false, message: "ค่าใช้จ่ายต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป" };
  if (notes.length > 2000) return { ok: false, message: "บันทึกช่างยาวเกิน 2,000 ตัวอักษร" };

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { ok: true, message: "โหมดสาธิต: ยังไม่ได้ตั้งค่า Supabase จึงไม่ได้บันทึกข้อมูลจริง" };
  }
  const supabase = await createClient();
  const { data: auth } = await getAuth(supabase);
  if (!auth.user) return { ok: false, message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };

  // RLS only lets staff and super_admin update; an empty result means the write was refused.
  const { data, error } = await supabase
    .from("repair_tickets")
    .update({ status, estimated_cost: cost, technician_notes: notes || null })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, message: `บันทึกไม่สำเร็จ: ${error.message}` };
  if (!data?.length) return { ok: false, message: "ไม่มีสิทธิ์แก้ไขรายการนี้" };

  revalidatePath("/tickets");
  revalidatePath(`/tickets/${id}`);
  revalidatePath("/");
  return { ok: true, message: "บันทึกแล้ว" };
}
