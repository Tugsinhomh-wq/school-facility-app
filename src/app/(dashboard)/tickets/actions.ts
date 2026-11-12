"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasSupabase, getSession } from "@/lib/data/session";
import { missingCloseEvidence } from "@/lib/ticket-close";
import { canChangeUrgency, parseUrgency } from "@/lib/ticket-urgency";
import { purgeTickets } from "@/lib/trash";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { TicketStatus } from "@/types/database";
import { getAuth } from "@/lib/supabase/auth";

const STATUSES: TicketStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
];
const MAX_COST = 99_999_999.99; // NUMERIC(10,2)
const UUID = /^[0-9a-f-]{36}$/i;

export type UpdateResult = { ok: boolean; message: string } | null;

export async function updateTicket(
  _prev: UpdateResult,
  formData: FormData,
): Promise<UpdateResult> {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as TicketStatus;
  const notes = String(formData.get("technician_notes") ?? "").trim();
  const cost = Number(
    String(formData.get("estimated_cost") ?? "0").replace(/,/g, "") || 0,
  );

  if (!id || !STATUSES.includes(status))
    return { ok: false, message: "สถานะไม่ถูกต้อง" };
  if (!Number.isFinite(cost) || cost < 0 || cost > MAX_COST)
    return { ok: false, message: "ค่าใช้จ่ายต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป" };
  if (notes.length > 2000)
    return { ok: false, message: "บันทึกช่างยาวเกิน 2,000 ตัวอักษร" };
  // Sent only while the ticket is open (the field is disabled on closed tickets); absent = leave the level alone.
  const urgencyField = formData.get("urgency");
  const urgency = urgencyField === null ? undefined : parseUrgency(urgencyField);
  if (urgency === null) return { ok: false, message: "ระดับความเร่งด่วนไม่ถูกต้อง" };
  // Sent by the manage form: "" = no owner, an id = that person; absent = leave the owner alone.
  const assigneeField = formData.get("assignee_id");
  let assignee: string | null | undefined;
  if (assigneeField !== null) {
    const v = String(assigneeField);
    if (v !== "" && !UUID.test(v)) return { ok: false, message: "ผู้รับผิดชอบไม่ถูกต้อง" };
    assignee = v === "" ? null : v;
  }

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

  // After photos were uploaded by the browser into the staff member's own folder; accept only paths we would have made.
  const afterPaths = formData.getAll("after_image_paths").map(String);
  const ownPath = new RegExp(`^${auth.user.id}/[0-9a-f-]{36}\\.jpg$`);
  if (!afterPaths.every((p) => ownPath.test(p)))
    return { ok: false, message: "รูปที่แนบไม่ถูกต้อง ลองแนบใหม่อีกครั้ง" };
  // What is stored now decides the rules below, not the values in this same submit.
  const { data: stored } = await supabase
    .from("repair_tickets")
    .select("status, urgency, after_image_urls, assignee_id")
    .eq("id", id)
    .maybeSingle();
  if (!stored) return { ok: false, message: "ไม่พบงานซ่อมนี้ หรือไม่มีสิทธิ์แก้ไข" };
  const storedStatus = stored.status as TicketStatus;
  const existingAfter = (stored.after_image_urls as string[] | null) ?? [];

  let afterAll: string[] | null = null;
  if (afterPaths.length > 0) {
    afterAll = [...existingAfter, ...afterPaths];
    if (afterAll.length > 4)
      return { ok: false, message: "รูปหลังซ่อมได้ไม่เกิน 4 รูป" };
  }

  // Closing a job needs something to show for it: technician notes or at least one after photo.
  if (missingCloseEvidence(storedStatus, status, notes, existingAfter.length + afterPaths.length))
    return { ok: false, message: "ปิดงานซ่อมต้องมีบันทึกช่างหรือรูปหลังซ่อมอย่างน้อยหนึ่งอย่าง" };

  // Changing the level is allowed only while the ticket is open, so closing a ticket and fixing its level
  // in one save still works.
  let newUrgency: typeof urgency;
  if (urgency !== undefined && stored.urgency !== urgency) {
    if (!canChangeUrgency(storedStatus))
      return { ok: false, message: "งานที่ปิดแล้วเปลี่ยนความเร่งด่วนไม่ได้" };
    newUrgency = urgency;
  }

  // RLS only lets staff and super_admin update; an empty result means the write was refused.
  const { data, error } = await supabase
    .from("repair_tickets")
    .update({
      ...(newUrgency ? { urgency: newUrgency } : {}),
      ...(assignee !== undefined && assignee !== (stored.assignee_id ?? null) ? { assignee_id: assignee } : {}),
      status,
      estimated_cost: cost,
      technician_notes: notes || null,
      ...(afterAll ? { after_image_urls: afterAll } : {}),
    })
    .eq("id", id)
    .select("id");
  if (error?.message.includes("assignee must be"))
    return { ok: false, message: "มอบหมายได้เฉพาะเจ้าหน้าที่ที่ยังใช้งานอยู่" };
  if (error) return { ok: false, message: `บันทึกไม่สำเร็จ: ${error.message}` };
  if (!data?.length) return { ok: false, message: "ไม่มีสิทธิ์แก้ไขรายการนี้" };

  revalidatePath("/tickets");
  revalidatePath(`/tickets/${id}`);
  revalidatePath("/");
  return { ok: true, message: "บันทึกแล้ว" };
}

