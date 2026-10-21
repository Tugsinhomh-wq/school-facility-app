# งานอาคารสถานที่ รอบที่ 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the facility module: existing repair + meeting-room booking under a module-based shell, plus a new daily cleaning-zone confirmation per classroom, with the five-role permission model.

**Architecture:** Evolve the running Next.js 16 / Supabase app instead of rewriting it: the repair, booking, memo, feedback, trash, login and backup code already match the spec, so the work is additive (new `head` role, cleaning tables + RPC, module registry/nav, cleaning pages, Excel import) plus removals (Web Push). All SQL is additive so the live site keeps working on the same Supabase project until the final switch.

**Tech Stack:** Next.js 16.3.7 (App Router, server actions; read `node_modules/next/dist/docs` before using any API), React 19, Supabase (RLS, SECURITY DEFINER RPC, storage), Tailwind v4 + shadcn on base-ui, `exceljs` (new), Node 22 built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-21-facility-module-design.md` (mockups: https://claude.ai/artifact/1x4ik3iwJeg8FQdXhSTcNC)

## Global Constraints

- All user-visible text in Thai; school time is `Asia/Bangkok` (use `src/lib/time.ts`, never the server's local day).
- Phone-first for teachers: confirming a zone takes one tap (+ optional photos), no scores, no student names or accounts.
- No automatic reminders/notifications of any kind (Web Push is removed).
- Roles stored in DB enum `user_role`: `super_admin` (ผู้ดูแลระบบ), `head` (หัวหน้ากลุ่มงาน, new), `staff` (เจ้าหน้าที่งาน), `room_staff` (เจ้าหน้าที่ห้องประชุม, existing, meeting rooms only), `executive` (ผู้บริหาร), `user` (ผู้ใช้ทั่วไป). `head` can do everything `staff` can.
- Migrations only add; nothing is dropped. Old data is removed by a separate SQL file the user runs (Task 9).
- Keep: Google login, memo Word/PDF as is, Feedback, trash, PDPA/terms, nightly encrypted backup, light palette (navy + gold `variant="cta"`).
- A signed-in user whose data fails to load sees an error with retry, never sample data (existing `LoadError` in `src/components/ui/state-card.tsx`).
- Each task ends with `npx tsc --noEmit`, `npx eslint src` clean and one commit; use branch `claude/friendly-babbage-3723x6`; open a PR only when the user says so.
- Supabase MCP access may be denied in this environment. Tasks that need the DB write the SQL plus a short check query; the user runs them in the SQL editor and reports back. Do not run destructive SQL yourself.

## Review Focus

- A confirmation at 00:30 Bangkok on Tuesday must count as Tuesday even though the server clock (UTC) says Monday.
- Two co-advisors tap confirm for the same room and day at once: one row, first wins, second sees "ยืนยันแล้วโดย <ชื่อ>", no error.
- A teacher who is not an advisor of a classroom guesses its id (page URL or RPC call): refused, row not created or revealed.
- A day later marked as a holiday after it already has a confirmation keeps showing "ยืนยันแล้ว".
- Excel import with Thai digits in room names (ม.๓/๒), a UTF-8 BOM / extra spaces, a duplicate room, an unknown advisor email, two emails in one cell, a blank zone: each gives a row-numbered error or is normalized, and nothing is written when any row errors.
- Rollover run twice for the same target term must not duplicate classrooms.
- A user with role `head` passes every check that lists `staff` (tickets list, approving bookings) after the migration.
- Photos: more than 4, or a path outside the caller's own folder, are rejected by the RPC.

## File Structure

- `supabase/facility_01_head_role.sql`, `supabase/facility_02_cleaning.sql` — new migrations (run separately, in order).
- `supabase/facility_99_reset_old_data.sql` — cutover cleanup (user runs).
- `src/lib/cleaning.ts` (+ `.test.ts`) — pure day-state / week-grid rules.
- `src/lib/cleaning-import.ts` (+ `.test.ts`) — pure spreadsheet-row parser.
- `src/lib/modules.ts` — module registry used by header/mobile nav/home.
- `src/lib/data/cleaning.ts` — server data access for classrooms, confirmations, off-days.
- `src/app/(dashboard)/cleaning/{page.tsx,actions.ts}` — teacher confirm + officer overview.
- `src/app/(dashboard)/cleaning/manage/{page.tsx,actions.ts}` and `src/app/(dashboard)/cleaning/template/route.ts` — setup, import, rollover, off-days, xlsx template.
- `src/components/cleaning/*` — UI pieces (confirm card, week strip, room grid, weekly table, manage forms).
- Modified: `src/types/database.ts`, `src/lib/data/session.ts`, `src/lib/ticket-meta.ts`, `src/components/layout/{app-header,mobile-nav,site-nav}.tsx`, `src/app/(dashboard)/page.tsx`, `src/app/(dashboard)/users/*`, `src/lib/backup.ts`, `src/app/(legal)/*`, `package.json`, `tsconfig.json`.

---

### Task 1: Test harness and cleaning day rules

**Files:**
- Modify: `package.json` (script `"test": "node --experimental-strip-types --test \"src/lib/**/*.test.ts\""`), `tsconfig.json` (`allowImportingTsExtensions: true`)
- Create: `src/lib/cleaning.ts`, `src/lib/cleaning.test.ts`

**Interfaces:**
- Produces:
  - `type DayState = "confirmed" | "late" | "pending" | "missed" | "off" | "future"`
  - `type Confirmation = { isLate: boolean; byName: string }`
  - `dayState(args: { ymd: string; today: string; offDays: ReadonlySet<string>; confirmation: Confirmation | null }): DayState`
  - `weekGrid(args: { monday: string; today: string; offDays: ReadonlySet<string>; confirmations: ReadonlyMap<string, Confirmation> }): { ymd: string; state: DayState; confirmation: Confirmation | null }[]` (Mon–Fri, 5 entries)
  - Imports `addDays`, `weekdayIndex` from `./time.ts`.

Rules (precedence): confirmation present → `late` if `isLate` else `confirmed`; else weekend or in `offDays` → `off`; else `ymd > today` → `future`; `ymd === today` → `pending`; `ymd < today` → `missed`.

- [ ] **Step 1: Write failing tests** in `src/lib/cleaning.test.ts` (node:test + `node:assert/strict`): Saturday → `off`; holiday with no confirmation → `off`; holiday that has a confirmation → `confirmed`; today without confirmation → `pending`; yesterday without → `missed`; tomorrow → `future`; late confirmation → `late`; `weekGrid` for monday `2026-10-19`, today `2026-10-21` returns 5 entries whose ymds are 19–23 Oct.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL (module missing). If strip-types cannot resolve `./time.ts`, fix the tsconfig flag first.
- [ ] **Step 3:** Implement `cleaning.ts` per the rules above.
- [ ] **Step 4:** Run `npm test`. Expected: all PASS. Run tsc + eslint.
- [ ] **Step 5:** Commit `feat: cleaning day-state rules and test harness`.

---

### Task 2: Spreadsheet row parser

**Files:**
- Create: `src/lib/cleaning-import.ts`, `src/lib/cleaning-import.test.ts`

**Interfaces:**
- Produces:
  - `type ParsedClassroom = { name: string; building: string | null; advisorEmails: string[]; zone: string }`
  - `type ImportError = { row: number; message: string }` (row is the 1-based spreadsheet row)
  - `parseClassroomRows(rows: string[][]): { ok: ParsedClassroom[]; errors: ImportError[] }`

Header row (row 1) must contain the columns `ห้อง`, `อาคาร`, `อีเมลครูที่ปรึกษา`, `เขต` in any order; missing header → one error, row 1. Normalization: trim, collapse inner whitespace, strip BOM, Thai digits → ASCII in `name`, emails lower-cased and split on `,` `;` or whitespace. Errors (Thai messages): blank name, blank zone, no advisor email, malformed email, duplicate name within the file. `อาคาร` may be blank (→ `null`). Empty rows are skipped silently.

- [ ] **Step 1: Write failing tests** covering every Review Focus import case: `"ม.๓/๒"` becomes `"ม.3/2"`; BOM on first header cell; `"a@lrp.ac.th, b@lrp.ac.th"` → two emails; duplicate room → error on the second row number; blank zone → error; header-only file → `{ok: [], errors: []}`.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement `parseClassroomRows`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: classroom spreadsheet parser`.

