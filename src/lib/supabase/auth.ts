import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuthUser {
  id: string;
  email?: string;
  /** The policy version stored in the sign-up metadata (email sign-ups only). */
  consentVersion?: string;
}

/**
 * The signed-in user, read from the access token's signature (checked against the project's
 * public keys, cached) instead of a round trip to Supabase Auth. That round trip is what made
 * every page wait on an extra network call. Row Level Security still checks the same token on
 * every query, so data access is unchanged; the one difference is that a session revoked on the
 * server keeps working here until its token expires (at most an hour).
 *
 * Returns the same shape as `supabase.auth.getUser()` so call sites stay simple.
 */
export async function getAuth(supabase: SupabaseClient): Promise<{ data: { user: AuthUser | null } }> {
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { data: { user: null } };
  const consent = (claims.user_metadata as { consent_version?: unknown } | undefined)?.consent_version;
  return {
    data: {
      user: {
        id: claims.sub,
        email: typeof claims.email === "string" ? claims.email : undefined,
        consentVersion: typeof consent === "string" ? consent : undefined,
      },
    },
  };
}
