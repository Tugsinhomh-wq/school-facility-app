import { visibleModules } from "./modules.ts";
import type { UserRole } from "../types/database.ts";

/** One menu entry. `id` picks the icon; a null `href` is a module not built yet (shown disabled). */
export type NavEntry = { id: string; label: string; href: string | null; soon?: boolean };
export type NavGroup = { heading: string | null; items: NavEntry[] };

const HOME: NavEntry = { id: "home", label: "หน้าแรก", href: "/" };
const SUMMARY: NavEntry = { id: "summary", label: "สรุปภาพรวม", href: "/summary" };

/**
 * The menu for a role, shared by the desktop sidebar and the phone bar. Executives get only the
 * summary; "จัดการ" holds the staff and administrator pages (memos for every role but teachers).
 */
export function navGroups(role: UserRole | null): NavGroup[] {
  if (role === "executive") return [{ heading: null, items: [SUMMARY] }];
  const byGroup = (g: "facility" | "other") =>
    visibleModules(role)
      .filter((m) => m.group === g)
      .map(({ id, label, href, soon }) => ({ id, label, href, soon }));
  const manage: NavEntry[] = [
    ...(role !== null && role !== "user" ? [{ id: "memos", label: "บันทึกข้อความ", href: "/memos" }] : []),
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
