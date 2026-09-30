import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static assets and image files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
