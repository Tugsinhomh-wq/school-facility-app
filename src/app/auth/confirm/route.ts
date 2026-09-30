import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/** Landing point for the confirmation link in the sign-up email (PKCE `code` or `token_hash`). */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let error: unknown = new Error("missing parameters");
  if (code) ({ error } = await supabase.auth.exchangeCodeForSession(code));
  else if (tokenHash && type) ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));

  const target = request.nextUrl.clone();
  target.search = "";
  if (error) {
    target.pathname = "/login";
    target.searchParams.set("error", "confirm");
  } else {
    target.pathname = "/";
  }
  return NextResponse.redirect(target);
}
