import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { MODULE_ICONS } from "@/components/layout/module-icons";
import { cn } from "@/lib/utils";
import { visibleModules } from "@/lib/modules";
import type { UserRole } from "@/types/database";

/** The work modules as a menu: live ones are links, the ones still being built are plain tiles marked "เร็วๆ นี้". */
export function ModuleMenu({ role }: { role: UserRole | null }) {
  const modules = visibleModules(role);
  if (modules.length === 0) return null;
  return (
    <section aria-labelledby="module-menu-title" className="mb-5">
      <h2 id="module-menu-title" className="mb-2 text-sm font-semibold text-muted-foreground">
        งานของกลุ่มงานบริหารทั่วไป
      </h2>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {modules.map((m) => {
          const Icon = MODULE_ICONS[m.id];
          const body = (
            <>
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-10",
                  m.href ? "bg-cta text-cta-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {Icon && <Icon className="size-5" aria-hidden />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col sm:mt-3 sm:flex-none">
                <span className="flex items-center gap-1 text-sm font-semibold leading-snug">
                  {m.label}
                  {m.href && <ChevronRight className="size-4 text-muted-foreground" aria-hidden />}
                </span>
                <span className="mt-1 hidden text-xs leading-snug text-muted-foreground sm:block">{m.hint}</span>
                {m.soon && (
                  <span className="mt-1 w-fit rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground sm:mt-2">
                    เร็วๆ นี้
                  </span>
                )}
              </span>
            </>
          );
          const base = "flex h-full items-center gap-3 rounded-xl border p-3 sm:flex-col sm:items-stretch sm:gap-0 sm:p-4";
          return (
            <li key={m.id}>
              {m.href ? (
                <Link
                  href={m.href}
                  className={cn(
                    base,
                    "border-border bg-card/85 backdrop-blur-sm outline-none transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50",
                  )}
                >
                  {body}
                </Link>
              ) : (
                <div className={cn(base, "border-dashed border-border bg-card/40")} aria-disabled="true">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
