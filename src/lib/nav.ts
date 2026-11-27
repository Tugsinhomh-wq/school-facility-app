import { isExecutive } from "./exec-roles.ts";
import { visibleModules } from "./modules.ts";
import type { UserRole } from "../types/database.ts";

/** One menu entry. `id` picks the icon; a null `href` is a module not built yet (shown disabled). */
export type NavEntry = { id: string; label: string; href: string | null; soon?: boolean; badge?: number };
export type NavGroup = { heading: string | null; items: NavEntry[] };

const HOME: NavEntry = { id: "home", label: "หน้าแรก", href: "/" };
const SUMMARY: NavEntry = { id: "summary", label: "สรุปภาพรวม", href: "/summary" };
const VEHICLES: NavEntry = { id: "vehicles", label: "จองรถ", href: "/vehicles" };
const BACKLOG: NavEntry = { id: "backlog", label: "งานที่ขอความเห็น", href: "/backlog" };

/**
 * The menu for a role, shared by the desktop sidebar and the phone bar. Executives get only the
 * summary (the director also gets the vehicle page to approve trips; the budget deputy also gets the tickets sent for their opinion, with a count of unread comments); "จัดการ" holds the staff and administrator pages (memos for every role but teachers).
 */
export function navGroups(role: UserRole | null, badges: { backlog?: number } = {}): NavGroup[] {
  if (role === "budget_deputy")
    return [{ heading: null, items: [SUMMARY, badges.backlog ? { ...BACKLOG, badge: badges.backlog } : BACKLOG] }];
  // The director decides on vehicle requests, so that one executive role also gets the vehicle page.
  if (isExecutive(role)) return [{ heading: null, items: role === "executive" ? [SUMMARY, VEHICLES] : [SUMMARY] }];
  const byGroup = (g: "facility" | "other") =>
    visibleModules(role)
      .filter((m) => m.group === g)
      .map(({ id, label, href, soon }) => ({ id, label, href, soon }));
  const manage: NavEntry[] = [
    // The cleaning-zone officer has no memo access (no row policy), so no menu entry either.
    ...(role !== null && role !== "user" && role !== "cleaning_staff" ? [{ id: "memos", label: "บันทึกข้อความ", href: "/memos" }] : []),
    ...(role === "super_admin"
      ? [
          SUMMARY,
          { id: "feedback", label: "ความคิดเห็น", href: "/feedback" },
          { id: "users", label: "ผู้ใช้", href: "/users" },
          { id: "trash", label: "ถังขยะ", href: "/trash" },
        ]
      : []),
  ];
  return [
    { heading: null, items: [HOME] },
    { heading: "งานอาคารสถานที่", items: byGroup("facility") },
    { heading: "งานอื่น", items: byGroup("other") },
    { heading: "จัดการ", items: manage },
  ].filter((g) => g.items.length > 0);
}
