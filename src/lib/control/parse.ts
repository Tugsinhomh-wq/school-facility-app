// Reading and checking the form fields of the internal-control actions. Pure (relative imports only),
// so `npm test` can load it; src/app/(dashboard)/control/actions.ts does the session, the permission
// checks and the writes. Messages are Thai because they go straight to the page.
//
// Every parseXxxForm returns a patch with only the keys that were in the form: a key that is missing
// is left unchanged on update and left to the column default on create, while a key that is present
// but empty is stored as empty (or NULL for a number, a date or a choice). Keys that only an officer
// may change (owner, mission, the head's scores, confirmation) are never read by parseProjectForm.
import { ACTION_STATUSES, ASSESS_RESULTS, COMPONENT_COUNT, GROUPS, PRINCIPLE_COUNT, RISK_TYPES, type ActionStatus, type AssessResult, type GroupKey } from "./forms.ts";
import { fiscalYear, riskScore } from "./risk.ts";
import { isYmd } from "../time.ts";

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };
/** FormData, or anything with its get(). */
export type Fields = { get(name: string): unknown };
export type Mode = "create" | "update";

export const MAX_TEXT = 2000;
export const MAX_NAME = 200;
export const FISCAL_YEAR_MIN = 2500;
export const FISCAL_YEAR_MAX = 2700;
const MAX_BUDGET = 1e12;

const pass = <T>(value: T): Parsed<T> => ({ ok: true, value });
const fail = (message: string): Parsed<never> => ({ ok: false, message });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

/** Text as it is stored: line breaks as LF, no NUL (Postgres refuses it), no space around it. */
export function cleanText(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replaceAll("\0", "").replace(/\r\n?/g, "\n").trim();
}

export function parseText(raw: string, label: string, max: number, required: boolean): Parsed<string> {
  const v = cleanText(raw);
  if (required && v === "") return fail(`ระบุ${label}`);
  if (v.length > max) return fail(`${label}ยาวเกิน ${max} ตัวอักษร`);
  return pass(v);
}

/** A whole Buddhist-era year in a sane range: fiscalYear() answers NaN to a malformed day. */
export function parseFiscalYear(raw: string): Parsed<number> {
  const s = raw.trim();
  const n = /^\d+$/.test(s) ? Number(s) : NaN;
  if (!Number.isInteger(n) || n < FISCAL_YEAR_MIN || n > FISCAL_YEAR_MAX)
    return fail(`ปีงบประมาณต้องเป็นปี พ.ศ. ${FISCAL_YEAR_MIN}–${FISCAL_YEAR_MAX}`);
  return pass(n);
}

export function parseGroupKey(raw: string): Parsed<GroupKey> {
  const g = GROUPS.find((x) => x.key === raw.trim());
  return g ? pass(g.key) : fail("เลือกกลุ่มงานใหม่อีกครั้ง");
}

export function parseRiskType(raw: string): Parsed<"F" | "C" | "O" | null> {
  const s = raw.trim();
  if (s === "") return pass(null);
  const t = RISK_TYPES.find((x) => x.key === s);
  return t ? pass(t.key) : fail("เลือกประเภทความเสี่ยงใหม่อีกครั้ง");
}

/** Empty = no budget; otherwise a non-negative amount with at most two decimals ("1,200,000.50" is fine). */
export function parseBudget(raw: string): Parsed<number | null> {
  const s = raw.trim();
  if (s === "") return pass(null);
  const n = /^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(s) ? Number(s.replaceAll(",", "")) : NaN;
  if (!Number.isFinite(n) || n > MAX_BUDGET) return fail("งบประมาณต้องเป็นตัวเลขไม่ติดลบ ทศนิยมไม่เกิน 2 ตำแหน่ง");
  return pass(n);
}

/** Empty = none; otherwise a whole number 1-5. */
export function parseLevel(raw: string, label: string): Parsed<number | null> {
  const s = raw.trim();
  if (s === "") return pass(null);
  return /^[1-5]$/.test(s) ? pass(Number(s)) : fail(`${label}ต้องเป็นเลข 1–5`);
}

export function parseStatus(raw: string): Parsed<ActionStatus> {
  const s = ACTION_STATUSES.find((x) => x.key === raw.trim());
  return s ? pass(s.key) : fail("เลือกสถานะใหม่อีกครั้ง");
}

/** Empty = none; otherwise a real calendar day (Gregorian "YYYY-MM-DD") in the same sane range as the fiscal year. */
export function parseDue(raw: string): Parsed<string | null> {
  const s = raw.trim();
  if (s === "") return pass(null);
  const fy = isYmd(s) ? fiscalYear(s) : NaN;
  return fy >= FISCAL_YEAR_MIN && fy <= FISCAL_YEAR_MAX ? pass(s) : fail("วันที่กำหนดเสร็จไม่ถูกต้อง (รูปแบบ ปปปป-ดด-วว)");
}

