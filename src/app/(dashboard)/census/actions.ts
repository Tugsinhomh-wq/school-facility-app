"use server";

import { revalidatePath } from "next/cache";

import { parseCensusRows } from "@/lib/census-import";
import { mapToRooms, summarizeErrors } from "@/lib/census-map";
import type { ImportError } from "@/lib/cleaning-import";
import { readSheet } from "@/lib/cleaning-sheet";
import { getSession, hasSupabase, isFacilityOfficer } from "@/lib/data/session";

export type CensusResult = {
  ok: boolean;
  message: string;
  /** The first rows in error (all of them when few), by row. */
  errors?: ImportError[];
  /** Errors past the listed ones. */
  more?: number;
  /** After an import: students new to the term, already in it (updated), and the file's total. */
  counts?: { added: number; updated: number; total: number };
  /** After deleting a term's roster. */
  removed?: number;
} | null;

type Db = NonNullable<Awaited<ReturnType<typeof getSession>>>["supabase"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FILE = 1024 * 1024;
const CHUNK = 500;
const PAGE = 1000;
const DEMO = { ok: true, message: "โหมดสาธิต: ยังไม่ได้ตั้งค่า Supabase จึงไม่ได้บันทึกข้อมูลจริง" };

const field = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** The session client of a facility officer, or the reason to refuse. */
async function officerDb(): Promise<Db | CensusResult> {
  if (!hasSupabase()) return DEMO;
  const s = await getSession();
  if (!s) return { ok: false, message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };
  if (!isFacilityOfficer(s.viewer.role))
    return { ok: false, message: "เฉพาะเจ้าหน้าที่งานอาคารสถานที่เท่านั้น" };
  return s.supabase;
}
const isDb = (v: Db | CensusResult): v is Db => v !== null && "from" in v;

function revalidate() {
  revalidatePath("/census", "layout");
}

/**
 * Upload the roster spreadsheet for a term. Every row is checked first (the file, then each room
 * against the term's rooms); any error writes nothing. Then students are upserted by (term, student
 * code): a re-import moves a student to the file's room and renames them. Students already in the
 * term but not in the file stay; deleting is a separate, explicit step.
 */
export async function importRoster(_prev: CensusResult, formData: FormData): Promise<CensusResult> {
  const term = field(formData, "term");
  const file = formData.get("file");
  if (!term) return { ok: false, message: "เลือกภาคเรียน" };
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "เลือกไฟล์ .xlsx หรือ .csv" };
  const kind = /\.xlsx$/i.test(file.name) ? "xlsx" : /\.csv$/i.test(file.name) ? "csv" : null;
  if (!kind) return { ok: false, message: "รับเฉพาะไฟล์ .xlsx หรือ .csv" };
  if (file.size > MAX_FILE) return { ok: false, message: "ไฟล์ใหญ่เกิน 1 MB" };

  const db = await officerDb();
  if (!isDb(db)) return db;

  let sheet: string[][];
  try {
    // shortcut: a 1 MB .xlsx is unzipped fully in memory, fine for officer-only uploads; stream it if this ever opens to everyone.
    sheet = await readSheet(Buffer.from(await file.arrayBuffer()), kind);
  } catch {
    return { ok: false, message: "อ่านไฟล์ไม่ได้ ตรวจสอบว่าเป็นไฟล์ Excel (.xlsx) หรือ CSV แบบ UTF-8" };
  }
  const parsed = parseCensusRows(sheet);

  const rooms = await db.from("classrooms").select("id, name").eq("term", term).eq("is_active", true);
  if (rooms.error) return { ok: false, message: "โหลดห้องของภาคเรียนไม่สำเร็จ ลองใหม่อีกครั้ง ยังไม่ได้บันทึกข้อมูลใด" };
  if (rooms.data.length === 0)
    return { ok: false, message: `ไม่พบห้องในภาคเรียน ${term} ต้องเพิ่มห้องเรียนของภาคเรียนนี้ก่อน` };
  const mapped = mapToRooms(parsed.ok, rooms.data as { id: string; name: string }[], term);

  const errors = [...parsed.errors, ...mapped.errors];
  if (errors.length > 0) return { ok: false, ...summarizeErrors(errors) };
  if (mapped.rows.length === 0) return { ok: false, message: "ไม่พบรายชื่อนักเรียนในไฟล์ (มีแต่แถวหัวตาราง)" };

  // Which codes are already in the term decides new vs updated. Paged: a term has more than 1000 students.
  const existing = new Set<string>();
  for (let at = 0; ; at += PAGE) {
    const { data, error } = await db
      .from("census_students")
      .select("student_code")
      .eq("term", term)
      .order("student_code")
      .range(at, at + PAGE - 1);
    if (error) return { ok: false, message: "ตรวจสอบรายชื่อเดิมไม่สำเร็จ ลองใหม่อีกครั้ง ยังไม่ได้บันทึกข้อมูลใด" };
    for (const r of data as { student_code: string }[]) existing.add(r.student_code);
    if (data.length < PAGE) break;
  }
  const total = mapped.rows.length;
  const updated = mapped.rows.filter((r) => existing.has(r.student_code)).length;

  for (let at = 0; at < total; at += CHUNK) {
    const { error } = await db
      .from("census_students")
      .upsert(mapped.rows.slice(at, at + CHUNK), { onConflict: "term,student_code" });
    if (error) {
      // Codes and counts only: never the rows, which hold names.
      console.error("census import failed", { code: error.code, from: at, total });
      revalidate();
      return {
        ok: false,
        message:
          at === 0
            ? "บันทึกไม่สำเร็จ ยังไม่ได้บันทึกข้อมูลใด ลองใหม่อีกครั้ง"
            : `บันทึกได้เพียงบางส่วน (${at} จาก ${total} รายการ) กรุณานำเข้าไฟล์เดิมอีกครั้ง ระบบจะอัปเดตต่อให้ครบ`,
      };
    }
  }
  revalidate();
  const counts = { added: total - updated, updated, total };
  return {
    ok: true,
    message: `นำเข้า ${total} คนในภาคเรียน ${term} แล้ว (เพิ่มใหม่ ${counts.added} คน อัปเดต ${counts.updated} คน)`,
    counts,
  };
}