---

### Task 3: Database — head role, cleaning tables, confirm RPC

**Files:**
- Create: `supabase/facility_01_head_role.sql`, `supabase/facility_02_cleaning.sql`

**Interfaces:**
- Produces (SQL objects):
  - enum value `user_role 'head'`; `public.current_role_is(...)` redefined so a `head` caller matches whenever `'staff'` is in the argument list.
  - `public.classrooms(id uuid pk, term text not null, name text not null, building_id uuid null references buildings, zone text not null, is_active bool default true, created_at)` with `unique(term, name)`.
  - `public.classroom_advisors(classroom_id uuid references classrooms on delete cascade, user_id uuid references profiles(id) on delete cascade, primary key(classroom_id, user_id))`.
  - `public.school_off_days(day date primary key, reason text)`.
  - `public.cleaning_confirmations(id uuid pk, classroom_id uuid references classrooms on delete cascade, day date not null, confirmed_by uuid references profiles(id), confirmed_at timestamptz default now(), is_late bool not null, photo_paths text[] default '{}', unique(classroom_id, day))`.
  - `public.confirm_cleaning(p_classroom uuid, p_day date, p_photos text[]) returns text` — SECURITY DEFINER, `search_path = ''`, returns `'confirmed'` or `'already'`.
  - private storage bucket `cleaning-photos` (1 MB limit, image mime types) with the same three own-folder policies as `feedback-images` in `supabase/feedback.sql`, read also allowed to staff/head/super_admin via `current_role_is('staff','super_admin')`.