/** Empty = none; otherwise a lower-cased address (accounts store emails lower-cased). */
export function parseOwnerEmail(raw: string): Parsed<string | null> {
  const s = cleanText(raw).toLowerCase();
  if (s === "") return pass(null);
  return s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? pass(s) : fail("รูปแบบอีเมลเจ้าของโครงการไม่ถูกต้อง");
}

// --- forms ---------------------------------------------------------------------------------------

/** The value of a form key, or undefined when the form has no such key (a File counts as no key). */
function pick(f: Fields, key: string, need: boolean): string | undefined {
  const v = f.get(key);
  if (typeof v === "string") return v;
  return need ? "" : undefined;
}

function collector() {
  const errors: string[] = [];
  const patch: Record<string, unknown> = {};
  return {
    take<T>(key: string, raw: string | undefined, parse: (s: string) => Parsed<T>) {
      if (raw === undefined) return;
      const r = parse(raw);
      if (r.ok) patch[key] = r.value;
      else errors.push(r.message);
    },
    set(key: string, value: unknown) {
      patch[key] = value;
    },
    error(message: string) {
      errors.push(message);
    },
    done<P>(): Parsed<P> {
      return errors.length > 0 ? fail(errors.join(" · ")) : pass(patch as P);
    },
  };
}

const text = (label: string, max = MAX_TEXT, required = false) => (s: string) => parseText(s, label, max, required);

export type ProjectPatch = Partial<{
  fiscal_year: number;
  group_key: GroupKey;
  name: string;
  budget: number | null;
  objective: string;
  risk_issue: string;
  risk_cause: string;
  risk_impact: string;
  risk_type: "F" | "C" | "O" | null;
  existing_controls: string;
  assessment: string;
  residual_risk: string;
}>;

const PROJECT_TEXT: readonly [keyof ProjectPatch, string][] = [
  ["objective", "วัตถุประสงค์"],
  ["risk_issue", "ประเด็นความเสี่ยง"],
  ["risk_cause", "สาเหตุของความเสี่ยง"],
  ["risk_impact", "ผลกระทบของความเสี่ยง"],
  ["existing_controls", "การควบคุมภายในที่มีอยู่"],
  ["assessment", "การประเมินผลการควบคุมภายใน"],
  ["residual_risk", "ความเสี่ยงที่ยังมีอยู่"],
];

/** Year, group and name are required to create. Owner, mission, scores and confirmation are never read here. */
export function parseProjectForm(f: Fields, mode: Mode): Parsed<ProjectPatch> {
  const c = collector();
  const create = mode === "create";
  c.take("fiscal_year", pick(f, "fiscal_year", create), parseFiscalYear);
  c.take("group_key", pick(f, "group_key", create), parseGroupKey);
  c.take("name", pick(f, "name", create), text("ชื่อโครงการ", MAX_NAME, true));
  c.take("budget", pick(f, "budget", false), parseBudget);
  c.take("risk_type", pick(f, "risk_type", false), parseRiskType);
  for (const [key, label] of PROJECT_TEXT) c.take(key, pick(f, key, false), text(label));
  return c.done();
}

/** The owner's own scores: both must be whole numbers 1-5. */
export function parseScoreForm(f: Fields): Parsed<{ likelihood: number; impact: number }> {
  const l = parseLevel(pick(f, "likelihood", true) ?? "", "โอกาสเกิด");
  const i = parseLevel(pick(f, "impact", true) ?? "", "ผลกระทบ");
  const likelihood = l.ok ? l.value : null;
  const impact = i.ok ? i.value : null;
  if (likelihood === null || impact === null || riskScore(likelihood, impact) === null)
    return fail("ต้องเลือกโอกาสเกิดและผลกระทบเป็นเลข 1–5 ให้ครบทั้งสองช่อง");
  return pass({ likelihood, impact });
}

export type ReviewPatch = {
  head_likelihood?: number | null;
  head_impact?: number | null;
  mission_id?: string | null;
  /** true = confirm, false = withdraw the confirmation. */
  confirm?: boolean;
};

/**
 * The head's side: an empty head score clears that axis (the owner's value is used again), a missing
 * one leaves it alone; the same for the mission; confirm is "1", "0" or empty / missing for no change.
 */
