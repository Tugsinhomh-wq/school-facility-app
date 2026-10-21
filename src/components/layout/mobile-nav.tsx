"use client";

import { LogIn, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { signOut } from "@/app/auth/actions";
import { NAV_ICONS } from "@/components/layout/module-icons";
import { isActivePath } from "@/components/layout/site-nav";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { navGroups, type NavEntry } from "@/lib/nav";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

const ACCOUNT: NavEntry = { id: "account", label: "บัญชีของฉัน", href: "/account" };
/** The entries that get their own tab; everything else is under เพิ่มเติม. */
const TAB_IDS = ["home", "repair", "rooms"];

const TAB = "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50";

/**
 * Bottom tab bar for phones: หน้าแรก, แจ้งซ่อม, จองห้อง and เพิ่มเติม, which opens a sheet with the
 * rest of the menu, the account and sign-out. Executives get two tabs (summary, account).
 */
export function MobileNav({ role, signedIn }: { role: UserRole | null; signedIn: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const groups = navGroups(role);
  const entries = groups.flatMap((g) => g.items);
  const executive = role === "executive";
  const tabs = executive ? [...entries, ACCOUNT] : entries.filter((e) => TAB_IDS.includes(e.id));
  const sheetGroups = executive
    ? []
    : groups
        .map((g) => ({ ...g, items: g.items.filter((e) => !TAB_IDS.includes(e.id)) }))
        .filter((g) => g.items.length > 0);
  const inSheet =
    pathname.startsWith("/account") ||
    sheetGroups.some((g) => g.items.some((e) => e.href && isActivePath(pathname, e.href)));

  return (
    <nav
      aria-label="เมนูหลัก"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 grid border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden",
        executive ? "grid-cols-2" : "grid-cols-4",
      )}
    >
      {tabs.map(({ id, label, href }) => {
        const Icon = NAV_ICONS[id];
        const active = href !== null && isActivePath(pathname, href);
        return (
          <Link
            key={id}
            href={href ?? "/"}
            aria-current={active ? "page" : undefined}
            className={cn(TAB, active ? "text-primary" : "text-muted-foreground")}
          >
            <Icon className="size-6" aria-hidden />
            {label}
          </Link>
        );
      })}
      {!executive && (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            className={cn(TAB, inSheet ? "text-primary" : "text-muted-foreground")}
          >
            <NAV_ICONS.more className="size-6" aria-hidden />
            เพิ่มเติม
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="top-auto bottom-0 max-h-[85dvh] max-w-full translate-y-0 overflow-y-auto rounded-b-none rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <DialogHeader>
                <DialogTitle className="text-lg">เมนูเพิ่มเติม</DialogTitle>
                <DialogDescription className="sr-only">งานอื่นๆ บัญชีของฉัน และออกจากระบบ</DialogDescription>
              </DialogHeader>
              {[...sheetGroups, ...(signedIn ? [{ heading: null, items: [ACCOUNT] }] : [])].map((group, i) => (
                <div key={group.heading ?? i}>
                  {group.heading && <p className="mb-1 text-xs font-medium text-muted-foreground">{group.heading}</p>}
                  <ul>
                    {group.items.map(({ id, label, href, soon }) => {
                      const Icon = NAV_ICONS[id];
                      return (
                        <li key={id} className="border-t border-border first:border-t-0">
                          {href ? (
                            <Link
                              href={href}
                              onClick={() => setOpen(false)}
                              aria-current={isActivePath(pathname, href) ? "page" : undefined}
                              className="flex min-h-12 items-center gap-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                              <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                              {label}
                            </Link>
                          ) : (
                            <span aria-disabled="true" className="flex min-h-12 items-center gap-3 text-base text-muted-foreground">
                              <Icon className="size-5 shrink-0" aria-hidden />
                              <span className="min-w-0 flex-1">{label}</span>
                              {soon && (
                                <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium">เร็วๆ นี้</span>
                              )}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {signedIn ? (
                <form action={signOut}>
                  <button
                    type="submit"
                    className="flex min-h-12 w-full items-center gap-3 border-t border-border text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <LogOut className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                    ออกจากระบบ
                  </button>
                </form>
              ) : (
                <Link
                  href="/login"
                  className="flex min-h-12 items-center gap-3 border-t border-border text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <LogIn className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  เข้าสู่ระบบ
                </Link>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </nav>
  );
}
