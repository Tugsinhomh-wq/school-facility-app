"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";

import { canEditProject, canReview } from "@/lib/control/access";
import {
  cleanText,
  isUuid,
  parseActionForm,
  parseAssessmentForm,
  parseMissionForm,
  parseOwnerEmail,
  parseProjectForm,
  parseReviewForm,
  parseScoreForm,
} from "@/lib/control/parse";
import { getSession, hasSupabase } from "@/lib/data/session";
import type { UserRole } from "@/types/database";

export type ControlResult = { ok: boolean; message: string } | null;

// These actions only ever use the signed-in user's own client, so Row Level Security and the guard
// trigger in supabase/control_01.sql stay in force. The checks here (canEditProject, canReview) give
// clear messages and stop early; they are not the only line of defence. Never switch these writes to
// an admin/service-role client or a SECURITY DEFINER function: that would skip RLS and the guard.

type Db = NonNullable<Awaited<ReturnType<typeof getSession>>>["supabase"];
type Ctx = { db: Db; userId: string; role: UserRole };
type Refusal = { ok: false; message: string };
type ProjectRef = { ownerId: string; confirmed: boolean; fiscalYear: number; groupKey: string };

const DEMO: ControlResult = { ok: true, message: "โหมดสาธิต: ยังไม่ได้ตั้งค่า Supabase จึงไม่ได้บันทึกข้อมูลจริง" };
const NO_ACCESS = "ไม่มีสิทธิ์หรือไม่พบรายการ";
const RELOAD = "ข้อมูลไม่ถูกต้อง ลองโหลดหน้าใหม่";
const LOAD_FAILED = "โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง";
const NOT_OFFICER = "เฉพาะเจ้าหน้าที่หรือหัวหน้ากลุ่มงานเท่านั้น";
const NOT_OWNER = "เฉพาะเจ้าของโครงการหรือเจ้าหน้าที่";
const CONFIRMED = "หัวหน้ายืนยันโครงการนี้แล้ว เจ้าของแก้ไขไม่ได้ ขอให้เจ้าหน้าที่ยกเลิกการยืนยันก่อน";
const NOTHING = "ไม่มีข้อมูลที่ต้องบันทึก";

const field = (f: FormData, k: string) => cleanText(f.get(k));
const refuse = (message: string): Refusal => ({ ok: false, message });

function revalidate() {
  // "layout" covers /control and every page under it (a project or mission page that is open now).
  revalidatePath("/control", "layout");
}

