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
