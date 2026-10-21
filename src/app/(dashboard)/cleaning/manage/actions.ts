"use server";

import { revalidatePath } from "next/cache";

import { HEADERS, parseClassroomRows, type ImportError } from "@/lib/cleaning-import";
import { readSheet } from "@/lib/cleaning-sheet";
import { getSession, hasSupabase, isFacilityOfficer } from "@/lib/data/session";
import { isYmd } from "@/lib/time";

export type SetupResult = { ok: boolean; message: string; errors?: ImportError[] } | null;

type Db = NonNullable<Awaited<ReturnType<typeof getSession>>>["supabase"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Buddhist year + term 1-3, e.g. "2569/1". One digit keeps text order = term order.
const TERM = /^\d{4}\/[1-3]$/;
const MAX_FILE = 1024 * 1024;
const DEMO = { ok: true, message: "โหมดสาธิต: ยังไม่ได้ตั้งค่า Supabase จึงไม่ได้บันทึกข้อมูลจริง" };
const TERM_HINT = "ภาคเรียนต้องอยู่ในรูป ปีการศึกษา/ภาคเรียน เช่น 2569/1";

const field = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** The session client of a facility officer, or the reason to refuse. */
async function officerDb(): Promise<Db | SetupResult> {
  if (!hasSupabase()) return DEMO;
  const s = await getSession();
  if (!s) return { ok: false, message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" };
  if (!isFacilityOfficer(s.viewer.role))
    return { ok: false, message: "เฉพาะเจ้าหน้าที่งานอาคารสถานที่เท่านั้น" };
  return s.supabase;
}
const isDb = (v: Db | SetupResult): v is Db => v !== null && "from" in v;

function revalidate() {
  revalidatePath("/cleaning");
  revalidatePath("/cleaning/manage");
  revalidatePath("/");
}

/**
 * Advisor emails to profile ids. Every email must belong to an active account: a teacher gets a
 * profile only after signing in once. Returns the ids, or one message per bad email.
 */
async function resolveEmails(db: Db, emails: string[]) {
  // Emails arrive lower-cased (parser); auth stores them lower-cased, so an exact match is enough.
  const { data, error } =
    emails.length === 0
      ? { data: [], error: null }
      : await db.from("profiles").select("id, email, is_active").in("email", [...new Set(emails)]);
  if (error) return null;
  const byEmail = new Map(
    (data as { id: string; email: string; is_active: boolean }[]).map((p) => [p.email.toLowerCase(), p]),
  );
  const problem = (e: string) => {
    const p = byEmail.get(e);
    if (!p) return `ไม่พบบัญชีของ ${e} (ครูต้องเข้าสู่ระบบด้วยอีเมลนี้อย่างน้อยหนึ่งครั้งก่อน)`;
    if (!p.is_active) return `บัญชีของ ${e} ถูกปิดใช้งาน`;
    return null;
  };
  return { idOf: (e: string) => byEmail.get(e)!.id, problem };
}

/**
 * Make each classroom's advisors exactly `ids`: add the new ones first, then drop the rest, so a
 * failure in between leaves extra advisors, never a room with none.
 */
async function setAdvisors(db: Db, sets: { classroomId: string; ids: string[] }[]) {
  if (sets.length === 0) return true;
  const pairs = sets.flatMap((s) => s.ids.map((user_id) => ({ classroom_id: s.classroomId, user_id })));
  if (pairs.length > 0) {
    const add = await db
      .from("classroom_advisors")
      .upsert(pairs, { onConflict: "classroom_id,user_id", ignoreDuplicates: true });
    if (add.error) return false;
  }
  const { data: current, error } = await db
    .from("classroom_advisors")
    .select("classroom_id, user_id")
    .in("classroom_id", sets.map((s) => s.classroomId));
  if (error) return false;
  for (const s of sets) {
    const stale = (current as { classroom_id: string; user_id: string }[])
      .filter((a) => a.classroom_id === s.classroomId && !s.ids.includes(a.user_id))
      .map((a) => a.user_id);
    if (stale.length === 0) continue;
    const del = await db
      .from("classroom_advisors")
      .delete()
      .eq("classroom_id", s.classroomId)
      .in("user_id", stale);
    if (del.error) return false;
  }
  return true;
}

/** Add a classroom (no `id`) or edit one: name, building, zone, advisors (and active, on edit). */
export async function saveClassroom(_prev: SetupResult, formData: FormData): Promise<SetupResult> {
  const id = field(formData, "id");
  const term = field(formData, "term");
  const buildingId = field(formData, "building_id") || null;
  if (id && !UUID.test(id)) return { ok: false, message: "ข้อมูลห้องไม่ถูกต้อง ลองโหลดหน้าใหม่" };
  if (!id && !TERM.test(term)) return { ok: false, message: TERM_HINT };
  if (buildingId && !UUID.test(buildingId)) return { ok: false, message: "เลือกอาคารใหม่อีกครั้ง" };
  // Same rules as one spreadsheet row: Thai digits, spaces, email shape, required fields.
  const parsed = parseClassroomRows([
    HEADERS,
    [field(formData, "name"), "", field(formData, "advisor_emails"), field(formData, "zone")],
  ]);
  const room = parsed.ok[0];
  if (!room) return { ok: false, message: parsed.errors.map((e) => e.message).join(" · ") };
  if (room.name.length > 40 || room.zone.length > 200)
    return { ok: false, message: "ชื่อห้องยาวเกิน 40 ตัวอักษร หรือชื่อเขตยาวเกิน 200 ตัวอักษร" };

  const db = await officerDb();
  if (!isDb(db)) return db;
  const people = await resolveEmails(db, room.advisorEmails);
  if (!people) return { ok: false, message: "ตรวจสอบอีเมลครูที่ปรึกษาไม่สำเร็จ ลองใหม่อีกครั้ง" };
  const bad = room.advisorEmails.map(people.problem).filter(Boolean);
  if (bad.length > 0) return { ok: false, message: bad.join(" · ") };

  const values = { name: room.name, building_id: buildingId, zone: room.zone };
  const saved = id
    ? await db
        .from("classrooms")
        .update({ ...values, is_active: formData.get("is_active") === "on" })
        .eq("id", id)
        .select("id")
        .maybeSingle()
    : await db.from("classrooms").insert({ ...values, term }).select("id").single();
  if (saved.error?.code === "23505") return { ok: false, message: `มีห้อง ${room.name} ในภาคเรียนนี้แล้ว` };
  if (saved.error || !saved.data) return { ok: false, message: "บันทึกห้องไม่สำเร็จ ลองใหม่อีกครั้ง" };

  const advisorsOk = await setAdvisors(db, [
    { classroomId: saved.data.id as string, ids: room.advisorEmails.map(people.idOf) },
  ]);
  revalidate();
  if (!advisorsOk)
    return { ok: false, message: `บันทึกห้อง ${room.name} แล้ว แต่บันทึกครูที่ปรึกษาไม่สำเร็จ กรุณากดบันทึกอีกครั้ง` };
  return { ok: true, message: id ? `บันทึกห้อง ${room.name} แล้ว` : `เพิ่มห้อง ${room.name} แล้ว` };
}

/**
 * Upload the classroom spreadsheet for a term. Everything is checked first (rows, buildings,
 * emails); any error writes nothing. Then each room is upserted by (term, name) and its advisors
 * become exactly the file's. Rooms not in the file are left as they are.
 */
export async function importClassrooms(_prev: SetupResult, formData: FormData): Promise<SetupResult> {
  const term = field(formData, "term");
  const file = formData.get("file");
  if (!TERM.test(term)) return { ok: false, message: TERM_HINT };
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "เลือกไฟล์ .xlsx หรือ .csv" };
  const kind = /\.xlsx$/i.test(file.name) ? "xlsx" : /\.csv$/i.test(file.name) ? "csv" : null;
  if (!kind) return { ok: false, message: "รับเฉพาะไฟล์ .xlsx หรือ .csv" };
  if (file.size > MAX_FILE) return { ok: false, message: "ไฟล์ใหญ่เกิน 1 MB" };

  const db = await officerDb();
  if (!isDb(db)) return db;

  let rows: string[][];
  try {
    // shortcut: a 1 MB .xlsx is unzipped fully in memory, fine for officer-only uploads; stream it if this ever opens to everyone.
    rows = await readSheet(Buffer.from(await file.arrayBuffer()), kind);
  } catch {
    return { ok: false, message: "อ่านไฟล์ไม่ได้ ตรวจสอบว่าเป็นไฟล์ Excel (.xlsx) หรือ CSV แบบ UTF-8" };
  }
  const parsed = parseClassroomRows(rows);
  const errors = [...parsed.errors];

  const [people, buildings] = await Promise.all([
    resolveEmails(db, parsed.ok.flatMap((r) => r.advisorEmails)),
    db.from("buildings").select("id, name").eq("is_active", true).not("code", "like", "HALL-%"),
  ]);
  if (!people || buildings.error)
    return { ok: false, message: "ตรวจสอบอีเมลหรืออาคารไม่สำเร็จ ลองใหม่อีกครั้ง ยังไม่ได้บันทึกข้อมูลใด" };
  const buildingIds = new Map<string, string[]>();
  for (const b of buildings.data as { id: string; name: string }[])
    buildingIds.set(b.name.trim(), [...(buildingIds.get(b.name.trim()) ?? []), b.id]);

  for (const room of parsed.ok) {
    const { row } = room;
    if (room.name.length > 40) errors.push({ row, message: "ชื่อห้องยาวเกิน 40 ตัวอักษร" });
    if (room.zone.length > 200) errors.push({ row, message: "ชื่อเขตยาวเกิน 200 ตัวอักษร" });
    const ids = room.building ? buildingIds.get(room.building) : [];
    if (!ids) errors.push({ row, message: `ไม่พบอาคาร "${room.building}" ในระบบ` });
    else if (ids.length > 1) errors.push({ row, message: `มีอาคารชื่อ "${room.building}" มากกว่าหนึ่งแห่ง` });
    for (const e of room.advisorEmails) {
      const message = people.problem(e);
      if (message) errors.push({ row, message });
    }
  }

  if (errors.length > 0)
    return {
      ok: false,
      message: `พบข้อผิดพลาด ${errors.length} รายการ ยังไม่ได้บันทึกข้อมูลใด แก้ไฟล์แล้วนำเข้าใหม่`,
      errors: errors.sort((a, b) => a.row - b.row),
    };
  if (parsed.ok.length === 0) return { ok: false, message: "ไม่พบข้อมูลห้องในไฟล์ (มีแต่แถวหัวตาราง)" };

  const { data: saved, error } = await db
    .from("classrooms")
    .upsert(
      parsed.ok.map((r) => ({
        term,
        name: r.name,
        building_id: r.building ? buildingIds.get(r.building)![0] : null,
        zone: r.zone,
        is_active: true,
      })),
      { onConflict: "term,name" },
    )
    .select("id, name");
  if (error || !saved) return { ok: false, message: "บันทึกไม่สำเร็จ ยังไม่ได้บันทึกข้อมูลใด ลองใหม่อีกครั้ง" };

  const idOfRoom = new Map((saved as { id: string; name: string }[]).map((r) => [r.name, r.id]));
  const advisorsOk = await setAdvisors(
    db,
    parsed.ok.map((r) => ({ classroomId: idOfRoom.get(r.name)!, ids: r.advisorEmails.map(people.idOf) })),
  );
  revalidate();
  if (!advisorsOk)
    return {
      ok: false,
      message: `บันทึกห้อง ${saved.length} ห้องแล้ว แต่บันทึกครูที่ปรึกษาไม่ครบ กรุณานำเข้าไฟล์เดิมอีกครั้ง`,
    };
  return { ok: true, message: `นำเข้า ${saved.length} ห้องในภาคเรียน ${term} แล้ว` };
}

/**
 * Start a new term from an old one: copy its active classrooms and their advisors. Rooms whose
 * name is already in the new term are skipped, so running it twice adds nothing.
 */
export async function rolloverTerm(_prev: SetupResult, formData: FormData): Promise<SetupResult> {
  const from = field(formData, "from_term");
  const to = field(formData, "to_term");
  if (!TERM.test(from) || !TERM.test(to)) return { ok: false, message: TERM_HINT };
  if (from === to) return { ok: false, message: "ภาคเรียนต้นทางและปลายทางต้องไม่ซ้ำกัน" };

  const db = await officerDb();
  if (!isDb(db)) return db;

  const [source, target] = await Promise.all([
    db
      .from("classrooms")
      .select("name, building_id, zone, advisors:classroom_advisors(user_id)")
      .eq("term", from)
      .eq("is_active", true),
    db.from("classrooms").select("name").eq("term", to),
  ]);
  if (source.error || target.error) return { ok: false, message: "โหลดข้อมูลภาคเรียนไม่สำเร็จ ลองใหม่อีกครั้ง" };
  const rooms = source.data as {
    name: string;
    building_id: string | null;
    zone: string;
    advisors: { user_id: string }[] | null;
  }[];
  if (rooms.length === 0) return { ok: false, message: `ไม่พบห้องที่ใช้งานในภาคเรียน ${from}` };
  const present = new Set((target.data as { name: string }[]).map((r) => r.name));
  const missing = rooms.filter((r) => !present.has(r.name));
  if (missing.length === 0)
    return { ok: true, message: `ภาคเรียน ${to} มีครบทุกห้องแล้ว (ข้าม ${rooms.length} ห้อง)` };

  // ignoreDuplicates: a room added meanwhile (or a double submit) is skipped, not duplicated.
  const { data: created, error } = await db
    .from("classrooms")
    .upsert(
      missing.map((r) => ({ term: to, name: r.name, building_id: r.building_id, zone: r.zone })),
      { onConflict: "term,name", ignoreDuplicates: true },
    )
    .select("id, name");
  if (error || !created) return { ok: false, message: "คัดลอกไม่สำเร็จ ยังไม่ได้บันทึกข้อมูลใด ลองใหม่อีกครั้ง" };

  const advisorsOf = new Map(missing.map((r) => [r.name, (r.advisors ?? []).map((a) => a.user_id)]));
  const advisorsOk = await setAdvisors(
    db,
    (created as { id: string; name: string }[]).map((r) => ({ classroomId: r.id, ids: advisorsOf.get(r.name) ?? [] })),
  );
  revalidate();
  const skipped = rooms.length - created.length;
  const summary = `คัดลอก ${created.length} ห้องไปภาคเรียน ${to}${skipped > 0 ? ` (ข้าม ${skipped} ห้องที่มีอยู่แล้ว)` : ""}`;
  if (!advisorsOk)
    return {
      ok: false,
      message: `${summary} แต่คัดลอกครูที่ปรึกษาไม่ครบ ตรวจสอบครูที่ปรึกษาของห้องในภาคเรียน ${to} ด้านล่าง`,
    };
  return { ok: true, message: summary };
}

/** Mark a school day off (holiday, closure); setting it again updates the reason. */
export async function setOffDay(_prev: SetupResult, formData: FormData): Promise<SetupResult> {
  const day = field(formData, "day");
  const reason = field(formData, "reason").replace(/\s+/g, " ").slice(0, 100) || null;
  if (!isYmd(day)) return { ok: false, message: "เลือกวันที่" };
  const db = await officerDb();
  if (!isDb(db)) return db;
  const { error } = await db.from("school_off_days").upsert({ day, reason }, { onConflict: "day" });
  if (error) return { ok: false, message: "บันทึกวันหยุดไม่สำเร็จ ลองใหม่อีกครั้ง" };
  revalidate();
  return { ok: true, message: "บันทึกวันหยุดแล้ว" };
}

export async function removeOffDay(formData: FormData): Promise<SetupResult> {
  const day = field(formData, "day");
  if (!isYmd(day)) return { ok: false, message: "วันที่ไม่ถูกต้อง" };
  const db = await officerDb();
  if (!isDb(db)) return db;
  const { error } = await db.from("school_off_days").delete().eq("day", day);
  if (error) return { ok: false, message: "ลบวันหยุดไม่สำเร็จ ลองใหม่อีกครั้ง" };
  revalidate();
  return { ok: true, message: "ลบวันหยุดแล้ว" };
}
