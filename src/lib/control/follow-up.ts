// Follow-up of the improvement measures across projects: which are overdue, which are due soon.
// Pure (relative imports with .ts extensions), so `npm test` can load it. Days are counted on plain
// "YYYY-MM-DD" strings (UTC midnight to UTC midnight), never on the clock, so the server's timezone
// cannot shift a due date by a day; the caller passes today's Bangkok day.
import { isYmd } from "../time.ts";
import type { ActionStatus, GroupKey } from "./forms.ts";
import type { ControlProject } from "./types.ts";

/** A measure is "soon" when it is due within this many days, today included. */
export const SOON_DAYS = 14;

export type Bucket = "overdue" | "soon" | "later" | "nodate" | "done";

export type FollowUpItem = {
  actionId: string;
  projectId: string;
  projectName: string;
  groupKey: GroupKey;
  ownerId: string;
  ownerName: string;
  description: string;
  responsible: string;
  due: string | null;
  status: ActionStatus;
  bucket: Bucket;
  /** Days from today to the due date, negative = days overdue; null for done, no date or a garbled date. */
  days: number | null;
};

/** The order the page lists them in. */
export const BUCKET_ORDER: readonly Bucket[] = ["overdue", "soon", "later", "nodate", "done"];

const dayNumber = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`) / 86_400_000;

function place(due: string | null, status: ActionStatus, today: string): { bucket: Bucket; days: number | null } {
  if (status === "done") return { bucket: "done", days: null };
  if (!isYmd(due) || !isYmd(today)) return { bucket: "nodate", days: null };
  const days = dayNumber(due) - dayNumber(today);
  return { bucket: days < 0 ? "overdue" : days <= SOON_DAYS ? "soon" : "later", days };
}

/**
 * Every measure of the given projects as one flat list: overdue (most overdue first), soon (nearest
 * first), later, no date, done; ties keep the order given. A missing, garbled or impossible due date
 * ("2026-02-31") is "nodate" and never throws; done wins over any date.
 */
export function followUp(projects: ControlProject[], today: string): FollowUpItem[] {
  const items = projects.flatMap((p) =>
    p.actions.map((a): FollowUpItem => ({
      actionId: a.id,
      projectId: p.id,
      projectName: p.name,
      groupKey: p.groupKey,
      ownerId: p.ownerId,
      ownerName: p.ownerName,
      description: a.description,
      responsible: a.responsible,
      due: a.due,
      status: a.status,
      ...place(a.due, a.status, today),
    })),
  );
  // Array.sort is stable, so equal keys keep the order given.
  return items.sort((x, y) => BUCKET_ORDER.indexOf(x.bucket) - BUCKET_ORDER.indexOf(y.bucket) || (x.days ?? 0) - (y.days ?? 0));
}

export type FollowUpCounts = { overdue: number; soon: number; alert: number };

/** What the home page and the page header say: overdue + soon is the number of alerts. */
export function followUpCounts(items: FollowUpItem[]): FollowUpCounts {
  const overdue = items.filter((i) => i.bucket === "overdue").length;
  const soon = items.filter((i) => i.bucket === "soon").length;
  return { overdue, soon, alert: overdue + soon };
}

/** "เกินกำหนด 3 วัน", "ครบกำหนดวันนี้", "อีก 5 วัน", "ยังไม่กำหนดวัน"; a done measure is "เสร็จแล้ว". */
export function dueText(item: Pick<FollowUpItem, "bucket" | "days">): string {
  if (item.bucket === "done") return "เสร็จแล้ว";
  if (item.days === null) return "ยังไม่กำหนดวัน";
  if (item.days < 0) return `เกินกำหนด ${-item.days} วัน`;
  return item.days === 0 ? "ครบกำหนดวันนี้" : `อีก ${item.days} วัน`;
}

/** ?bucket= when it is one of the five buckets or "all"; anything else is undefined (= the page's default view). */
export function resolveBucket(v: string | string[] | undefined): Bucket | "all" | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "all" ? s : BUCKET_ORDER.find((b) => b === s);
}
