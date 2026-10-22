// Reading the search params of the /control pages. Pure (relative imports with .ts extensions), so
// `npm test` can load it. A bad ?fy= or ?group= must never reach the data layer, where it would
// show up as a load error with a retry button that cannot help: it falls back to the default instead
// (parseExportQuery, for the documents, refuses instead: a signed report must not quietly change year).
import { GROUPS, type GroupKey } from "./forms.ts";
import { parseFiscalYear, type Parsed } from "./parse.ts";

/** What a page's `searchParams` holds. */
export type Query = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** ?fy= as a whole พ.ศ. year in the supported range; anything else (missing, "abc", 99999) is `fallback`. */
export function resolveYear(v: string | string[] | undefined, fallback: number): number {
  const s = first(v);
  if (s === undefined) return fallback;
  const r = parseFiscalYear(s);
  return r.ok ? r.value : fallback;
}

/** ?group= when it is one of the six groups, else undefined (= every group). */
export function resolveGroup(v: string | string[] | undefined): GroupKey | undefined {
  const s = first(v);
  return GROUPS.find((g) => g.key === s)?.key;
}

/** `path` with ?fy= and ?group=; the current fiscal year and "every group" are left out so the URL stays short. */
export function controlHref(path: string, f: { fy: number; group?: GroupKey }, currentFy: number): string {
  const q = new URLSearchParams();
  if (f.fy !== currentFy) q.set("fy", String(f.fy));
  if (f.group) q.set("group", f.group);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/** Link to a document of one group. The year is always spelled out, so a saved link keeps opening the same year's document. */
export function docHref(path: string, fy: number, group: GroupKey, doc?: "pk5" | "csa"): string {
  const q = new URLSearchParams();
  if (doc) q.set("doc", doc);
  q.set("fy", String(fy));
  q.set("group", group);
  return `${path}?${q}`;
}

/**
 * The year and the one group of a document to export (?fy= and ?group=). Unlike resolveYear, a bad
 * ?fy= is refused rather than replaced: a signed report must never quietly show another year. A
 * missing ?fy= is the current year; ?group= is required, there is no "every group" document.
 */
export function parseExportQuery(q: Query, currentFy: number): Parsed<{ fy: number; group: GroupKey }> {
  const year = first(q.fy);
  const fy = year === undefined ? { ok: true as const, value: currentFy } : parseFiscalYear(year);
  if (!fy.ok) return fy;
  const group = resolveGroup(q.group);
  if (!group) return { ok: false, message: first(q.group)?.trim() ? "ไม่พบกลุ่มงานที่เลือก" : "เลือกกลุ่มงานก่อน" };
  return { ok: true, value: { fy: fy.value, group } };
}
