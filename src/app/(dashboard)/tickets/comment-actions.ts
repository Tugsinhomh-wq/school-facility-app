"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/data/session";
import { canComment, cleanComment } from "@/lib/ticket-comments";

const UUID = /^[0-9a-f-]{36}$/i;

export type CommentResult = { ok: boolean; message: string } | null;

/** Adds a line to the thread of a ticket. Role and length are checked here and again by the database. */
export async function postComment(_prev: CommentResult, formData: FormData): Promise<CommentResult> {
  const ticketId = String(formData.get("ticket_id") ?? "");
  const body = cleanComment(formData.get("body"));
  const session = await getSession();
  if (!session) return { ok: false, message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };
  if (!canComment(session.viewer.role) || !UUID.test(ticketId)) return { ok: false, message: "ไม่มีสิทธิ์ส่งความเห็น" };
  if (body === null) return { ok: false, message: "ความเห็นต้องมี 1-1,000 ตัวอักษร" };

  const { error } = await session.supabase.from("repair_ticket_comments").insert({
    ticket_id: ticketId,
    author_id: session.userId,
    body,
  });
  if (error) {
    console.error("post comment failed", { code: error.code });
    return { ok: false, message: "ส่งความเห็นไม่สำเร็จ ลองอีกครั้ง" };
  }
  revalidatePath(`/tickets/${ticketId}`);
  return { ok: true, message: "ส่งความเห็นแล้ว" };
}

/**
 * Marks a ticket as read by the caller, so its "new comment" marker goes away.
 * shortcut: a comment that lands between page load and this call is marked read unseen, fine for a low-traffic thread.
 */
export async function markTicketRead(ticketId: string): Promise<void> {
  const session = await getSession();
  if (!session || !canComment(session.viewer.role) || !UUID.test(ticketId)) return;
  const { error } = await session.supabase
    .from("repair_ticket_reads")
    .upsert({ ticket_id: ticketId, user_id: session.userId, last_read_at: new Date().toISOString() }, { onConflict: "ticket_id,user_id" });
  if (error) {
    console.error("mark read failed", { code: error.code });
    return;
  }
  revalidatePath("/", "layout");
}