/** The signed-in user with their own client, or the reason to refuse. Executives only read (spec section 2). */
async function userCtx(): Promise<Ctx | ControlResult> {
  if (!hasSupabase()) return DEMO;
  const s = await getSession();
  if (!s) return refuse("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  if (s.viewer.role === "executive") return refuse("ผู้บริหารดูข้อมูลได้อย่างเดียว");
  return { db: s.supabase, userId: s.userId, role: s.viewer.role };
}
const isCtx = (v: Ctx | ControlResult): v is Ctx => v !== null && "db" in v;

/** Like userCtx, for officers only (staff, head, super_admin). */
async function officerCtx(): Promise<Ctx | ControlResult> {
  const c = await userCtx();
  if (!isCtx(c)) return c;
  return canReview(c.role) ? c : refuse(NOT_OFFICER);
}

/** What a failed write means to the user. P0001 is our own guard trigger, whose message is Thai and meant to be shown. */
function failure(error: { code?: string; message?: string }, fallback: string): Refusal {
  if (error.code === "42501") return refuse(NO_ACCESS);
  if (error.code === "P0001" && error.message) return refuse(error.message);
  // Code and message only: no row data or user input goes to the log.
  console.error(`[control] write failed: ${error.code ?? "-"} ${error.message ?? ""}`);
  return refuse(fallback);
}

/**
 * Check an UPDATE ... RETURNING or DELETE ... RETURNING. A row Row Level Security hides is not an
 * error, it is just not touched, so zero rows back means "no permission or not found".
 */
function outcome(res: { data: unknown; error: { code?: string; message?: string } | null }, fallback: string): Refusal | null {
  if (res.error) return failure(res.error, fallback);
  if (!Array.isArray(res.data) || res.data.length === 0) return refuse(NO_ACCESS);
  return null;
}

/** The project's owner and state, read through RLS: a project the user may not see is "not found". */
async function findProject(db: Db, id: string): Promise<ProjectRef | Refusal> {
  const { data, error } = await db
    .from("control_projects")
    .select("owner_id, confirmed_at, fiscal_year, group_key")
    .eq("id", id)
    .maybeSingle();
  if (error) return refuse(LOAD_FAILED);
  if (!data) return refuse(NO_ACCESS);
  const r = data as unknown as { owner_id: string; confirmed_at: string | null; fiscal_year: number; group_key: string };
  return { ownerId: r.owner_id, confirmed: r.confirmed_at !== null, fiscalYear: r.fiscal_year, groupKey: r.group_key };
}
const isRefusal = (v: ProjectRef | Refusal): v is Refusal => "message" in v;

/** The parent project of a measure. */
async function findProjectOfAction(db: Db, actionId: string): Promise<(ProjectRef & { projectId: string }) | Refusal> {
  const { data, error } = await db.from("control_actions").select("project_id").eq("id", actionId).maybeSingle();
  if (error) return refuse(LOAD_FAILED);
  if (!data) return refuse(NO_ACCESS);
  const projectId = (data as unknown as { project_id: string }).project_id;
  const p = await findProject(db, projectId);
  return isRefusal(p) ? p : { ...p, projectId };
}

/**
 * canEditProject, with the reason when it says no. `ownerAlways` is for the measures: the owner
 * keeps them up to date even after the head has confirmed the project (the RLS policy agrees).
 */
function denyEdit(p: ProjectRef, ctx: Ctx, ownerAlways = false): Refusal | null {
  if (canEditProject({ ownerId: p.ownerId, confirmed: ownerAlways ? false : p.confirmed }, ctx)) return null;
  return refuse(ctx.userId === p.ownerId ? CONFIRMED : NOT_OWNER);
}

/**
 * An owner's account id from their email, the way resolveEmails does it in cleaning/manage/actions.ts:
 * emails are stored lower-cased, the account must exist (the teacher signed in once) and be active.
 */
async function ownerIdFromEmail(db: Db, email: string): Promise<{ id: string } | Refusal> {
  const { data, error } = await db.from("profiles").select("id, is_active").eq("email", email).maybeSingle();
  if (error) return refuse("ตรวจสอบอีเมลเจ้าของโครงการไม่สำเร็จ ลองใหม่อีกครั้ง");
  const p = data as unknown as { id: string; is_active: boolean } | null;
  if (!p) return refuse(`ไม่พบบัญชีของ ${email} (ต้องเข้าสู่ระบบด้วยอีเมลนี้อย่างน้อยหนึ่งครั้งก่อน)`);
  if (!p.is_active) return refuse(`บัญชีของ ${email} ถูกปิดใช้งาน`);
  return { id: p.id };
}

// --- projects ------------------------------------------------------------------------------------

/**
 * Add a project (no `id`) or edit one. Anyone may add a project in their own name; only an officer
 * may name another owner (`owner_email`), and change the year or group of an existing project.
 */
export async function saveProject(_prev: ControlResult, formData: FormData): Promise<ControlResult> {
  const id = field(formData, "id");
  if (id && !isUuid(id)) return refuse(RELOAD);
  const parsed = parseProjectForm(formData, id ? "update" : "create");
  if (!parsed.ok) return refuse(parsed.message);
  const email = parseOwnerEmail(String(formData.get("owner_email") ?? ""));
  if (!email.ok) return refuse(email.message);
  const patch = parsed.value;

  const ctx = await userCtx();
  if (!isCtx(ctx)) return ctx;
  const officer = canReview(ctx.role);
  if (email.value && !officer) return refuse("เฉพาะเจ้าหน้าที่เท่านั้นที่กำหนดเจ้าของโครงการเป็นคนอื่นได้");
  let ownerId: string | null = null;
  if (email.value) {
    const o = await ownerIdFromEmail(ctx.db, email.value);
    if ("message" in o) return o;
    ownerId = o.id;
  }

  if (!id) {
    const { data, error } = await ctx.db
      .from("control_projects")
      .insert({ ...patch, owner_id: ownerId ?? ctx.userId })
      .select("id")
      .single();
    if (error) return failure(error, "เพิ่มโครงการไม่สำเร็จ ลองใหม่อีกครั้ง");
    revalidate();
    // The new project's page is where its risk score and measures are filled in next.
    const newId = (data as unknown as { id?: string } | null)?.id;
    if (isUuid(newId)) redirect(`/control/projects/${newId}`);
    return { ok: true, message: `เพิ่มโครงการ ${patch.name} แล้ว` };
  }

  const project = await findProject(ctx.db, id);
  if (isRefusal(project)) return project;
  const denied = denyEdit(project, ctx);
  if (denied) return denied;
  if (!officer) {
    // The database refuses it too (guard trigger); say so in words before trying.
    if ((patch.fiscal_year ?? project.fiscalYear) !== project.fiscalYear || (patch.group_key ?? project.groupKey) !== project.groupKey)
      return refuse("เปลี่ยนปีงบประมาณหรือกลุ่มงานของโครงการได้เฉพาะเจ้าหน้าที่");
    delete patch.fiscal_year;
    delete patch.group_key;
  }
  const values = { ...patch, ...(ownerId ? { owner_id: ownerId } : {}) };
  if (Object.keys(values).length === 0) return refuse(NOTHING);
  const bad = outcome(await ctx.db.from("control_projects").update(values).eq("id", id).select("id"), "บันทึกโครงการไม่สำเร็จ ลองใหม่อีกครั้ง");
  if (bad) return bad;
  revalidate();
  return { ok: true, message: "บันทึกโครงการแล้ว" };
}

/** The owner's (or an officer's) likelihood and impact, both 1-5. */
export async function scoreProject(_prev: ControlResult, formData: FormData): Promise<ControlResult> {
  const id = field(formData, "id");
  if (!isUuid(id)) return refuse(RELOAD);
  const parsed = parseScoreForm(formData);
  if (!parsed.ok) return refuse(parsed.message);

  const ctx = await userCtx();
  if (!isCtx(ctx)) return ctx;
  const project = await findProject(ctx.db, id);
  if (isRefusal(project)) return project;
  const denied = denyEdit(project, ctx);
  if (denied) return denied;
  const bad = outcome(await ctx.db.from("control_projects").update(parsed.value).eq("id", id).select("id"), "บันทึกคะแนนไม่สำเร็จ ลองใหม่อีกครั้ง");
  if (bad) return bad;
  revalidate();
  return { ok: true, message: "บันทึกคะแนนความเสี่ยงแล้ว" };
}

/**
 * The head's side, officers only: the head's likelihood / impact (an empty one means "use the owner's
 * value on that axis"), the mission, and confirm ("1") / withdraw the confirmation ("0").
 */
export async function reviewProject(_prev: ControlResult, formData: FormData): Promise<ControlResult> {
  const id = field(formData, "id");
  if (!isUuid(id)) return refuse(RELOAD);
  const parsed = parseReviewForm(formData);
  if (!parsed.ok) return refuse(parsed.message);

  const ctx = await officerCtx();
  if (!isCtx(ctx)) return ctx;
  const { confirm, ...rest } = parsed.value;
  const values: Record<string, unknown> = { ...rest };
  if (confirm === true) {
    values.confirmed_at = new Date().toISOString();
    values.confirmed_by = ctx.userId;
  } else if (confirm === false) {
    values.confirmed_at = null;
    values.confirmed_by = null;
  }
  if (Object.keys(values).length === 0) return refuse(NOTHING);

  const res = await ctx.db.from("control_projects").update(values).eq("id", id).select("id");
  if (res.error?.code === "23503") return refuse("ไม่พบภารกิจที่เลือก ลองโหลดหน้าใหม่");
  const bad = outcome(res, "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
  if (bad) return bad;
  revalidate();
  return { ok: true, message: confirm === true ? "ยืนยันโครงการแล้ว" : confirm === false ? "ยกเลิกการยืนยันแล้ว" : "บันทึกแล้ว" };
}

/**
 * Remove a project (and, by the foreign key, its measures). Only whoever canEditProject may. On success
 * it goes to the list of the project's year: the page it was called from would be a 404 now. A delete
 * that touched no row (nothing deleted) is refused and does not redirect.
 */
export async function deleteProject(formData: FormData): Promise<ControlResult> {
  const id = field(formData, "id");
  if (!isUuid(id)) return refuse(RELOAD);

  const ctx = await userCtx();
  if (!isCtx(ctx)) return ctx;
  const project = await findProject(ctx.db, id);
  if (isRefusal(project)) return project;
  const denied = denyEdit(project, ctx);
  if (denied) return denied;
  const bad = outcome(await ctx.db.from("control_projects").delete().eq("id", id).select("id"), "ลบโครงการไม่สำเร็จ ลองใหม่อีกครั้ง");
  if (bad) return bad;
  revalidate();
  redirect(`/control?fy=${project.fiscalYear}`, RedirectType.replace);
}

// --- missions (officers only) --------------------------------------------------------------------

/** Add a mission (no `id`) or edit one, with its five CSA steps. */
export async function saveMission(_prev: ControlResult, formData: FormData): Promise<ControlResult> {
  const id = field(formData, "id");
  if (id && !isUuid(id)) return refuse(RELOAD);
  const parsed = parseMissionForm(formData, id ? "update" : "create");
  if (!parsed.ok) return refuse(parsed.message);

  const ctx = await officerCtx();
  if (!isCtx(ctx)) return ctx;
  if (!id) {
    const { data, error } = await ctx.db.from("control_missions").insert(parsed.value).select("id").single();
    if (error) return failure(error, "เพิ่มภารกิจไม่สำเร็จ ลองใหม่อีกครั้ง");
    revalidate();
    // The new mission's page is where its five CSA steps are filled in next.
    const newId = (data as unknown as { id?: string } | null)?.id;
    if (isUuid(newId)) redirect(`/control/missions/${newId}`);
    return { ok: true, message: `เพิ่มภารกิจ ${parsed.value.name} แล้ว` };
  }
  if (Object.keys(parsed.value).length === 0) return refuse(NOTHING);
  const bad = outcome(await ctx.db.from("control_missions").update(parsed.value).eq("id", id).select("id"), "บันทึกภารกิจไม่สำเร็จ ลองใหม่อีกครั้ง");
  if (bad) return bad;
  revalidate();
  return { ok: true, message: "บันทึกภารกิจแล้ว" };
}

/**
 * Deleting a mission unlinks its projects (the foreign key sets their mission_id to empty). On success
 * it goes to the list of that mission's year: the page it was called from would be a 404 now.
 */
export async function deleteMission(formData: FormData): Promise<ControlResult> {
  const id = field(formData, "id");
  if (!isUuid(id)) return refuse(RELOAD);

  const ctx = await officerCtx();
  if (!isCtx(ctx)) return ctx;
  const res = await ctx.db.from("control_missions").delete().eq("id", id).select("id, fiscal_year");
  const bad = outcome(res, "ลบภารกิจไม่สำเร็จ ลองใหม่อีกครั้ง");
  if (bad) return bad;
  revalidate();
  const fy = (res.data as unknown as { fiscal_year?: number }[])[0]?.fiscal_year;
  redirect(Number.isInteger(fy) ? `/control/missions?fy=${fy}` : "/control/missions", RedirectType.replace);
}

// --- improvement measures ------------------------------------------------------------------------

/** Add a measure (`project_id`, no `id`) or edit one. The owner may do so even after the head confirmed the project. */
export async function saveAction(_prev: ControlResult, formData: FormData): Promise<ControlResult> {
  const id = field(formData, "id");
  const projectId = field(formData, "project_id");
  if (id ? !isUuid(id) : !isUuid(projectId)) return refuse(RELOAD);
  const parsed = parseActionForm(formData, id ? "update" : "create");
  if (!parsed.ok) return refuse(parsed.message);

  const ctx = await userCtx();
  if (!isCtx(ctx)) return ctx;
  // An edit takes the project from the measure itself; a posted project_id is ignored.
  const project = id ? await findProjectOfAction(ctx.db, id) : await findProject(ctx.db, projectId);
  if (isRefusal(project)) return project;
  const denied = denyEdit(project, ctx, true);
  if (denied) return denied;

  if (!id) {
    const { error } = await ctx.db.from("control_actions").insert({ ...parsed.value, project_id: projectId });
    if (error) return failure(error, "เพิ่มมาตรการไม่สำเร็จ ลองใหม่อีกครั้ง");
    revalidate();
    return { ok: true, message: "เพิ่มมาตรการแล้ว" };
  }
  if (Object.keys(parsed.value).length === 0) return refuse(NOTHING);
  const bad = outcome(await ctx.db.from("control_actions").update(parsed.value).eq("id", id).select("id"), "บันทึกมาตรการไม่สำเร็จ ลองใหม่อีกครั้ง");
  if (bad) return bad;
  revalidate();
  return { ok: true, message: "บันทึกมาตรการแล้ว" };
}

export async function deleteAction(formData: FormData): Promise<ControlResult> {
  const id = field(formData, "id");
  if (!isUuid(id)) return refuse(RELOAD);

  const ctx = await userCtx();
  if (!isCtx(ctx)) return ctx;
  const project = await findProjectOfAction(ctx.db, id);
  if (isRefusal(project)) return project;
  const denied = denyEdit(project, ctx, true);
  if (denied) return denied;
  const bad = outcome(await ctx.db.from("control_actions").delete().eq("id", id).select("id"), "ลบมาตรการไม่สำเร็จ ลองใหม่อีกครั้ง");
  if (bad) return bad;
  revalidate();
  return { ok: true, message: "ลบมาตรการแล้ว" };
}

// --- ปค.4 assessment (officers only) -------------------------------------------------------------

/**
 * Save the whole ปค.4 form of one group and year (the first save creates the row). The form always
 * posts every field, so this replaces `items` as a whole, and it stays on the page.
 */
export async function saveAssessment(_prev: ControlResult, formData: FormData): Promise<ControlResult> {
  const parsed = parseAssessmentForm(formData);
  if (!parsed.ok) return refuse(parsed.message);

  const ctx = await officerCtx();
  if (!isCtx(ctx)) return ctx;
  const { fiscalYear, groupKey, principles, summaries } = parsed.value;
  const bad = outcome(
    await ctx.db
      .from("control_assessments")
      .upsert(
        { fiscal_year: fiscalYear, group_key: groupKey, items: { principles, summaries }, updated_by: ctx.userId },
        { onConflict: "fiscal_year,group_key" },
      )
      .select("id"),
    "บันทึกผลการประเมินไม่สำเร็จ ลองใหม่อีกครั้ง",
  );
  if (bad) return bad;
  revalidate();
  return { ok: true, message: "บันทึกแล้ว" };
}
