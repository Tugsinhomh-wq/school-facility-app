import "server-only";

import { cache } from "react";

import { NO_WINDOW, type CheckWindow } from "@/lib/cleaning";
import { getSession } from "@/lib/data/session";

/**
 * The cleaning check window (cleaning_settings, one row). Fails open: signed out, a read error or a
 * missing table (cleaning_03.sql not run yet) all mean "no window", so a deploy before the SQL changes
 * nothing. Cached per request, so the page and its loaders share one read.
 */
export const getCheckWindow = cache(async (): Promise<CheckWindow> => {
  try {
    const s = await getSession();
    if (!s) return NO_WINDOW;
    const { data, error } = await s.supabase
      .from("cleaning_settings")
      .select("check_start, check_end")
      .maybeSingle();
    if (error) {
      console.error("check window off: read failed", error.code);
      return NO_WINDOW;
    }
    return { start: data?.check_start ?? null, end: data?.check_end ?? null };
  } catch {
    console.error("check window off: read threw");
    return NO_WINDOW;
  }
});
