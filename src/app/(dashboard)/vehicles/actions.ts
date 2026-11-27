"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { canBookVehicle, hasSupabase, isVehicleApprover } from "@/lib/data/session";
import { getAuth } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { atBangkok } from "@/lib/time";
import { validateRequest } from "@/lib/vehicle";
import type { UserRole } from "@/types/database";

export type VehicleResult = {
  ok: boolean;
  message: string;
  /** What the database decided: pending (needs approval) or approved (dates locked). */
  status?: "pending" | "approved";
} | null;

async function who() {
  const supabase = await createClient();
  const { data: auth } = await getAuth(supabase);
  if (!auth.user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  return { supabase, userId: auth.user.id, role: (profile?.role as UserRole | undefined) ?? "user" };
}

export async function createVehicleRequest(_prev: VehicleResult, formData: FormData): Promise<VehicleResult> {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const input = {
    vehicleId: str("vehicle_id"),
    startYmd: str("start_date"),
    startMin: Number(str("start_min")),
    endYmd: str("end_date"),
    endMin: Number(str("end_min")),
    destination: str("destination"),
    purpose: str("purpose"),
    passengers: Number(str("passenger_count")),
    phone: str("contact_phone"),
    driverName: str("driver_name"),
  };

  if (!hasSupabase()) {
    const bad = validateRequest(input, { seats: null, has_driver: true }, new Date());
    return bad ? { ok: false, message: bad } : { ok: true, message: "โหมดสาธิต: ยังไม่ได้ตั้งค่า Supabase จึงไม่ได้บันทึกการจองจริง" };
  }
  const me = await who();
  if (!me) return { ok: false, message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };
  if (!canBookVehicle(me.role)) return { ok: false, message: "บัญชีนี้ไม่ได้ใช้จองรถ" };

  const { data: vehicle } = await me.supabase
    .from("vehicles")
    .select("seats, has_driver, is_bookable")
    .eq("id", input.vehicleId)
    .maybeSingle();
  if (!vehicle || !vehicle.is_bookable) return { ok: false, message: "รถคันนี้ไม่เปิดให้ขอใช้" };
  const bad = validateRequest(input, vehicle, new Date());
  if (bad) return { ok: false, message: bad };

  // The database sets the status from the vehicle's requires_approval and refuses overlaps.
  const { data, error } = await me.supabase
    .from("vehicle_reservations")
    .insert({
      applicant_id: me.userId,
      vehicle_id: input.vehicleId,
      start_time: atBangkok(input.startYmd, input.startMin).toISOString(),
      end_time: atBangkok(input.endYmd, input.endMin).toISOString(),
      destination: input.destination,
      purpose: input.purpose,
      passenger_count: input.passengers,
      contact_phone: input.phone,
      driver_name: vehicle.has_driver ? null : input.driverName,
    })
    .select("status")
    .single();

  if (error) {
    if (error.code === "23P01") return { ok: false, message: "ช่วงเวลานี้มีคนจองรถคันนี้ไปแล้ว กรุณาเลือกวันหรือเวลาอื่น" };
    if (error.code === "P0001") return { ok: false, message: error.message };
    if (error.code === "42P01") return { ok: false, message: "ระบบจองรถยังไม่พร้อม ให้ผู้ดูแลรันไฟล์ vehicles_01.sql ก่อน" };
    return { ok: false, message: `จองไม่สำเร็จ: ${error.message}` };
  }

  revalidatePath("/vehicles");
  revalidatePath("/summary");
  const status = data.status === "pending" ? "pending" : "approved";
  return {
    ok: true,
    status,
    message: status === "pending" ? "ส่งคำขอแล้ว รอผู้อำนวยการอนุมัติ" : "จองสำเร็จ ล็อกวันให้แล้ว",
  };
}

/** The director and the administrator (RLS enforces it too): approve or reject a pending request, or withdraw an approved one. */
export async function decideVehicleRequest(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!id || !["approved", "rejected"].includes(decision) || !hasSupabase()) return;
  const me = await who();
  if (!me) redirect("/login");
  if (!isVehicleApprover(me.role)) return;
  await me.supabase
    .from("vehicle_reservations")
    .update({ status: decision })
    .eq("id", id)
    .in("status", decision === "rejected" ? ["pending", "approved"] : ["pending"]);
  revalidatePath("/vehicles");
  revalidatePath("/summary");
}

/** The applicant withdraws their own trip before it starts. */
export async function cancelVehicleRequest(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id || !hasSupabase()) return;
  const me = await who();
  if (!me) redirect("/login");
  await me.supabase
    .from("vehicle_reservations")
    .update({ status: "rejected" })
    .eq("id", id)
    .eq("applicant_id", me.userId)
    .in("status", ["pending", "approved"])
    .gt("start_time", new Date().toISOString());
  revalidatePath("/vehicles");
  revalidatePath("/summary");
}
