---
name: school-facility-app-verify
description: Use when running npm test, eslint, or tsc in this repo.
category: testing
---

# Verifying school-facility-app changes

- Tests: `npm test` runs `node --experimental-strip-types --test` over `src/lib/**/*.test.ts`. One file: `node --experimental-strip-types --test src/lib/<file>.test.ts`.
- Under the node test runner the `@/` alias does not resolve. In any module a test imports, and in the test file itself, use relative imports with the `.ts` extension, for example `import { TZ } from "./time.ts";`. Existing `src/lib` modules already do this (`cleaning.ts` imports `./time.ts`).
- Lint the changed files: `npx eslint <files>`.
- Typecheck: `npx tsc --noEmit` can report `src/app/layout.tsx: Cannot find name 'LayoutProps'`. That error comes from Next's generated route types, which exist only after the dev server has run once. Start `npm run dev` (see below) before running tsc. If the error still shows, report it as pre-existing and check that no new errors appear beyond it.
- `tsc` and `eslint` pass even when a page crashes at runtime. A client component that imports a module pulling in `next/headers` (through `supabase/server`) only fails when the route is opened. For any UI or page change, also run `npm run dev -- -p 3123 > <scratchpad>/dev.log 2>&1 &`, `curl` the route (expect 200, not 500), and grep the log for `Import traces` or `⨯`.
- Mobile layout: a headless Playwright script in the scratchpad at 390px width can check that controls render and that a button's enabled state follows the selection. For list pages, read row order with `page.locator('ul.divide-y > li').evaluateAll(...)`, and check horizontal overflow with `document.documentElement.scrollWidth > window.innerWidth`. Look at a screenshot before claiming the layout works.
- In the final report, give the test count (for example "266 pass, 0 fail"). Say what was exercised: the dev route and screenshot count, or "live site not exercised" if none.
