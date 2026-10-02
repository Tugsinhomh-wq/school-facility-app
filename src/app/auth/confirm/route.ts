import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const SCHOOL_DOMAIN = "@lrp.ac.th";

/** Landing point for the confirmation link in the sign-up email (PKCE `code` or `token_hash`). */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let error: unknown = new Error("missing parameters");
  if (code) ({ error } = await supabase.auth.exchangeCodeForSession(code));
  else if (tokenHash && type)
    ({ error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    }));

  const target = request.nextUrl.clone();
  target.search = "";

  // Google sign-in is for school accounts only. `hd` is just a hint to Google, so enforce it here:
  // a Google account from another domain is signed out and, if it was created just now, removed.
  if (!error && code) {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (
      user?.app_metadata?.provider === "google" &&
      !user.email?.toLowerCase().endsWith(SCHOOL_DOMAIN)
    ) {
      await supabase.auth.signOut();
      if (Date.now() - new Date(user.created_at).getTime() < 10 * 60_000) {
        try {
          await createAdminClient().auth.admin.deleteUser(user.id);
        } catch {
          // best effort: the account has no role beyond "user" and no data
        }
      }
      target.pathname = "/login";
      target.searchParams.set("error", "domain");
      return NextResponse.redirect(target);
    }
  }

  if (error) {
    target.pathname = "/login";
    target.searchParams.set("error", "confirm");
  } else {
    target.pathname = "/";
  }
  return NextResponse.redirect(target);
}
