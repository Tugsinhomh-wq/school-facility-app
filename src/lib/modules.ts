import type { UserRole } from "../types/database.ts";

/** One work module of the general-administration group. The header, bottom bar and home page all list these. */
export type AppModule = {
  id: string;
  label: string;
  /** Shorter label for the phone bottom bar. */
  short?: string;
  /** One line for the home menu. */
  hint: string;
  /** Null for modules that are not built yet. */
  href: string | null;
  soon?: boolean;
  roles: UserRole[] | "all";
};

export const MODULES: AppModule[] = [
  {
    id: "repair",
    label: "แจ้งซ่อม",
    short: "งานซ่อม",
    hint: "แจ้งและติดตามงานซ่อมอาคารสถานที่",
    href: "/tickets",
    roles: "all",
  },
  {
    id: "rooms",
    label: "จองห้องประชุม",
    short: "ห้องประชุม",
    hint: "ขอใช้ห้องและดูตารางการใช้งาน",
    href: "/meeting-rooms",
    roles: "all",
  },
  {
    id: "cleaning",
    label: "เขตทำความสะอาด",
    short: "เขตสะอาด",
    hint: "ยืนยันการดูแลเขตรับผิดชอบรายวัน",
    href: "/cleaning",
    roles: "all",
  },
  {
    id: "census",
    label: "สำมะโนผู้เรียน",
    hint: "ข้อมูลจำนวนผู้เรียนรายห้อง",
    href: null,
    soon: true,
    roles: "all",
  },
  {
    id: "control",
    label: "ควบคุมภายใน",
    hint: "รายงานการควบคุมภายในของกลุ่มงาน",
    href: null,
    soon: true,
    roles: "all",
  },
];

/**
 * The modules a role may open. Signed-out visitors (null) see the open ones; executives see none,
 * because they only use the summary page and their account.
 */
export function visibleModules(role: UserRole | null): AppModule[] {
  if (role === "executive") return [];
  return MODULES.filter((m) => m.roles === "all" || (role !== null && m.roles.includes(role)));
}