Part 01 contains only `ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'head';` (a new enum value cannot be used in the same transaction; the header comment says to run it alone first). Part 02 starts with the `current_role_is` change.

RLS: all four tables RLS-enabled. `classrooms`/`school_off_days` readable by any authenticated user (off-days) or by officers + that classroom's advisors (classrooms); write by `current_role_is('staff','super_admin')` only. `classroom_advisors` readable by officers and by the row's own `user_id`. `cleaning_confirmations` select = officers + advisors of that classroom; **no insert/update/delete policy** (only the RPC writes).

RPC rules, in order, each raising a Thai exception: caller is an advisor of `p_classroom` and it is active; `p_day` not after today (Bangkok) ; `p_day` not before today − 7; `p_day` is Mon–Fri and not in `school_off_days`; `cardinality(p_photos) <= 4` and every path matches `<auth.uid()>/<uuid>.jpg`. Insert with `ON CONFLICT (classroom_id, day) DO NOTHING`; `is_late := p_day < (now() at time zone 'Asia/Bangkok')::date`; return `'already'` if nothing inserted. The 7-day window is an assumption flagged in the spec's "ข้อที่ Claude ตัดสินเอง" style; confirm with the user in the PR.

- [ ] **Step 1:** Write both files. Add at the bottom of part 02 a commented **check block**: queries that, run as the SQL editor with `set local role authenticated; set local request.jwt.claims ...` for a test advisor / non-advisor / head user, show: advisor confirm → `confirmed`, repeat → `already`, non-advisor → exception, future day → exception, Saturday → exception, 5 photos → exception, `head` user can `select` from `repair_tickets`.
- [ ] **Step 2:** Ask the user to run part 01 alone, then part 02, then the check block, and report the output. Expected: every line as listed above. (If Supabase MCP access works, apply via `apply_migration` instead.)
- [ ] **Step 3:** Commit `feat(db): head role, cleaning tables and confirm_cleaning`.

---

### Task 4: Roles in the app

