import type { ReactNode } from "react";

import { MobileNav } from "@/components/layout/mobile-nav";
import { QuickReportFab } from "@/components/layout/quick-report-fab";
import { AppHeader } from "@/components/layout/app-header";
import { GridPattern } from "@/components/ui/grid-pattern";
import { getSession } from "@/lib/data/session";

/**
 * Shared frame for every signed-in page. Living in a layout, the header and grid stay mounted while
 * pages change, so a click only has to load the page body.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  return (
    <div className="relative min-h-screen overflow-hidden">
      <GridPattern
        width={32}
        height={32}
        className="h-[360px] stroke-primary/10 fill-primary/5 [mask-image:linear-gradient(to_bottom,white,transparent)]"
      />
      <div className="relative mx-auto max-w-7xl px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-28 sm:px-6 md:py-6">
        <AppHeader viewer={session?.viewer ?? null} />
        {children}
      </div>
      {session && <QuickReportFab />}
      <MobileNav showMemos={session?.viewer.role === "staff" || session?.viewer.role === "super_admin"} />
    </div>
  );
}
