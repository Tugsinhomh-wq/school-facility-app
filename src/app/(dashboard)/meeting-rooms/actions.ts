"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { draftFromReservation } from "@/lib/memo/draft";
import { hasSupabase, isStaffRole } from "@/lib/data/session";
import { MOCK_MEMOS } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import { atBangkok, isYmd } from "@/lib/time";
import { getAuth } from "@/lib/supabase/auth";

export type BookingResult = {
  ok: boolean;
  message: string;
  reservationId?: string;
  /** What the database decided: pending (needs approval) or approved (slot locked). */
  status?: "pending" | "approved";
} | null;

const OPEN = 7 * 60;
const CLOSE = 20 * 60;

export async function createReservation(_prev: BookingResult, formData: FormData): Promise<BookingResult> {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const roomId = str("room_id");
  const date = str("date");
  const start = Number(str("start"));
  const end = Number(str("end"));
  const purpose = str("purpose");
  const attendees = str("attendee_count") ? Number(str("attendee_count")) : null;
  const equipment = [...formData.getAll("equipment").map(String), str("equipment_other")].map((e) => e.trim()).filter(Boolean);

  if (!roomId || !isYmd(date) || !Number.isInteger(start) || !Number.isInteger(end)) return { ok: false, message: "ข้อมูลวันและเวลาไม่ถูกต้อง" };
  if (start < OPEN || end > CLOSE || end <= start || start % 30 !== 0 || end % 30 !== 0) return { ok: false, message: "เวลาต้องอยู่ระหว่าง 07:00-20:00 และเป็นช่วงละ 30 นาที" };
  if (!purpose || purpose.length > 200) return { ok: false, message: "กรุณากรอกวัตถุประสงค์ (ชื่อการประชุม) ไม่เกิน 200 ตัวอักษร" };
  if (attendees !== null && (!Number.isInteger(attendees) || attendees < 1 || attendees > 10000)) return { ok: false, message: "จำนวนผู้เข้าร่วมไม่ถูกต้อง" };
  if (equipment.join(", ").length > 500) return { ok: false, message: "รายการอุปกรณ์ยาวเกินไป" };

  if (!hasSupabase()) return { ok: true, message: "โหมดสาธิต: ยังไม่ได้ตั้งค่า Supabase จึงไม่ได้บันทึกการจองจริง" };
  const supabase = await createClient();
  const { data: auth } = await getAuth(supabase);
  if (!auth.user) return { ok: false, message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };

  const { data: room } = await supabase.from("rooms").select("capacity, is_bookable").eq("id", roomId).maybeSingle();
  if (!room || !room.is_bookable) return { ok: false, message: "ห้องนี้ไม่เปิดให้ขอใช้" };
  if (attendees && room.capacity && attendees > room.capacity) return { ok: false, message: `ห้องนี้รองรับได้ ${room.capacity} คน` };

  // The database sets the status from the room's requires_approval and refuses overlaps.
  const { data, error } = await supabase
    .from("facility_reservations")
    .insert({
      reservation_number: "",
      applicant_id: auth.user.id,
      room_id: roomId,
      start_time: atBangkok(date, start).toISOString(),
      end_time: atBangkok(date, end).toISOString(),
      purpose,
      attendee_count: attendees,
      equipment_needed: equipment.join(", ") || null,
    })
    .select("id, status")
    .single();

  if (error) {
    if (error.code === "23P01") return { ok: false, message: "ช่วงเวลานี้มีคนจองห้องไปแล้ว กรุณาเลือกเวลาอื่น" };
    if (error.code === "P0001") return { ok: false, message: error.message };
    return { ok: false, message: `จองไม่สำเร็จ: ${error.message}` };
  }

  revalidatePath("/meeting-rooms");
  revalidatePath("/");
  const status = data.status === "pending" ? "pending" : "approved";
  return {
    ok: true,
    reservationId: data.id,
    status,
    message: status === "pending" ? "ส่งคำขอแล้ว รอผู้อำนวยการอนุมัติ" : "จองสำเร็จ ห้องถูกล็อกคิวให้แล้ว",
  };
}

/** Staff only (RLS enforces it): approve or reject a pending request. Rejecting frees the slot. */
export async function decideReservation(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!id || !["approved", "rejected"].includes(decision) || !hasSupabase()) return;

  const supabase = await createClient();
  const { data: auth } = await getAuth(supabase);
  if (!auth.user) redirect("/login");
  await supabase.from("facility_reservations").update({ status: decision }).eq("id", id).eq("status", "pending");
  revalidatePath("/meeting-rooms");
  revalidatePath("/");
}

/** The requester drafts the memo to the director for their own pending reservation. */
export async function createMemoFromReservation(formData: FormData) {
  const id = String(formData.get("reservation_id") ?? "");
  if (!id) redirect("/meeting-rooms");
  if (!hasSupabase()) redirect(`/memos/${MOCK_MEMOS[0].id}`);

  const supabase = await createClient();
  const { data: auth } = await getAuth(supabase);
  if (!auth.user) redirect("/login");

  const { data: existing } = await supabase
    .from("memorandums")
    .select("id")
    .eq("origin_module", "reservation")
    .eq("reference_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) redirect(`/memos/${existing.id}`);

  const { data: r } = await supabase
    .from("facility_reservations")
    .select("applicant_id, purpose, start_time, end_time, attendee_count, equipment_needed, room:rooms(name, building:buildings(name)), applicant:profiles(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!r) redirect("/meeting-rooms");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (r.applicant_id !== auth.user.id && !isStaffRole(profile?.role)) redirect("/meeting-rooms");

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const room = one(r.room as { name: string; building: { name: string } | { name: string }[] | null } | { name: string; building: { name: string } | { name: string }[] | null }[] | null);
  const draft = draftFromReservation({
    applicantName: one(r.applicant as { full_name: string } | { full_name: string }[] | null)?.full_name ?? null,
    roomName: room?.name ?? "ห้อง",
    buildingName: one(room?.building ?? null)?.name ?? "",
    purpose: r.purpose,
    startTime: r.start_time,
    endTime: r.end_time,
    attendeeCount: r.attendee_count,
    equipmentNeeded: r.equipment_needed,
  });

  const { data: memo, error } = await supabase
    .from("memorandums")
    .insert({ doc_ref_no: "", origin_module: "reservation", reference_id: id, author_id: auth.user.id, approval_mode: "paper_hybrid", ...draft })
    .select("id")
    .single();
  if (error || !memo) redirect(`/meeting-rooms?error=${encodeURIComponent("สร้างร่างบันทึกข้อความไม่สำเร็จ")}`);

  revalidatePath("/memos");
  redirect(`/memos/${memo.id}`);
}