**Files:**
- Modify: `src/types/database.ts` (`UserRole` adds `"head"`; add row types for the four new tables), `src/lib/data/session.ts`, `src/lib/ticket-meta.ts` (`ROLE_LABEL`), `src/app/(dashboard)/users/{actions.ts,page.tsx}`, `src/components/users/user-row.tsx`

**Interfaces:**
- Produces in `session.ts`: `isStaffRole(role)` now true for `staff`, `head`, `super_admin`; new `isFacilityOfficer(role)` = same set (alias with the meaning "can see all classrooms"); `isRoomManager` additionally true for `head`. Labels: `super_admin` ผู้ดูแลระบบ, `head` หัวหน้ากลุ่มงาน, `staff` เจ้าหน้าที่งาน, `room_staff` เจ้าหน้าที่ห้องประชุม, `executive` ผู้บริหาร, `user` ผู้ใช้ทั่วไป.

- [ ] **Step 1:** Update the types, helpers and labels; add `"head"` to `ROLES` in `users/actions.ts`, `ROLE_ORDER` in `user-row.tsx` and the filter in `users/page.tsx`.
- [ ] **Step 2:** `grep -rn 'role === "staff"\|"staff"' src` and check each hit: every place that means "repair staff" must also accept `head` (use `isStaffRole`).
- [ ] **Step 3:** tsc + eslint + `npm run build`. Expected: clean.
- [ ] **Step 4:** Commit `feat: head role in the app`.

---

### Task 5: Module registry, navigation and home

**Files:**
- Create: `src/lib/modules.ts`
- Modify: `src/components/layout/{app-header,mobile-nav,site-nav}.tsx`, `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/page.tsx`

**Interfaces:**
- Produces: `type AppModule = { id: string; label: string; href: string | null; soon?: boolean; roles: UserRole[] | "all" }` and `visibleModules(role: UserRole | null): AppModule[]`. Entries: `repair` (แจ้งซ่อม, `/tickets`), `rooms` (จองห้องประชุม, `/meeting-rooms`), `cleaning` (เขตทำความสะอาด, `/cleaning`), `census` (สำมะโนผู้เรียน, soon), `control` (ควบคุมภายใน, soon). Soon items render as non-links with the text "เร็วๆ นี้". Executives keep seeing only `/summary` and `/account` (existing `guardExecutive`).

- [ ] **Step 1:** Replace the inline nav arrays in `app-header.tsx` and `mobile-nav.tsx` with `visibleModules(role)` (read both files first and keep their layout, active-state and safe-area behavior).
- [ ] **Step 2:** In `page.tsx`, add a module menu grid below the existing stat cards (per mockup 1 of the artifact). The "ห้องเรียนยังไม่ยืนยันเขตวันนี้" card for officers and the teacher's own status card are added in Tasks 6 and 7.
- [ ] **Step 3:** Verify with Playwright at 390px and desktop for a teacher and a staff account: nav shows the right items, "เร็วๆ นี้" items are not links.
- [ ] **Step 4:** Commit `feat: module registry and navigation`.

---

### Task 6: Teacher confirmation page

**Files:**
- Create: `src/lib/data/cleaning.ts`, `src/app/(dashboard)/cleaning/page.tsx`, `src/app/(dashboard)/cleaning/actions.ts`, `src/components/cleaning/{confirm-card,week-strip}.tsx`

**Interfaces:**
- Consumes: `weekGrid`/`dayState` (Task 1), `confirm_cleaning` RPC (Task 3), `ImagePicker` with its `bucket` prop (`src/components/tickets/image-picker.tsx`) set to `"cleaning-photos"`, `getSession`.
- Produces in `data/cleaning.ts`:
  - `type ClassroomRow = { id: string; name: string; zone: string; building: string | null; advisors: { id: string; name: string }[] }`
  - `getMyClassrooms(): Promise<{ rows: ClassroomRow[]; failed?: boolean }>`
  - `getWeek(classroomIds: string[], monday: string): Promise<{ confirmations: Map<string, Map<string, Confirmation>>; offDays: Set<string> }>` (outer key classroom id, inner key ymd)
  - `getTodayCounts(): Promise<{ confirmed: number; total: number } | null>` (null for non-officers)
