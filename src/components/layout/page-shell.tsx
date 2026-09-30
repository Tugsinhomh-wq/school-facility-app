import type { ReactNode } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { GridPattern } from "@/components/ui/grid-pattern";
import type { Viewer } from "@/lib/data/dashboard";

/** Frame for inner pages: navigation bar, faint grid, content. */
export function PageShell({ viewer, children }: { viewer: Viewer | null; children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <GridPattern
        width={32}
        height={32}
        className="h-[360px] stroke-primary/10 fill-primary/5 [mask-image:linear-gradient(to_bottom,white,transparent)]"
      />
      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <AppHeader viewer={viewer} />
        {children}
      </div>
    </div>
  );
}
