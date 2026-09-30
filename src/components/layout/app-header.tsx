import Image from "next/image";
import Link from "next/link";

import { UserMenu } from "@/components/dashboard/user-menu";
import { SiteNav, type NavItem } from "@/components/layout/site-nav";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { Viewer } from "@/lib/data/dashboard";

/** The navigation bar shared by every page. Memos are for staff, so regular users do not see that tab. */
export function AppHeader({ viewer }: { viewer: Viewer | null }) {
  const items: NavItem[] = [
    { href: "/", label: "แดชบอร์ด" },
    { href: "/tickets", label: "รายการแจ้งซ่อม" },
    { href: "/meeting-rooms", label: "ขอใช้ห้องประชุม" },
    ...(!viewer || viewer.role !== "user" ? [{ href: "/memos", label: "บันทึกข้อความ" }] : []),
  ];

  return (
    <header className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-3">
      <Link href="/" className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <Image src="/logo.png" alt="ตราโรงเรียนละหานทรายรัชดาภิเษก" width={640} height={1016} className="h-10 w-auto" priority />
        <span className="font-display text-lg font-semibold leading-tight">ระบบแจ้งซ่อม</span>
      </Link>
      <div className="order-3 w-full min-w-0 md:order-none md:w-auto md:flex-1">
        <SiteNav items={items} />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <UserMenu viewer={viewer} />
        <ThemeToggle />
      </div>
    </header>
  );
}