- Produces in `actions.ts`: `confirmCleaning(_prev: ConfirmResult | null, formData: FormData): Promise<ConfirmResult>` where `ConfirmResult = { ok: boolean; message: string }`; form fields `classroom_id`, `day`, repeated `photo_paths`; calls the RPC, maps `'already'` to a friendly message naming who confirmed, `revalidatePath("/cleaning")` and `"/"`.

Page: the viewer's own classrooms (one card each; a teacher with several classrooms sees all), card = zone, today's status pill, one gold `variant="cta"` button, optional photo picker, and the Mon–Fri `week-strip` (tap a past `missed` day to confirm it late, label "ยืนยันย้อนหลัง"). A teacher with no classroom sees `EmptyState` "ยังไม่ได้ระบุห้องที่ปรึกษา ติดต่อเจ้าหน้าที่งานอาคารสถานที่".

- [ ] **Step 1:** Implement the data functions (queries via the user's session client so RLS applies; `failed: true` on error, per Global Constraints).
- [ ] **Step 2:** Implement the action, card and strip.
- [ ] **Step 3:** Verify with Playwright (needs a test advisor account + a classroom row inserted by the user's SQL): confirm once → pill turns green; confirm again from a second tab → friendly "ยืนยันแล้ว" message; Saturday/holiday cells are neutral; 390px has no horizontal scroll. If test data cannot be created, state that and stop at a build + visual check with mocked props.
- [ ] **Step 4:** Commit `feat: teacher cleaning confirmation`.

---

### Task 7: Officer overview and weekly summary

**Files:**
- Modify: `src/app/(dashboard)/cleaning/page.tsx` (officer branch), `src/lib/data/cleaning.ts`
- Create: `src/components/cleaning/{room-grid,weekly-table}.tsx`

**Interfaces:**
- Consumes: Task 6 functions, `isFacilityOfficer`.
- Produces: `getAllClassrooms(): Promise<{ rows: ClassroomRow[]; failed?: boolean }>`; page search params `building` (building id) and `only=missing`.

Officer branch (same URL as the teacher page): header "ยืนยันแล้ว X / Y ห้อง", building filter chips, "เฉพาะที่ยังไม่ยืนยัน" toggle, room grid with unconfirmed rooms first and red border, each room tile showing zone, advisor names and who/when confirmed (+ "มีรูป" with signed-URL thumbnails on open), then the Mon–Fri weekly table (week navigation by `?week=`, reuse `mondayOf`/`addDays`). A user who is both officer and advisor sees the officer view plus a link "ห้องของฉัน".

- [ ] **Step 1:** Implement `getAllClassrooms` and the two components; wire into the page. Also add the officer stat card "ห้องเรียนยังไม่ยืนยันเขตวันนี้" (from `getTodayCounts`, linking to `/cleaning?only=missing`) to the home page `src/app/(dashboard)/page.tsx`, and in Task 6's page-adjacent work show teachers a one-line status of their classrooms there (`getMyClassrooms` + today's confirmation).
- [ ] **Step 2:** Verify with Playwright as a staff account: ordering, filters, week navigation, 390px layout.
- [ ] **Step 3:** Commit `feat: officer cleaning overview`.

---

### Task 8: Setup page — classrooms, advisors, import, rollover, holidays

**Files:**
- Create: `src/app/(dashboard)/cleaning/manage/page.tsx`, `src/app/(dashboard)/cleaning/manage/actions.ts`, `src/app/(dashboard)/cleaning/template/route.ts`, `src/components/cleaning/{classroom-form,import-form,rollover-form,off-days-form}.tsx`
- Modify: `package.json` (add `exceljs`)

**Interfaces:**
- Consumes: `parseClassroomRows` (Task 2), `createAdminClient` only if profile lookup by email is blocked by RLS (otherwise the session client).
- Produces in `manage/actions.ts` (all officer-only, checked via `isFacilityOfficer`; each returns `{ ok: boolean; message: string; errors?: ImportError[] }`):
  - `saveClassroom(_prev, formData)` — fields `id?`, `term`, `name`, `building_id?`, `zone`, `advisor_emails` (comma separated); unknown email → error naming it.
  - `importClassrooms(_prev, formData)` — field `file` (.xlsx or .csv, ≤ 1 MB), `term`; reads with exceljs into `string[][]`, runs the parser, resolves emails against `profiles.email`, **writes nothing if any error**, otherwise upserts classrooms by `(term, name)` and replaces their advisor sets.
  - `rolloverTerm(_prev, formData)` — fields `from_term`, `to_term`; copies active classrooms and advisors, skips names already present in `to_term` (idempotent).
  - `setOffDay(_prev, formData)` / `removeOffDay(formData)` — `day`, `reason`.
  - `GET /cleaning/template` returns an .xlsx with the four headers and one example row (`ม.3/2`, `อาคาร 2`, `somying@lrp.ac.th`, `ทางเดินหน้าอาคาร 2 ชั้น 1`).

- [ ] **Step 1:** `npm install exceljs`; build the template route; verify the downloaded file opens and re-imports through the same code path in a manual run.
- [ ] **Step 2:** Implement actions, then the page with a term selector (default = the latest term present) and the four forms.
- [ ] **Step 3:** Verify the Review Focus import and rollover cases through the UI (bad file shows row-numbered errors and writes nothing; rollover twice = same count).
- [ ] **Step 4:** Commit `feat: cleaning setup, import and rollover`.

---

### Task 9: Remove Web Push, refresh legal copy and backup list

**Files:**
- Delete: `src/lib/push.ts`, `src/components/account/push-toggle.tsx`, the push handler in `public/sw.js` (keep the file if it also handles installability), push subscription code in `src/app/(dashboard)/account/{actions.ts,page.tsx}`
- Modify: callers of `notifyStaffNewTicket` and related in `src/app/(dashboard)/actions.ts`, `meeting-rooms/actions.ts`, `tickets/actions.ts`; `package.json` (remove `web-push`, `@types/web-push`); `src/lib/backup.ts` (`BACKUP_TABLES` += `classrooms`, `classroom_advisors`, `school_off_days`, `cleaning_confirmations`; drop `push_subscriptions`); `src/app/(legal)/{privacy,terms}/page.tsx` (describe the facility system: repair, rooms, cleaning confirmations with optional photos, no student data); `docs/backup.md`

- [ ] **Step 1:** Remove the push code and callers; `grep -rni "push\|vapid" src public` must show nothing relevant afterwards.
- [ ] **Step 2:** Update backup table list and legal copy.
- [ ] **Step 3:** tsc + eslint + `npm run build`. Expected: clean.
- [ ] **Step 4:** Commit `chore: remove web push, update legal copy and backup tables`.

---

### Task 10: Cutover SQL and final verification

**Files:**
- Create: `supabase/facility_99_reset_old_data.sql`
- Modify: `README.md` (short section: module map, roles, run order of the SQL files)

The reset file only **deletes rows** (tables stay, since repair/booking keep using them) from `repair_tickets`, `facility_reservations`, `memorandums` (and `approval_records` via cascade), `feedback`, `push_subscriptions`, in one transaction, preceded by a commented `select count(*)` block and a note to take a backup first (`/api/cron/backup`). Also lists storage buckets whose files the user may clear by hand.

- [ ] **Step 1:** Write the file and the README section. Do **not** run the SQL.
- [ ] **Step 2:** Full verification: `npm test`, `npx tsc --noEmit`, `npx eslint src`, `npm run build`; Playwright pass of the three spec journeys (teacher confirms; officer sees the gap; teacher books a room and an officer approves) at 390px and desktop, light and dark.
- [ ] **Step 3:** Push the branch; tell the user to review the Vercel preview, run `facility_99_reset_old_data.sql` only at cutover, and say "PR แล้ว Merge" when ready. Merging `main` is the production switch.
- [ ] **Step 4:** Commit `docs: cutover SQL and README`.