/** Staff only (RLS refuses everyone else): merge this report into another open ticket, or split it out again. */
export async function mergeTicket(
  _prev: UpdateResult,
  formData: FormData,
): Promise<UpdateResult> {
  const id = String(formData.get("id") ?? "");
  const mainId = String(formData.get("main_id") ?? "");
  const split = formData.get("split") === "1";
  if (!UUID.test(id) || (!split && (!UUID.test(mainId) || mainId === id)))
    return { ok: false, message: "เลือกงานที่จะรวมด้วยก่อน" };

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

  if (split) {
    const { data, error } = await supabase
      .from("repair_tickets")
      .update({ duplicate_of: null })
      .eq("id", id)
      .select("id");
    if (error || !data?.length)
      return { ok: false, message: "แยกงานไม่สำเร็จ" };
  } else {
    // Reports already merged into this ticket follow it to the new main ticket.
    const moved = await supabase
      .from("repair_tickets")
      .update({ duplicate_of: mainId })
      .eq("duplicate_of", id);
    if (moved.error)
      return {
        ok: false,
        message: "รวมงานไม่สำเร็จ งานหลักอาจถูกรวมกับงานอื่นไปแล้ว",
      };
    const { data, error } = await supabase
      .from("repair_tickets")
      .update({ duplicate_of: mainId })
      .eq("id", id)
      .select("id");
    if (error || !data?.length)
      return {
        ok: false,
        message: "รวมงานไม่สำเร็จ งานหลักอาจถูกรวมกับงานอื่นไปแล้ว",
      };
  }

  revalidatePath("/tickets");
  revalidatePath(`/tickets/${id}`);
  revalidatePath("/");
  return {
    ok: true,
    message: split ? "แยกออกจากงานหลักแล้ว" : "รวมกับงานหลักแล้ว",
  };
}

/** Administrator only (the database function checks again): move tickets, and the reports merged into them, to the trash. */
export async function trashTickets(formData: FormData) {
  const ids = formData
    .getAll("ids")
    .map(String)
    .filter((id) => UUID.test(id));
  if (ids.length === 0 || ids.length > 200 || !hasSupabase())
    redirect("/tickets");
  const session = await getSession();
  if (!session || session.viewer.role !== "super_admin") redirect("/tickets");
  const { data } = await session.supabase.rpc("trash_tickets", { p_ids: ids });
  revalidatePath("/tickets");
  revalidatePath("/");
  redirect(`/tickets?trashed=${Number(data ?? 0)}`);
}

export async function restoreTickets(formData: FormData) {
  const ids = formData
    .getAll("ids")
    .map(String)
    .filter((id) => UUID.test(id));
  const session = await getSession();
  if (ids.length > 0 && session?.viewer.role === "super_admin")
    await session.supabase.rpc("restore_tickets", { p_ids: ids });
  revalidatePath("/trash");
  revalidatePath("/tickets");
  revalidatePath("/");
}

/** Deletes for good, with the photos. Administrator only, and only tickets already in the trash. */
export async function purgeTrashedTickets(formData: FormData) {
  const ids = formData
    .getAll("ids")
    .map(String)
    .filter((id) => UUID.test(id));
  const session = await getSession();
  if (
    ids.length > 0 &&
    ids.length <= 200 &&
    session?.viewer.role === "super_admin"
  )
    await purgeTickets(createAdminClient(), { ids });
  revalidatePath("/trash");
}
