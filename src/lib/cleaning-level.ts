/**
 * The grade level of a classroom, from its name: "ม.1/2" → "ม.1" (the part before the slash). A name without a
 * slash is its own level. Cleaning zones are areas of the school, not only buildings, so the officer page groups
 * rooms by level rather than by building.
 */
export function levelOf(name: string) {
  const head = name.split("/")[0].trim();
  return vocationalGrade(head) ?? (head || name.trim());
}

/**
 * ปวช.1-3 sit with the upper secondary tray of the same age: ปวช.1 → ม.4, ปวช.2 → ม.5, ปวช.3 → ม.6.
 * Returns the ม. level, or null when `head` is not a vocational level.
 */
function vocationalGrade(head: string) {
  const m = /^ปวช\.?\s*(\d+)$/.exec(head);
  return m ? `ม.${Number(m[1]) + 3}` : null;
}

/** Is this room a vocational (ปวช.) class? Those are listed after the ม. rooms of their tray. */
export const isVocational = (name: string) => /^ปวช/.test(name.trim());

/**
 * What to compare when sorting room names: a vocational room becomes "ม.4/9000" so it comes after ม.4/11 and
 * before ม.5/1. Other names are unchanged.
 */
export function roomSortKey(name: string) {
  const [head, rest] = name.trim().split("/");
  const level = vocationalGrade(head.trim());
  return level ? `${level}/${9000 + (Number(rest) || 0)}` : name;
}

/** A tray's title: "ม.4", or "ม.4 และ ปวช.1" when a vocational class sits in it. Keyed by level. */
export function levelTitles(names: string[]) {
  const titles: Record<string, string> = {};
  for (const level of levelsOf(names)) {
    const voc = [...new Set(names.filter(isVocational).map((n) => n.split("/")[0].trim()))].filter(
      (h) => vocationalGrade(h) === level,
    );
    titles[level] = voc.length ? `${level} และ ${voc.join(", ")}` : level;
  }
  return titles;
}

/** Levels in school order: ม.2 before ม.10, Thai prefixes together. */
export function compareLevels(a: string, b: string) {
  return a.localeCompare(b, "th", { numeric: true });
}

/** The levels present in `names`, each once, in level order. */
export function levelsOf(names: string[]) {
  return [...new Set(names.map(levelOf))].sort(compareLevels);
}

/** Rows grouped by level in level order; inside a group they keep the order they came in, vocational rooms last. */
export function groupByLevel<T>(rows: T[], nameOf: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const level = levelOf(nameOf(row));
    const list = groups.get(level);
    if (list) list.push(row);
    else groups.set(level, [row]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => compareLevels(a, b))
    .map(([level, list]) => ({
      level,
      rows: [...list.filter((r) => !isVocational(nameOf(r))), ...list.filter((r) => isVocational(nameOf(r)))],
    }));
}
