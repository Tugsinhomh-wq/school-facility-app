"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** True when `pathname` is the page `href` or one of its sub-pages ("/" matches only itself). */
export const isActivePath = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/** One sidebar link: the current page is highlighted and announced with aria-current. */
export function NavLink({ href, className, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const active = isActivePath(usePathname(), href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
          : "text-foreground hover:bg-sidebar-accent/60",
        className,
      )}
      {...props}
    />
  );
}
