// Reading the search params of the /control pages. Pure (relative imports with .ts extensions), so
// `npm test` can load it. A bad ?fy= or ?group= must never reach the data layer, where it would
// show up as a load error with a retry button that cannot help: it falls back to the default instead.
import { GROUPS, type GroupKey } from "./forms.ts";
import { parseFiscalYear } from "./parse.ts";

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
