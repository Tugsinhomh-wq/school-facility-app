import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client: bypasses Row Level Security. Only for trusted server jobs
 * (never import it from a component that reaches the browser).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase URL or SUPABASE_SECRET_KEY is not set");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
