"use client";

import Link from "next/link";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type { DashTab } from "@/lib/data/dashboard";

const TABS: { id: DashTab; label: string; href: string }[] = [
  { id: "repairs", label: "งานแจ้งซ่อม", href: "/" },
  { id: "rooms", label: "ขอใช้ห้องประชุม", href: "/?tab=rooms" },
];

function TabLink({ tab, active }: { tab: (typeof TABS)[number]; active: boolean }) {
  // Prefetch the whole tab only once the pointer or a finger is close, so idle tabs cost nothing.
  const [hot, setHot] = useState(false);
  const warm = () => setHot(true);
  return (
    <Link
      href={tab.href}
      prefetch={hot}
      onMouseEnter={warm}
      onFocus={warm}
      onTouchStart={warm}
      role="tab"
      aria-selected={active}
      className={cn(
        "flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium sm:flex-none sm:py-1.5 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {tab.label}
    </Link>
  );
}

export function DashboardTabs({ active }: { active: DashTab }) {
  return (
    <div role="tablist" aria-label="มุมมองแดชบอร์ด" className="mb-4 flex gap-1 rounded-xl bg-muted p-1 sm:inline-flex">
      {TABS.map((t) => (
        <TabLink key={t.id} tab={t} active={t.id === active} />
      ))}
    </div>
  );
}