/** Delete one student (officers). RLS hides nothing from an officer, so zero rows means already gone. */
export async function deleteStudent(id: string): Promise<CensusResult> {
  if (!UUID.test(id)) return { ok: false, message: "ข้อมูลนักเรียนไม่ถูกต้อง ลองโหลดหน้าใหม่" };
  const db = await officerDb();
  if (!isDb(db)) return db;
  const { data, error } = await db.from("census_students").delete().eq("id", id).select("id");
  if (error) {
    console.error("census delete student failed", { code: error.code });
    return { ok: false, message: "ลบไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  revalidate();
  return data.length === 0
    ? { ok: true, message: "ไม่พบรายชื่อนี้แล้ว", removed: 0 }
    : { ok: true, message: "ลบรายชื่อแล้ว", removed: 1 };
}

/** Delete every student of a term, only when `confirm` is exactly the term typed again. */
export async function deleteTermRoster(_prev: CensusResult, formData: FormData): Promise<CensusResult> {
  const term = field(formData, "term");
  if (!term) return { ok: false, message: "เลือกภาคเรียน" };
  if (String(formData.get("confirm") ?? "").trim() !== term)
    return { ok: false, message: `ยังไม่ได้ลบ พิมพ์ภาคเรียน ${term} ให้ตรงเพื่อยืนยัน` };
  const db = await officerDb();
  if (!isDb(db)) return db;
  const { count, error } = await db
    .from("census_students")
    .delete({ count: "exact" })
    .eq("term", term);
  if (error) {
    console.error("census delete term failed", { code: error.code });
    return { ok: false, message: "ลบรายชื่อไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  revalidate();
  const removed = count ?? 0;
  return {
    ok: true,
    message: removed === 0 ? `ภาคเรียน ${term} ไม่มีรายชื่อให้ลบ` : `ลบรายชื่อ ${removed} คนของภาคเรียน ${term} แล้ว`,
    removed,
  };
}
