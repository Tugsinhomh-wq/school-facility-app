import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { LastPageTracker } from "@/components/layout/last-page-tracker";
import { MobileNav } from "@/components/layout/mobile-nav";
import { QuickReportFab } from "@/components/layout/quick-report-fab";
import { getSession } from "@/lib/data/session";

/**
 * Shared frame for every signed-in page: sidebar on desktop, tab bar on phones. Living in a
 * layout, the navigation stays mounted while pages change, so a click only loads the page body.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSession();
  const viewer = session?.viewer ?? null;
  return (
    <div className="min-h-screen md:flex">
      <AppSidebar viewer={viewer} />
      <div className="min-w-0 flex-1 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-28 sm:px-6 md:px-10 md:pt-10 md:pb-10 print:p-0">
        <LastPageTracker />
        <div className="mx-auto max-w-6xl">
          <Link
            href="/"
            className="mb-5 flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden print:hidden"
          >
            <Image src="/logo.png" alt="" width={640} height={1016} className="h-8 w-auto" priority />
            <span className="font-semibold">สำนักงานออนไลน์</span>
          </Link>
          {children}
        </div>
      </div>
      {viewer && viewer.role !== "executive" && <QuickReportFab />}
      <MobileNav role={viewer?.role ?? null} signedIn={viewer !== null} />
    </div>
  );
}
