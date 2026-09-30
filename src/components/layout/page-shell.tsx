import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { UserMenu } from "@/components/dashboard/user-menu";
import { GridPattern } from "@/components/ui/grid-pattern";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { Viewer } from "@/lib/data/dashboard";

/** Frame for inner pages: crest link back to the dashboard, user menu, theme toggle. */
export function PageShell({ viewer, children }: { viewer: Viewer | null; children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <GridPattern
        width={32}
        height={32}
        className="h-[360px] stroke-primary/10 fill-primary/5 [mask-image:linear-gradient(to_bottom,white,transparent)]"
      />
      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Image src="/logo.png" alt="" width={640} height={1016} className="h-10 w-auto" />
            <span className="font-display text-lg font-semibold leading-tight">ระบบแจ้งซ่อม</span>
          </Link>
          <div className="flex items-center gap-2">
            <UserMenu viewer={viewer} />
            <ThemeToggle />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
