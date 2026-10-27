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
