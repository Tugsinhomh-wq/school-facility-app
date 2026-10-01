import Image from "next/image";
import { UserRound } from "lucide-react";
import Link from "next/link";

import { UserMenu } from "@/components/dashboard/user-menu";
import { SiteNav, type NavItem } from "@/components/layout/site-nav";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { Viewer } from "@/lib/data/dashboard";

/** The navigation bar shared by every page. Memos are for staff, the summary for executives and the administrator. */
export function AppHeader({ viewer }: { viewer: Viewer | null }) {
  const summary: NavItem = { href: "/summary", label: "สรุปภาพรวม" };
  const items: NavItem[] =
    viewer?.role === "executive"
      ? [summary, { href: "/account", label: "บัญชีของฉัน" }] // executives: the summary page and their own account
      : [
          { href: "/", label: "แดชบอร์ด" },
          { href: "/tickets", label: "รายการแจ้งซ่อม" },
          { href: "/meeting-rooms", label: "ขอใช้ห้องประชุม" },
          ...(!viewer || viewer.role !== "user"
            ? [{ href: "/memos", label: "บันทึกข้อความ" }]
            : []),
          ...(viewer?.role === "super_admin"
            ? [summary, { href: "/feedback", label: "ความคิดเห็น" }]
            : []),
        ];

  return (
    <header className="mb-6 flex flex-wrap md:mb-8 items-center gap-x-6 gap-y-3">
      <Link
        href="/"
        className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Image
          src="/logo.png"
          alt="ตราโรงเรียนละหานทรายรัชดาภิเษก"
          width={640}
          height={1016}
          className="h-9 w-auto md:h-10"
          priority
        />
        <span className="font-display text-lg font-semibold leading-tight">
          ระบบแจ้งซ่อม
        </span>
      </Link>
      <div className="hidden min-w-0 md:block md:flex-1">
        <SiteNav items={items} />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden md:block">
          <UserMenu viewer={viewer} />
        </div>
        {viewer && (
          <Link
            href="/account"
            aria-label="บัญชีของฉัน"
            className="flex size-9 items-center justify-center rounded-lg border border-border md:hidden"
          >
            <UserRound className="size-4" aria-hidden />
          </Link>
        )}
        {!viewer && (
          <Link
            href="/login"
            className="rounded-lg border border-border px-3 py-1.5 text-sm md:hidden"
          >
            เข้าสู่ระบบ
          </Link>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
