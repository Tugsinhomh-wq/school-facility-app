"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export const LAST_PAGE_KEY = "lastPage";

/** Remembers the last page that was not the account page, so feedback can say where the user came from. */
export function LastPageTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === "/account") return;
    try {
      sessionStorage.setItem(LAST_PAGE_KEY, pathname);
    } catch {
      // storage can be blocked; feedback then just has no page
    }
  }, [pathname]);
  return null;
}
