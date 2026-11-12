# Case: /memos candidate list

- Symptom: `GET /memos 500`. The dev log listed `./src/lib/supabase/server.ts` with traces through `components/dashboard/home-actions.tsx`, `components/tickets/status-mark.tsx`, and `components/memos/candidate-list.tsx`.
- Cause: `candidate-list.tsx` (client) imported `UrgencyMark` (status-mark) and `placeOf` (ticket-table). Those reached `lib/data/session` and then `lib/supabase/server` through `home-actions`.
- Fix: `candidate-list.tsx` takes `Candidate[]` with `detail: ReactNode`. `memos/page.tsx` (server) builds the `detail` with `placeOf` and `UrgencyMark`.
- Verified: dev route 200 in 670ms. Playwright at 390px confirmed the checkbox and merge button state.
