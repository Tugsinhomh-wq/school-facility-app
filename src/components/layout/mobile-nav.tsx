"use client";

import { ChartColumn, FileText, Home, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { MODULE_ICONS } from "@/components/layout/module-icons";
import { visibleModules } from "@/lib/modules";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Bottom tab bar for phones: home, the live modules, then Memos for staff or the account for everyone else; the administrator gets a last tab for the summary. Executives get two tabs. */
export function MobileNav({ role }: { role: UserRole | null }) {
  const pathname = usePathname();
  const showMemos = role !== null && role !== "user" && role !== "executive";
  const items: Item[] =
    role === "executive"
      ? [
          { href: "/summary", label: "สรุปภาพรวม", icon: ChartColumn },
          { href: "/account", label: "บัญชี", icon: UserRound },
        ]
      : [
          { href: "/", label: "หน้าหลัก", icon: Home },
          // Modules still being built have no page, so they stay off the bar (the home menu lists them).
          ...visibleModules(role).flatMap((m) =>
            m.href
              ? [{ href: m.href, label: m.short ?? m.label, icon: MODULE_ICONS[m.id] }]
              : [],
          ),
          showMemos
            ? { href: "/memos", label: "บันทึก", icon: FileText }
            : { href: "/account", label: "บัญชี", icon: UserRound },
          ...(role === "super_admin"
            ? [{ href: "/summary", label: "สรุป", icon: ChartColumn }]
            : []),
        ];

  return (
    <nav
      aria-label="เมนูหลัก"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 grid border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden",
        { 2: "grid-cols-2", 5: "grid-cols-5", 6: "grid-cols-6" }[items.length],
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
