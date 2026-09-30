import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/auth"];

/**
 * Refreshes the Supabase session cookie and applies the optimistic sign-in
 * redirects. Real authorization still happens in RLS and in each data call.
 * Without Supabase env vars the app runs in demo mode and nothing is enforced.
 */
export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

  const redirectTo = (pathname: string) => {
    const target = request.nextUrl.clone();
    target.pathname = pathname;
    target.search = "";
    const redirect = NextResponse.redirect(target);
    // Keep any refreshed session cookies on the redirect response.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!user && !isPublic) return redirectTo("/login");
  if (user && path === "/login") return redirectTo("/");
  return response;
}
