---
name: react-render-purity
description: Use when eslint: impure function during render, Date.now.
category: frontend
---

# Keep the clock out of JSX during render

Read the clock once in the component body, before the `return`, and pass the value into pure helpers as an argument. Do not call `Date.now()` (or `Math.random()`) inside JSX; this repo's `react-hooks/purity` lint rule rejects it.

- Compute `const now = new Date().getTime();` (or a value from a helper such as `bangkokYmd(new Date())`) above the `return`, then reference that variable in the JSX.
- Make the helper that needs the time take `now` as a parameter, so tests pass a fixed instant and never read the real clock.
- If a value is only needed on one branch, compute it above the conditional, store it in a const, and choose the branch on that const.
- After the fix, rerun `npx eslint src` and `npx tsc --noEmit`; the test suite does not catch this rule.

Worked example from the backlog page: references/backlog-page-example.md.
