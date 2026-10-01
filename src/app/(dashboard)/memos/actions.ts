"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { draftFromTicket } from "@/lib/memo/draft";
import { MOCK_MEMOS } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";
import type { TicketRow } from "@/types/tickets";
import { getAuth } from "@/lib/supabase/auth";

export type SaveResult = { ok: boolean; message: string } | null;

const demo = () => !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Creates the first draft from a ticket, or opens the memo that already exists for it. */
export async function createMemoFromTicket(formData: FormData) {
  const ticketId = String(formData.get("ticket_id") ?? "");
  if (!ticketId) redirect("/memos");

  if (demo()) redirect(`/memos/${MOCK_MEMOS.find((m) => m.reference_id === ticketId)?.id ?? MOCK_MEMOS[0].id}`);

  const supabase = await createClient();
  const { data: auth } = await getAuth(supabase);
  if (!auth.user) redirect("/login");

  const { data: existing } = await supabase
    .from("memorandums")
    .select("id")
    .eq("origin_module", "repair")
    .eq("reference_id", ticketId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) redirect(`/memos/${existing.id}`);

  const { data: ticket } = await supabase
    .from("repair_tickets")
    .select("*, building:buildings(name), room:rooms(room_number, name), reporter:profiles(full_name)")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) redirect("/memos");

  const { data: author } = await supabase.from("profiles").select("full_name, position").eq("id", auth.user.id).maybeSingle();

  // doc_ref_no is left empty: the database assigns MEMO-YYYYMM-XXXX until the records office numbers it.
  const { data: memo, error } = await supabase
    .from("memorandums")
    .insert({
      doc_ref_no: "",
      origin_module: "repair",
      reference_id: ticketId,
      author_id: auth.user.id,
      approval_mode: "paper_hybrid",
      ...draftFromTicket(ticket as unknown as TicketRow, author),
    })
    .select("id")
    .single();
  if (error || !memo) redirect(`/memos?error=${encodeURIComponent("สร้างร่างไม่สำเร็จ ตรวจสอบว่าบัญชีนี้เป็นเจ้าหน้าที่")}`);

  revalidatePath("/memos");
  revalidatePath("/");
  redirect(`/memos/${memo.id}`);
}

export async function saveMemo(_prev: SaveResult, formData: FormData): Promise<SaveResult> {
  const id = String(formData.get("id") ?? "");
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const subject = str("subject");
  const recipient = str("recipient");
  const body = str("body_content");
  const proposal = str("proposal");
  const docRef = str("doc_ref_no");

  if (!id) return { ok: false, message: "ไม่พบบันทึกข้อความ" };
  if (!subject || !recipient || !body) return { ok: false, message: "กรุณากรอกเรื่อง เรียน และข้อความให้ครบ" };
  if (subject.length > 300 || body.length > 10000 || proposal.length > 3000) return { ok: false, message: "ข้อความยาวเกินกำหนด" };

  if (demo()) return { ok: true, message: "โหมดสาธิต: ยังไม่ได้ตั้งค่า Supabase จึงไม่ได้บันทึกข้อมูลจริง" };

  const supabase = await createClient();
  const { data: auth } = await getAuth(supabase);
  if (!auth.user) return { ok: false, message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };

  const update: Record<string, string | null> = { subject, recipient, body_content: body, proposal: proposal || null };
  if (docRef) update.doc_ref_no = docRef; // never blank it: the column is required and unique

  const { data, error } = await supabase.from("memorandums").update(update).eq("id", id).select("id");
  if (error) {
    return { ok: false, message: error.code === "23505" ? "เลขที่หนังสือนี้ถูกใช้แล้ว" : `บันทึกไม่สำเร็จ: ${error.message}` };
  }
  if (!data?.length) return { ok: false, message: "ไม่มีสิทธิ์แก้ไขบันทึกนี้" };

  revalidatePath("/memos");
  revalidatePath(`/memos/${id}`);
  return { ok: true, message: "บันทึกแล้ว" };
}
