/**
 * The grade level of a classroom, from its name: "ม.1/2" → "ม.1" (the part before the slash). A name without a
 * slash is its own level. Cleaning zones are areas of the school, not only buildings, so the officer page groups
 * rooms by level rather than by building.
 */
export function levelOf(name: string) {
  const head = name.split("/")[0].trim();
  return head || name.trim();
}

/** Levels in school order: ม.2 before ม.10, Thai prefixes together. */
export function compareLevels(a: string, b: string) {
  return a.localeCompare(b, "th", { numeric: true });
}

/** The levels present in `names`, each once, in level order. */
export function levelsOf(names: string[]) {
  return [...new Set(names.map(levelOf))].sort(compareLevels);
}

/** Rows grouped by level in level order; inside a group they keep the order they came in. */
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
    .map(([level, list]) => ({ level, rows: list }));
}
