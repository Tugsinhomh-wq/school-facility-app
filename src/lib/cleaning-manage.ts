export const MANAGE_TABS = [
  { key: "rooms", label: "ห้องเรียน" },
  { key: "add", label: "เพิ่มและนำเข้า" },
  { key: "rollover", label: "ภาคเรียนใหม่" },
  { key: "dates", label: "ช่วงเวลา" },
] as const;

export type ManageTab = (typeof MANAGE_TABS)[number]["key"];

/** ?tab= of the setup page; anything unknown means the room list. */
export const parseManageTab = (v: string | string[] | undefined): ManageTab =>
  MANAGE_TABS.find((t) => t.key === v)?.key ?? "rooms";

/** ?level= of the room list ("ม.1" ...); "" = every room. Only levels that exist are accepted. */
export const parseLevel = (v: string | string[] | undefined, levels: string[]) =>
  typeof v === "string" && levels.includes(v) ? v : "";

type RoomLike = { name: string; zone: string; isActive: boolean; advisorEmails: string[] };

/** The summary strip: active rooms, and how many of them still lack a zone or an advisor. */
export function roomGaps(rooms: RoomLike[]) {
  const active = rooms.filter((r) => r.isActive);
  return {
    total: active.length,
    noZone: active.filter((r) => !r.zone.trim()).length,
    noAdvisor: active.filter((r) => r.advisorEmails.length === 0).length,
  };
}

export type GapFilter = "" | "zone" | "advisor";

/** ?missing= of the room list. */
export const parseGap = (v: string | string[] | undefined): GapFilter => (v === "zone" || v === "advisor" ? v : "");

/** Search by room name (spaces ignored) and the "still missing" filter. */
export function filterRooms<R extends RoomLike>(rooms: R[], q: string, gap: GapFilter): R[] {
  const needle = q.replace(/\s/g, "");
  return rooms.filter(
    (r) =>
      (!needle || r.name.replace(/\s/g, "").includes(needle)) &&
      (gap === "" || (gap === "zone" ? !r.zone.trim() : r.advisorEmails.length === 0)),
  );
}