export function parseReviewForm(f: Fields): Parsed<ReviewPatch> {
  const c = collector();
  c.take("head_likelihood", pick(f, "head_likelihood", false), (s) => parseLevel(s, "โอกาสเกิดของหัวหน้า"));
  c.take("head_impact", pick(f, "head_impact", false), (s) => parseLevel(s, "ผลกระทบของหัวหน้า"));
  c.take("mission_id", pick(f, "mission_id", false), (s) => {
    const v = s.trim();
    return v === "" ? pass(null) : isUuid(v) ? pass(v) : fail("เลือกภารกิจใหม่อีกครั้ง");
  });
  const confirm = pick(f, "confirm", false)?.trim();
  if (confirm === "1") c.set("confirm", true);
  else if (confirm === "0") c.set("confirm", false);
  else if (confirm) c.error("ค่าการยืนยันไม่ถูกต้อง ลองโหลดหน้าใหม่");
  return c.done();
}

export type MissionPatch = Partial<{
  fiscal_year: number;
  group_key: GroupKey;
  name: string;
  objective: string;
  procedures: string;
  practice: string;
  assessment: string;
  improvement: string;
}>;

const MISSION_TEXT: readonly [keyof MissionPatch, string][] = [
  ["objective", "วัตถุประสงค์"],
  ["procedures", "ขั้นตอนการปฏิบัติงาน"],
  ["practice", "การปฏิบัติจริงในปัจจุบัน"],
  ["assessment", "ผลการประเมิน"],
  ["improvement", "สาเหตุและแนวทางแก้ไข"],
];

export function parseMissionForm(f: Fields, mode: Mode): Parsed<MissionPatch> {
  const c = collector();
  const create = mode === "create";
  c.take("fiscal_year", pick(f, "fiscal_year", create), parseFiscalYear);
  c.take("group_key", pick(f, "group_key", create), parseGroupKey);
  c.take("name", pick(f, "name", create), text("ชื่อภารกิจ", MAX_NAME, true));
  for (const [key, label] of MISSION_TEXT) c.take(key, pick(f, key, false), text(label));
  return c.done();
}

export type ActionPatch = Partial<{
  description: string;
  responsible: string;
  due: string | null;
  status: ActionStatus;
}>;

export function parseActionForm(f: Fields, mode: Mode): Parsed<ActionPatch> {
  const c = collector();
  c.take("description", pick(f, "description", mode === "create"), text("รายละเอียดมาตรการ", MAX_TEXT, true));
  c.take("responsible", pick(f, "responsible", false), text("ผู้รับผิดชอบ", MAX_NAME));
  c.take("due", pick(f, "due", false), parseDue);
  c.take("status", pick(f, "status", false), parseStatus);
  return c.done();
}

export type AssessmentValue = {
  fiscalYear: number;
  groupKey: GroupKey;
  /** Keys "1".."17" and "1".."5", all present: this is what is stored as `items`. */
  principles: Record<string, { result: AssessResult | null; text: string }>;
  summaries: Record<string, string>;
};

/**
 * The whole ปค.4 form of one group: fields principle_{n}_result (empty = not answered), principle_{n}_text
 * and summary_{n}. Unlike the other forms this is not a patch: every key is stored, so a field missing
 * from the form is an empty answer. Fields outside 1-17 / 1-5 are never read.
 */
export function parseAssessmentForm(f: Fields): Parsed<AssessmentValue> {
  const errors: string[] = [];
  const fy = parseFiscalYear(pick(f, "fiscal_year", true) ?? "");
  const group = parseGroupKey(pick(f, "group_key", true) ?? "");
  if (!fy.ok) errors.push(fy.message);
  if (!group.ok) errors.push(group.message);
  const principles: AssessmentValue["principles"] = {};
  for (let n = 1; n <= PRINCIPLE_COUNT; n++) {
    const raw = (pick(f, `principle_${n}_result`, true) ?? "").trim();
    const result = ASSESS_RESULTS.find((x) => x.key === raw)?.key ?? null;
    if (raw !== "" && result === null) errors.push(`ผลการประเมินข้อ ${n} ไม่ถูกต้อง เลือกใหม่อีกครั้ง`);
    const t = parseText(pick(f, `principle_${n}_text`, true) ?? "", `ความเห็นข้อ ${n}`, MAX_TEXT, false);
    if (!t.ok) errors.push(t.message);
    principles[n] = { result, text: t.ok ? t.value : "" };
  }
  const summaries: AssessmentValue["summaries"] = {};
  for (let n = 1; n <= COMPONENT_COUNT; n++) {
    const t = parseText(pick(f, `summary_${n}`, true) ?? "", `สรุปองค์ประกอบที่ ${n}`, MAX_TEXT, false);
    if (!t.ok) errors.push(t.message);
    summaries[n] = t.ok ? t.value : "";
  }
  if (errors.length > 0 || !fy.ok || !group.ok) return fail(errors.join(" · "));
  return pass({ fiscalYear: fy.value, groupKey: group.value, principles, summaries });
}
