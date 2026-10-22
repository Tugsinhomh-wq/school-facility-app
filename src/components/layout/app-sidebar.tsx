import { LogIn, LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { signOut } from "@/app/auth/actions";
import { NAV_ICONS } from "@/components/layout/module-icons";
import { NavLink } from "@/components/layout/site-nav";
import type { Viewer } from "@/lib/data/dashboard";
import { navGroups } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/ticket-meta";

const BRAND = "สำนักงานออนไลน์";
const SCHOOL = "โรงเรียนละหานทรายรัชดาภิเษก";

/** Desktop navigation (md and up): brand, the grouped menu from `navGroups`, then the signed-in user. */
export function AppSidebar({ viewer }: { viewer: Viewer | null }) {
  const AccountIcon = NAV_ICONS.account;
  return (
    <aside className="sticky top-0 hidden h-screen w-58 shrink-0 flex-col gap-4 overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-5 md:flex print:hidden">
      <Link
        href="/"
        className="flex items-center gap-3 rounded-lg px-2 py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Image src="/logo.png" alt="" width={640} height={1016} className="h-10 w-auto shrink-0" priority />
        <span className="min-w-0 leading-snug">
          <span className="block font-semibold">{BRAND}</span>
          <span className="block text-xs text-muted-foreground">{SCHOOL}</span>
        </span>
      </Link>

      <nav aria-label="เมนูหลัก" className="flex-1">
        {navGroups(viewer?.role ?? null).map((group, i) => (
          <div key={group.heading ?? i} className={group.heading ? "mt-4" : undefined}>
            {group.heading && <p className="mb-1 px-3 text-xs font-medium text-muted-foreground">{group.heading}</p>}
            <ul className="space-y-0.5">
              {group.items.map(({ id, label, href, soon }) => {
                const Icon = NAV_ICONS[id];
                return (
                  <li key={id}>
                    {href ? (
                      <NavLink href={href}>
                        <Icon className="size-[18px] shrink-0" aria-hidden />
                        {label}
                      </NavLink>
                    ) : (
                      <span aria-disabled="true" className="flex min-h-11 items-center gap-3 px-3 text-sm text-muted-foreground">
                        <Icon className="size-[18px] shrink-0" aria-hidden />
                        <span className="min-w-0 flex-1">{label}</span>
                        {soon && (
                          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium">เร็วๆ นี้</span>
                        )}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-sidebar-border pt-3">
        {viewer ? (
          <>
            <NavLink href="/account">
              <AccountIcon className="size-[18px] shrink-0" aria-hidden />
              บัญชีของฉัน
            </NavLink>
            <p className="px-3 pt-1 text-sm leading-snug">
              <span className="block font-medium">{viewer.name}</span>
              <span className="text-xs text-muted-foreground">{ROLE_LABEL[viewer.role]}</span>
            </p>
            <form action={signOut}>
              <button
                type="submit"
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-foreground outline-none hover:bg-sidebar-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <LogOut className="size-[18px] shrink-0" aria-hidden />
                ออกจากระบบ
              </button>
            </form>
          </>
        ) : (
          <NavLink href="/login">
            <LogIn className="size-[18px] shrink-0" aria-hidden />
            เข้าสู่ระบบ
          </NavLink>
        )}
      </div>
    </aside>
  );
}
