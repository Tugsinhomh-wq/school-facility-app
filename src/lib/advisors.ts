import { compareRoomNames } from "./cleaning.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 200;

export type LevelGroup<R> = { level: string; rooms: R[] };

/** "ม.3/2" to "ม.3"; anything not shaped like a Mattayom room goes under "อื่น ๆ". */
export const levelOf = (name: string) => /^ม\.\s*([1-6])(?!\d)/.exec(name.trim())?.[0].replace(/\s/g, "") ?? "อื่น ๆ";

/** Rooms grouped by level, ม.1 to ม.6 then the rest, each group in room order ("ม.3/2" before "ม.3/10"). */
export function groupRoomsByLevel<R extends { name: string }>(rooms: R[]): LevelGroup<R>[] {
  const groups = new Map<string, R[]>();
  for (const room of [...rooms].sort((a, b) => compareRoomNames(a.name, b.name))) {
    const level = levelOf(room.name);
    groups.set(level, [...(groups.get(level) ?? []), room]);
  }
  return [...groups]
    .map(([level, list]) => ({ level, rooms: list }))
    .sort((a, b) => (a.level === "อื่น ๆ" ? 1 : b.level === "อื่น ๆ" ? -1 : compareRoomNames(a.level, b.level)));
}

/** Lower-cased, de-duplicated ids, or null if any value is not a UUID or there are too many. */
export function parseUuidList(values: unknown[]): string[] | null {
  if (values.length > MAX_IDS) return null;
  const ids = new Set<string>();
  for (const v of values) {
    if (typeof v !== "string" || !UUID.test(v)) return null;
    ids.add(v.toLowerCase());
  }
  return [...ids];
}

/**
 * What saving a ticked set changes. Only rooms of `termRoomIds` (the term being edited) count:
 * ticked ids outside it are ignored, and `currentIds` outside it (other terms) are never removed.
 */
export function advisorDiff(ticked: string[], current: string[], termRoomIds: string[]) {
  const inTerm = new Set(termRoomIds.map((id) => id.toLowerCase()));
  const want = new Set(ticked.map((id) => id.toLowerCase()).filter((id) => inTerm.has(id)));
  const have = new Set(current.map((id) => id.toLowerCase()).filter((id) => inTerm.has(id)));
  return {
    add: [...want].filter((id) => !have.has(id)),
    remove: [...have].filter((id) => !want.has(id)),
  };
}

/** True when both lists hold the same ids, ignoring order, case and duplicates. */
export function sameIdSet(a: string[], b: string[]) {
  const x = new Set(a.map((id) => id.toLowerCase()));
  const y = new Set(b.map((id) => id.toLowerCase()));
  return x.size === y.size && [...x].every((id) => y.has(id));
}

/**
 * What saving the advisor form changes, judged against the rooms the admin was actually shown.
 * Refuses (writes nothing) when `shown` is not exactly the current latest-term room set (a room was
 * added, removed or reactivated, or the term changed since the page loaded) or a ticked id was not
 * shown. Otherwise the diff covers only the shown rooms, so other rooms are never touched.
 */
export function planAdvisorSave(shown: string[], ticked: string[], current: string[], latestIds: string[]) {
  if (shown.length === 0 || !sameIdSet(shown, latestIds)) return { error: "stale" as const };
  const seen = new Set(shown.map((id) => id.toLowerCase()));
  if (ticked.some((id) => !seen.has(id.toLowerCase()))) return { error: "unshown" as const };
  return advisorDiff(ticked, current, shown);
}
