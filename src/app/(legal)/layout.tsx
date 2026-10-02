import Link from "next/link";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/ui/theme-toggle";

/** Plain frame for the public policy pages: readable without signing in. */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← กลับไประบบแจ้งซ่อม
          </Link>
          <ThemeToggle />
        </div>
        <main className="space-y-6 leading-relaxed [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
          {children}
        </main>
        <nav
          aria-label="เอกสารที่เกี่ยวข้อง"
          className="mt-10 flex gap-4 border-t border-border pt-4 text-sm text-muted-foreground"
        >
          <Link href="/privacy" className="hover:text-foreground">
            นโยบายความเป็นส่วนตัว
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            เงื่อนไขการใช้งาน
          </Link>
        </nav>
      </div>
    </div>
  );
}
