"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export interface NavItem {
  /** Null for a module that is not built yet: it shows as a label, not a link. */
  href: string | null;
  label: string;
  soon?: boolean;
}

export function SiteNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="เมนูหลัก"
      className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1"
    >
      {items.map(({ href, label, soon }) => {
        if (href === null)
          return (
            <span
              key={label}
              aria-disabled="true"
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground/70"
            >
              {label}
              {soon && <span className="rounded-full bg-muted px-1.5 text-[10px] leading-4">เร็วๆ นี้</span>}
            </span>
          );
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
              "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
