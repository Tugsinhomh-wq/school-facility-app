---
name: nextjs-server-client-boundary
description: Use when Next.js page 500s with next/headers import error.
category: web-development
---

# Keep server-only code out of client components

A `"use client"` component, or any module it imports, must never reach `next/headers`, `cookies()`, or `lib/supabase/server`. Next.js fails the route at runtime with "You're importing a module that depends on next/headers". tsc and eslint do not catch it.

- Before importing a shared component into a client component, check its import chain. A component such as `UrgencyMark` or `placeOf` can reach `home-actions` → `lib/data/session` → `supabase/server` through a helper that looks harmless.
- Fix: the Server Component page renders the server-dependent piece as a `ReactNode` and passes it as a prop. The client component takes plain serializable data plus a `detail: ReactNode` slot, and does not import the helper.
- Confirm with the dev log: `grep -n "Import traces" -A 20` shows the chain. Re-curl the route until it returns 200.

Case detail: `references/memo-candidate-case.md`.
