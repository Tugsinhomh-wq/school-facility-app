import { cache } from "react";

import type { Viewer } from "@/lib/data/dashboard";
import { getAuth } from "@/lib/supabase/auth";
import type { UserRole } from "@/types/database";

export const hasSupabase = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export const isStaffRole = (role?: UserRole | null) => role === "staff" || role === "super_admin";

/**
 * The signed-in user with a server client, or null (demo mode or signed out). Cached for the
 * request, so the layout and the page share one lookup instead of each repeating it.
 */
export const getSession = cache(async () => {
  if (!hasSupabase()) return null;
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: auth } = await getAuth(supabase);
  if (!auth.user) return null;
  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", auth.user.id).maybeSingle();
  const viewer: Viewer = { name: profile?.full_name ?? auth.user.email ?? "ผู้ใช้", role: (profile?.role as UserRole | undefined) ?? "user" };
  return { supabase, viewer, userId: auth.user.id };
});
