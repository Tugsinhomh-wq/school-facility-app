"use client";

import {
  ChartColumn,
  ClipboardList,
  DoorOpen,
  FileText,
  Home,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Bottom tab bar for phones. Staff get Memos in place of nothing else changing, so the four slots stay put; executives get two tabs, the administrator a fifth for the summary. */
export function MobileNav({
  showMemos,
  executive = false,
  showSummary = false,
}: {
  showMemos: boolean;
  executive?: boolean;
  showSummary?: boolean;
}) {
  const pathname = usePathname();
  const items: Item[] = executive
    ? [
        { href: "/summary", label: "สรุปภาพรวม", icon: ChartColumn },
        { href: "/account", label: "บัญชี", icon: UserRound },
      ]
    : [
        { href: "/", label: "หน้าหลัก", icon: Home },
        { href: "/tickets", label: "งานซ่อม", icon: ClipboardList },
        { href: "/meeting-rooms", label: "ห้องประชุม", icon: DoorOpen },
        showMemos
          ? { href: "/memos", label: "บันทึก", icon: FileText }
          : { href: "/account", label: "บัญชี", icon: UserRound },
        ...(showSummary
          ? [{ href: "/summary", label: "สรุป", icon: ChartColumn }]
          : []),
      ];

  return (
    <nav
      aria-label="เมนูหลัก"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 grid border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden",
        { 2: "grid-cols-2", 4: "grid-cols-4", 5: "grid-cols-5" }[items.length],
      )}
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
