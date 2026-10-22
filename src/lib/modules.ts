import type { UserRole } from "../types/database.ts";

/** One work module of the general-administration group. The sidebar, phone bar and home page all list these. */
export type AppModule = {
  id: string;
  label: string;
  /** Null for modules that are not built yet. */
  href: string | null;
  soon?: boolean;
  roles: UserRole[] | "all";
  /** Menu section: the facility work the group runs today, or the other work still to come. */
  group: "facility" | "other";
};

export const MODULES: AppModule[] = [
  {
    id: "repair",
    label: "แจ้งซ่อม",
    href: "/tickets",
    roles: "all",
    group: "facility",
  },
  {
    id: "rooms",
    label: "จองห้องประชุม",
    href: "/meeting-rooms",
    roles: "all",
    group: "facility",
  },
  {
    id: "cleaning",
    label: "เขตทำความสะอาด",
    href: "/cleaning",
    roles: "all",
    group: "facility",
  },
  {
    id: "census",
    label: "สำมะโนผู้เรียน",
    href: "/census",
    // The roster holds students' names: same visibility as control. Signed-out visitors and executives never see it.
    roles: ["user", "staff", "head", "room_staff", "super_admin"],
    group: "other",
  },
  {
    id: "control",
    label: "ควบคุมภายใน",
    href: "/control",
    // Signed-out visitors and executives do not get it: /control is for signed-in staff and teachers.
    roles: ["user", "staff", "head", "room_staff", "super_admin"],
    group: "other",
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
