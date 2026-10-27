import { redirect } from "next/navigation";
import { cache } from "react";

import type { Viewer } from "@/lib/data/dashboard";
import { getAuth } from "@/lib/supabase/auth";
import type { UserRole } from "@/types/database";

export const hasSupabase = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
/** Repair staff, department heads (head = staff in every check) and admins. */
export const isStaffRole = (role?: UserRole | null) =>
  role === "staff" || role === "head" || role === "super_admin";
/** Facility officers: can see every classroom and its cleaning confirmations. Same set as isStaffRole. */
export const isFacilityOfficer = (role?: UserRole | null) => isStaffRole(role);
/** Anyone who can decide on room requests: repair staff, heads, admins and the meeting-room officer. */
export const isRoomManager = (role?: UserRole | null) =>
  isStaffRole(role) || role === "room_staff";

/** The executive summary page: executives and the system administrator only. */
export const canSeeSummary = (role?: UserRole | null) =>
  role === "executive" || role === "super_admin";

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
  let { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, role, consent_version")
    .eq("id", auth.user.id)
    .maybeSingle();
  // consent_01.sql not run yet: read the profile without the column and let the consent gate fail open.
  if (error?.code === "42703") {
    console.error("consent gate open: profiles.consent_version missing", error.code);
    ({ data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", auth.user.id)
      .maybeSingle());
    error = null;
  }
  const viewer: Viewer = {
    name: profile?.full_name ?? auth.user.email ?? "ผู้ใช้",
    role: (profile?.role as UserRole | undefined) ?? "user",
  };
  // undefined = could not read it (column missing, query failed, no profile row): the gate lets the user through.
  const consentVersion = error || !profile ? undefined : ((profile.consent_version as string | null) ?? null);
  return { supabase, viewer, userId: auth.user.id, consentVersion, metaConsentVersion: auth.user.consentVersion };
});

/** Executives see the summary page only: any other page sends them there. */
export async function guardExecutive() {
  const session = await getSession();
  if (session?.viewer.role === "executive") redirect("/summary");
}
