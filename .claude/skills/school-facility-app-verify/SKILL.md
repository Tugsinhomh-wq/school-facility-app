---
name: school-facility-app-verify
description: Use when running npm test, eslint, or tsc in this repo.
category: testing
---

# Verifying school-facility-app changes

- Tests: `npm test` runs `node --experimental-strip-types --test` over `src/lib/**/*.test.ts`. One file: `node --experimental-strip-types --test src/lib/<file>.test.ts`.
- Under the node test runner the `@/` alias does not resolve. In any module a test imports, and in the test file itself, use relative imports with the `.ts` extension, for example `import { TZ } from "./time.ts";`. Existing `src/lib` modules already do this (`cleaning.ts` imports `./time.ts`).
- Lint the changed files: `npx eslint <files>`.
- Typecheck: `npx tsc --noEmit` already fails on one pre-existing error, `src/app/layout.tsx: Cannot find name 'LayoutProps'`. Report it as pre-existing, and check that no new errors appear beyond it.
- In the final report, give the test count (for example "266 pass, 0 fail") and say the live site was not exercised.
