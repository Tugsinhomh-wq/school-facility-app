/** Code prefix of the catch-all "อื่นๆ (นอกอาคาร)" building (see supabase/building_other.sql). */
export const OTHER_PREFIX = "OTHER-";

export const isOtherBuilding = (code: string | null | undefined) =>
  Boolean(code?.startsWith(OTHER_PREFIX));

/** The catch-all building goes last in a picker; the rest keep their order. */
export function otherLast<T extends { code?: string | null }>(list: T[]): T[] {
  return [
    ...list.filter((b) => !isOtherBuilding(b.code)),
    ...list.filter((b) => isOtherBuilding(b.code)),
  ];
}

/** A report in the catch-all building must say where, since the building cannot. */
export const needsPlace = (code: string | null | undefined, place: string) =>
  isOtherBuilding(code) && !place.trim();
