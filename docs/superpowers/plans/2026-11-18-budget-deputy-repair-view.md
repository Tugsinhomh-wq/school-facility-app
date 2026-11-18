# Budget Deputy Repair View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a new role `budget_deputy` a read-only "งานซ่อมค้าง" page (grouped by building) and a comment thread on each repair ticket shared with head/staff/super_admin, with "new comment" markers instead of outside notifications.

**Architecture:** One new enum value, two small tables (`repair_ticket_comments`, `repair_ticket_reads`) and one invoker RPC (`unread_comment_tickets`), all guarded by RLS that reuses `current_role_is`. The deputy reads tickets through a new SELECT policy, so the existing ticket detail page is reused in a deputy mode. A pure `groupBacklog` function builds the page; a pure `isExecutive` helper replaces the scattered `role === "executive"` checks.

**Tech Stack:** Next.js 16 App Router + server actions, Supabase (RLS, RPC), Tailwind/shadcn on base-ui, Node built-in test runner (`npm test` runs `src/lib/**/*.test.ts` with `--experimental-strip-types`).

**Spec:** `docs/superpowers/specs/2026-11-18-budget-deputy-repair-view-design.md`

## Global Constraints

- All user-visible text in Thai; times via `src/lib/time.ts` / `formatDateTh` (Bangkok), never the server's local day.
- No notifications outside the app (no LINE/email/push). New-comment markers only.
- AGENTS.md: this Next.js has breaking changes. Run `npm ci` first and read the relevant page in `node_modules/next/dist/docs/` (server actions, `revalidatePath`, `redirect`) before writing a page or action.
- Test files import with relative paths and `.ts` extensions, never the `@/` alias; code that imports `next/headers` (`src/lib/data/session.ts`) cannot load under `npm test`. Keep role lists in pure modules and let a test compare them with the SQL (skill `adding-user-role`).
- SQL follows skill `supabase-sql-rollout`: additive, re-runnable, the enum value in its own file. The agent writes SQL and check queries but does not run them; the user runs them in the SQL editor in file order and reports back.
- Every task ends with `npm test`, `npx tsc --noEmit`, `npx eslint src` clean and one commit (skill `school-facility-app-verify`). Branch `claude/relaxed-turing-6qpzwc`. No pull request unless the user asks.

## Review Focus

- A trashed ticket opened by URL must 404 for the deputy (the RESTRICTIVE trash policy still applies). Pinned by SQL check C in Task 1.
- A comment inserted with someone else's `author_id`, or by `user`/`room_staff`/`executive`, is refused by RLS. SQL checks D and E in Task 1.
- Whitespace-only or 1,001-character comment is refused in the action and by the table CHECK. `cleanComment` tests in Task 3 and SQL check F.
- Ticket with no room and no `location_detail`, or no building, still gets a row under a fallback label. `groupBacklog` tests in Task 4.
- A user's own comment never counts as unread for them, and a merged duplicate never appears in the backlog. SQL check G in Task 1 and the `getBacklog` filter in Task 7.

---

### Task 1: Database

**Files:**
- Create: `supabase/budget_deputy_01_role.sql`, `supabase/budget_deputy_02_comments.sql`
- Modify: `supabase/executive_summary.sql` (role list in the guard and the header comment)

**Interfaces:**
- Produces: enum value `budget_deputy`; tables `repair_ticket_comments(id uuid pk, ticket_id uuid, author_id uuid, author_name text, body text, created_at timestamptz)` and `repair_ticket_reads(ticket_id uuid, user_id uuid, last_read_at timestamptz, pk (ticket_id, user_id))`; function `public.unread_comment_tickets() RETURNS SETOF uuid`.

- [ ] **Step 1: `budget_deputy_01_role.sql`** — header comment (run alone first, like `executive_role.sql`) and `ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'budget_deputy';`.

- [ ] **Step 2: `budget_deputy_02_comments.sql`** — header says "run after 01, as a separate run; safe to run again". Every statement is `DROP POLICY IF EXISTS` + `CREATE`, `CREATE TABLE IF NOT EXISTS`, or `CREATE OR REPLACE`. Contents:
  - Read access for the deputy, same shape as `room_staff_role.sql`:
    - `repair_tickets` SELECT `USING (public.current_role_is('budget_deputy'))`;
    - `storage.objects` SELECT `USING (bucket_id = 'repair-images' AND public.current_role_is('budget_deputy'))`;
    - `profiles` SELECT `USING (public.current_role_is('budget_deputy') AND EXISTS (SELECT 1 FROM public.repair_tickets t WHERE t.reporter_id = profiles.id))` (reporter names only).
  - `repair_ticket_comments`: `ticket_id` references `repair_tickets(id) ON DELETE CASCADE`; `author_id uuid NOT NULL` with no foreign key (same reason as `assignee_id` in `ticket_history.sql`); `author_name text` is a copy of the name at post time; `body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000)`; `created_at timestamptz NOT NULL DEFAULT clock_timestamp()`; index on `(ticket_id, created_at)`; RLS on. Policies: SELECT and INSERT both require `public.current_role_is('budget_deputy', 'staff', 'super_admin')` AND `EXISTS (SELECT 1 FROM public.repair_tickets t WHERE t.id = ticket_id)`; INSERT also requires `author_id = (SELECT auth.uid())`; DELETE requires `public.current_role_is('super_admin')`; no UPDATE policy.
  - `repair_ticket_reads`: policy FOR ALL `USING`/`WITH CHECK (user_id = (SELECT auth.uid()))`.
  - `unread_comment_tickets()`: `LANGUAGE sql STABLE` (SECURITY INVOKER so RLS filters), returns `SELECT DISTINCT c.ticket_id FROM repair_ticket_comments c LEFT JOIN repair_ticket_reads r ON r.ticket_id = c.ticket_id AND r.user_id = (SELECT auth.uid()) WHERE c.author_id <> (SELECT auth.uid()) AND c.created_at > COALESCE(r.last_read_at, '-infinity')`; `REVOKE EXECUTE ... FROM PUBLIC, anon; GRANT ... TO authenticated`.
  - A check block of commented queries, each with its expected result (style of `ticket_history.sql`):
    - A: tables, function and policies exist.
    - B: as the deputy, `select count(*) from repair_tickets` equals the count of non-trashed tickets.
    - C: as the deputy, selecting a trashed ticket returns 0 rows.
    - D: as a `user`, `room_staff` and `executive`, selecting and inserting into `repair_ticket_comments` returns 0 rows / is refused.
    - E: as the deputy, inserting with another user's `author_id` is refused.
    - F: inserting a whitespace-only body and a 1,001-character body fails the CHECK.
    - G: after the deputy inserts a comment, `unread_comment_tickets()` run as the deputy omits that ticket and run as `staff` includes it.

- [ ] **Step 3: `executive_summary.sql`** — change the guard to `public.current_role_is('executive', 'budget_deputy', 'super_admin', 'staff')`, update the header comment, and note in the file that it must be run again after `budget_deputy_01_role.sql`.

- [ ] **Step 4: Run `npm test`** (SQL is not covered by it; expected PASS unchanged), then commit `feat(db): budget_deputy role, ticket comments and read markers`.

---

### Task 2: Role plumbing

**Files:**
- Create: `src/lib/exec-roles.ts`, `src/lib/exec-roles.test.ts`
- Modify: `src/types/database.ts` (`UserRole`), `src/lib/ticket-meta.ts` (`ROLE_LABEL`), `src/lib/nav.ts`, `src/lib/modules.ts`, `src/lib/data/session.ts`, `src/components/layout/module-icons.ts`, `src/components/layout/app-sidebar.tsx`, `src/components/layout/mobile-nav.tsx`, `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/users/actions.ts`, `src/components/users/user-edit-form.tsx`, `src/components/users/user-row.tsx`, `src/lib/data/cleaning-setup.ts`, `src/app/(dashboard)/cleaning/manage/actions.ts`, `src/app/(dashboard)/control/actions.ts`
- Test: `src/lib/nav.test.ts`, `src/lib/modules.test.ts`, `src/lib/control/access.test.ts`

**Interfaces:**
- Produces: `isExecutive(role?: UserRole | null): boolean` (true for `executive` and `budget_deputy`); `navGroups(role: UserRole | null, badges?: { backlog?: number }): NavGroup[]` where `NavEntry` gains `badge?: number`; `guardExecutive(allow?: UserRole): Promise<void>` (redirects an executive-type role to `/summary` unless it equals `allow`); `canSeeBacklog(role?: UserRole | null): boolean` (`budget_deputy` or `super_admin`); `canSeeSummary` also admits `budget_deputy`. Nav entry id `backlog`, label `งานซ่อมค้าง`, href `/backlog`, icon `ClipboardList`.

- [ ] **Step 1: Write failing tests.**
  - `exec-roles.test.ts`: `isExecutive` is true for `executive` and `budget_deputy`, false for every other role in `ALL_ROLES` and for `null`/`undefined`.
  - `nav.test.ts`: `hrefs("budget_deputy")` equals `["/summary", "/backlog"]`; `hrefs("executive")` still `["/summary"]`; no other role has `/backlog`; `navGroups("budget_deputy", { backlog: 3 })` gives the backlog entry `badge === 3`, and with `{ backlog: 0 }` or no badges `badge` is undefined.
  - `modules.test.ts`: `visibleModules("budget_deputy")` is `[]`.
  - `access.test.ts`: add `budget_deputy: true` to `ROLE_MAP` (makes `tsc` fail until `UserRole` has it).

- [ ] **Step 2: Run `npm test`** — Expected: FAIL (module not found / assertions).

- [ ] **Step 3: Implement.** Add `"budget_deputy"` to `UserRole` and `ROLE_LABEL` (`รองผู้อำนวยการฝ่ายงบประมาณ`). Implement the Interfaces above. Replace every `role === "executive"` that means "summary-only user" with `isExecutive(...)`: `visibleModules`, `navGroups`, `guardExecutive`, `layout.tsx` (hide the report button), `mobile-nav.tsx`, `users/actions.ts` and `user-row.tsx` (advisor rooms blocked), `cleaning/manage/actions.ts` (advisor refused), `control/actions.ts` (read-only message). In `cleaning-setup.ts` replace `.neq("role", "executive")` with `.not("role", "in", "(executive,budget_deputy)")`. Add `budget_deputy` to `ROLES` in `users/actions.ts`, `ROLE_ORDER` in `user-edit-form.tsx` (before `super_admin`) and `ROLE_ICON` in `user-row.tsx` (`Eye`). `AppSidebar` and `MobileNav` take `badges?: { backlog?: number }`, pass it to `navGroups`, and render a small count pill next to an entry whose `badge` is set; `MobileNav` shows three tabs (summary, backlog, account) for the deputy with `grid-cols-3` and keeps two for `executive`. `layout.tsx` passes `badges={{ backlog: n }}` where `n` comes from a prop-free call added in Task 7 (use `undefined` until then).

- [ ] **Step 4: Run `npm test`, `npx tsc --noEmit`, `npx eslint src`** — Expected: PASS, no errors.

- [ ] **Step 5: Commit** `feat: budget_deputy role in navigation and access checks`.

---

### Task 3: Comment rules

**Files:**
- Create: `src/lib/ticket-comments.ts`
- Test: `src/lib/ticket-comments.test.ts`

**Interfaces:**
- Produces: `COMMENT_ROLES: UserRole[]` = `["budget_deputy", "head", "staff", "super_admin"]`; `COMMENT_MAX = 1000`; `canComment(role?: UserRole | null): boolean`; `cleanComment(raw: unknown): string | null` (trimmed string of 1 to `COMMENT_MAX` characters, else `null`).

- [ ] **Step 1: Write failing tests.**
  - `canComment` is true exactly for `COMMENT_ROLES` across all roles and false for `null`.
  - `cleanComment("  สวัสดี  ")` is `"สวัสดี"`; `""`, `"   "`, `null`, `42` give `null`; a 1000-character string passes; a 1001-character string gives `null`.
  - The SQL in `supabase/budget_deputy_02_comments.sql` contains `current_role_is('budget_deputy', 'staff', 'super_admin')`, and `COMMENT_ROLES` minus `head` equals that list (head is covered by `current_role_is`'s staff rule).

- [ ] **Step 2: Run `npm test`** — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** the three exports in `src/lib/ticket-comments.ts` (no imports other than the `UserRole` type).

- [ ] **Step 4: Run `npm test`** — Expected: PASS.

- [ ] **Step 5: Commit** `feat: ticket comment rules`.

---

### Task 4: Backlog grouping

**Files:**
- Create: `src/lib/backlog.ts`
- Test: `src/lib/backlog.test.ts`

**Interfaces:**
- Produces:
  - `BacklogTicket = { id: string; ticket_number: string; title: string; urgency: UrgencyLevel; status: TicketStatus; created_at: string; location_detail: string | null; building: { name: string } | null; room: { room_number: string; name: string | null } | null }`
  - `BacklogRow = { id: string; ticketNumber: string; place: string; title: string; urgency: UrgencyLevel; status: TicketStatus; ageDays: number; unread: boolean }`
  - `BacklogGroup = { building: string; total: number; urgent: number; rows: BacklogRow[] }`
  - `groupBacklog(tickets: BacklogTicket[], unreadIds: ReadonlySet<string>, now: number): { unread: BacklogRow[]; groups: BacklogGroup[] }`

Rules: `place` is `room.name ?? room.room_number ?? location_detail ?? "ไม่ระบุจุด"`; building name falls back to `"ไม่ระบุอาคาร"`; `urgent` counts `high` and `emergency`; `ageDays = floor((now - created_at) / 86_400_000)`; groups sorted by building name with `localeCompare(..., "th")`; rows sorted by `place` (`localeCompare(..., "th", { numeric: true })`) then `created_at`; `unread` lists the unread rows (also present in their building group, so totals stay true), most recent first is not required, same order as groups.

- [ ] **Step 1: Write failing tests** (name each after its rule): groups by building with correct `total`; `urgent` counts high+emergency only; rows within a building sort numerically by place (`ห้อง 2` before `ห้อง 10`); a ticket with no room and no location detail gets `"ไม่ระบุจุด"`; a ticket with no building lands in `"ไม่ระบุอาคาร"`; an unread id puts the row in `unread` and keeps it in its group with `unread: true`; `ageDays` is 0 for a ticket created an hour ago and 3 for one created 3.5 days ago.

- [ ] **Step 2: Run `npm test`** — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `groupBacklog` and the types in `src/lib/backlog.ts` (pure, no imports except types).

- [ ] **Step 4: Run `npm test`** — Expected: PASS.

- [ ] **Step 5: Commit** `feat: group open repairs by building for the backlog page`.

---

### Task 5: Comment data and actions

**Files:**
- Create: `src/lib/data/ticket-comments.ts`, `src/app/(dashboard)/tickets/comment-actions.ts`

**Interfaces:**
- Consumes: `canComment`, `cleanComment` (Task 3); `getSession` from `src/lib/data/session.ts`.
- Produces:
  - `TicketComment = { id: string; author_name: string | null; body: string; created_at: string }`
  - `getTicketComments(supabase: SupabaseClient, ticketId: string): Promise<TicketComment[]>` (oldest first; `[]` on error)
  - `getUnreadTicketIds(supabase: SupabaseClient): Promise<Set<string>>` (calls rpc `unread_comment_tickets`; empty set on error)
  - `CommentResult = { ok: boolean; message: string } | null`
  - `postComment(_prev: CommentResult, formData: FormData): Promise<CommentResult>` (fields `ticket_id`, `body`)
  - `markTicketRead(ticketId: string): Promise<void>`

- [ ] **Step 1: Implement the two readers** in `ticket-comments.ts` using `supabase.from("repair_ticket_comments").select("id, author_name, body, created_at").eq("ticket_id", ticketId).order("created_at")` and `supabase.rpc("unread_comment_tickets")`.

- [ ] **Step 2: Implement `postComment`.** Session required; refuse when `!canComment(role)`, when `ticket_id` fails the `UUID` regex used in `tickets/actions.ts`, or when `cleanComment` is `null` (message `ความเห็นต้องมี 1-1,000 ตัวอักษร`). Insert `{ ticket_id, author_id: userId, author_name: viewer.name, body }`; on error log the code only and return `{ ok: false, message: "ส่งความเห็นไม่สำเร็จ ลองอีกครั้ง" }`; on success `revalidatePath(`/tickets/${id}`)` and return `{ ok: true, message: "ส่งความเห็นแล้ว" }`.

- [ ] **Step 3: Implement `markTicketRead`.** No-op unless a session exists and `canComment(role)` and the id matches the UUID regex; `upsert({ ticket_id, user_id: userId, last_read_at: new Date().toISOString() }, { onConflict: "ticket_id,user_id" })`; then `revalidatePath("/", "layout")` so the menu badge refreshes. `// shortcut: a comment that lands between page load and this call is marked read unseen; fine for a low-traffic thread.`

- [ ] **Step 4: Run `npx tsc --noEmit`, `npx eslint src`** — Expected: clean. Commit `feat: ticket comment reads, post and mark-read`.

---

### Task 6: Ticket detail in deputy mode, with the thread

**Files:**
- Create: `src/components/tickets/ticket-comments.tsx`, `src/components/tickets/comment-form.tsx`
- Modify: `src/app/(dashboard)/tickets/[id]/page.tsx`

**Interfaces:**
- Consumes: `getTicketComments`, `TicketComment` (Task 5); `postComment`, `markTicketRead`; `canComment`, `COMMENT_MAX` (Task 3); `guardExecutive(allow)` (Task 2).
- Produces: `TicketComments({ ticketId, comments }: { ticketId: string; comments: TicketComment[] })` (server component: heading `ความเห็น`, list with author name and `formatDateTh` time, empty text `ยังไม่มีความเห็น`, then the form); `CommentForm({ ticketId }: { ticketId: string })` and `MarkRead({ ticketId }: { ticketId: string })` (client components in `comment-form.tsx`).

- [ ] **Step 1: `comment-form.tsx`.** `"use client"`. `CommentForm` uses `useActionState(postComment, null)`, a `textarea name="body" maxLength={COMMENT_MAX} required`, hidden `ticket_id`, a submit button `ส่งความเห็น` (`h-11`), and shows the result message with `role="status"`; clear the textarea after `ok`. `MarkRead` calls `markTicketRead(ticketId)` in a `useEffect` keyed on `ticketId` and renders nothing.

- [ ] **Step 2: `ticket-comments.tsx`** as described in Interfaces, matching the spacing and `Field`/section style of the detail page.

- [ ] **Step 3: Edit the detail page.** `await guardExecutive("budget_deputy")`; `const isDeputy = viewer?.role === "budget_deputy"`; show the reporter field when `isStaff || isDeputy`; the back link goes to `/backlog` (label `งานซ่อมค้าง`) when `isDeputy`, else `/tickets`; when `canComment(viewer?.role)` fetch comments with `getTicketComments` (needs the server client from `getSession()`), render `<MarkRead>` and `<TicketComments>` after `<TicketTimeline>`. The management `<aside>` stays `isStaff` only, so the deputy sees no controls.

- [ ] **Step 4: Run `npx tsc --noEmit`, `npx eslint src`, `npm test`** — Expected: clean. Commit `feat: comment thread and deputy mode on the ticket page`.

---

### Task 7: Backlog page, menu badge, summary banner

**Files:**
- Create: `src/lib/data/backlog.ts`, `src/components/backlog/backlog-view.tsx`, `src/app/(dashboard)/backlog/page.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/summary/page.tsx`

**Interfaces:**
- Consumes: `groupBacklog`, `BacklogTicket` (Task 4); `getUnreadTicketIds` (Task 5); `canSeeBacklog` (Task 2); `STATUS_LABEL`/`URGENCY_LABEL` from `src/lib/ticket-meta.ts`; `StatusPill`/`UrgencyMark` from `src/components/tickets/status-mark.tsx`.
- Produces: `getBacklog(supabase: SupabaseClient): Promise<BacklogTicket[] | null>` (`null` on error).

- [ ] **Step 1: `getBacklog`.** `repair_tickets` select `id, ticket_number, title, urgency, status, created_at, location_detail, building:buildings(name), room:rooms(room_number, name)`, `.in("status", ["pending", "in_progress"]).is("duplicate_of", null).limit(500)`. `// shortcut: 500 open tickets is far above this school's backlog, no paging.`

- [ ] **Step 2: `BacklogView`** (server component, props `{ result: ReturnType<typeof groupBacklog> }`). Top section `ความเห็นใหม่ (N)` only when `unread` is non-empty. Then one native `<details open>` per building: `summary` shows building name, `ค้าง {total} ใบ` and, when `urgent > 0`, a red `เร่งด่วน {urgent}` badge. Each row is a `Link` to `/tickets/{id}` (min height 44px for touch) showing place, title, `UrgencyMark`, `StatusPill`, `ค้าง {ageDays} วัน` and a `ความเห็นใหม่` pill when `unread`. Empty state `ไม่มีงานซ่อมค้าง`.

- [ ] **Step 3: `backlog/page.tsx`.** `force-dynamic`, metadata title `งานซ่อมค้าง | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก`. No session → `redirect("/login")`; `!canSeeBacklog(role)` → `redirect("/")`. Load `getBacklog` and `getUnreadTicketIds` in parallel; `null` renders `<LoadError what="งานซ่อมค้าง" retryHref="/backlog" />`; else `groupBacklog(tickets, unreadIds, Date.now())` into `BacklogView`. Heading `งานซ่อมค้าง` in the style of the other pages.

- [ ] **Step 4: Menu badge.** In `layout.tsx`, when `viewer?.role === "budget_deputy"` and a session exists, `const backlog = (await getUnreadTicketIds(session.supabase)).size` and pass `badges={{ backlog }}` to `AppSidebar` and `MobileNav` (replacing the placeholder from Task 2).

- [ ] **Step 5: Summary banner.** In `summary/page.tsx`, for `budget_deputy` compute the same unread count; when it is above 0 render above `SummaryView` a `Link` to `/backlog` reading `{n} ใบมีความเห็นใหม่` (role="status", bordered strip).

- [ ] **Step 6: Run `npx tsc --noEmit`, `npx eslint src`, `npm test`.** Expected: clean. Commit `feat: backlog page for the budget deputy`.

---

### Task 8: Staff-side markers

**Files:**
- Modify: `src/components/tickets/ticket-table.tsx`, `src/app/(dashboard)/tickets/page.tsx`, `src/components/dashboard/home-actions.tsx`, `src/app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: `getUnreadTicketIds` (Task 5); `getSession`, `isStaffRole`.
- Produces: `NewCommentMark()` exported from `ticket-table.tsx` (pill `ความเห็นใหม่`); `TicketTable` gains prop `unreadIds?: ReadonlySet<string>`; `HomeData` gains `unreadComments: number`.

- [ ] **Step 1: Ticket list.** In `tickets/page.tsx`, when `isStaff`, `const unreadIds = await getUnreadTicketIds((await getSession())!.supabase)` and pass it to `TicketTable`. In `ticket-table.tsx`, show `<NewCommentMark />` beside `DuplicateNote` in the mobile row and under the title in the desktop table row when `unreadIds?.has(t.id)`.

- [ ] **Step 2: Home card.** In `(dashboard)/page.tsx`, for `isStaffRole(viewer?.role)` get the unread count the same way, else `0`, and add it to the `buildRows` argument. In `buildRows`, for staff viewers when `unreadComments > 0` push `{ key: "ticket-comments", icon: MessageSquare, title: `ใบแจ้งซ่อมมีความเห็นใหม่ ${n} ใบ`, href: "/tickets?status=open", todo: n }` after the repair rows. `// shortcut: links to the open queue, where the rows carry the marker; no unread-only filter.`

- [ ] **Step 3: Run `npx tsc --noEmit`, `npx eslint src`, `npm test`.** Expected: clean. Commit `feat: new-comment markers for staff`.

---

### Task 9: Backup, docs, final verification

**Files:**
- Modify: `src/lib/backup.ts` (`BACKUP_TABLES`, `ORDER_BY`), `docs/backup.md`

- [ ] **Step 1: Backup.** Add `"repair_ticket_comments"` after `"repair_ticket_events"` in `BACKUP_TABLES`. `repair_ticket_reads` is a read marker and is not backed up. Add the comments table to the table list in `docs/backup.md`.

- [ ] **Step 2: Full check.** Run `npm test`, `npx tsc --noEmit`, `npx eslint src`, then `npm run build`. Expected: all pass.

- [ ] **Step 3: Hand off to the user** with the order to run in the SQL editor: `budget_deputy_01_role.sql` alone, then `budget_deputy_02_comments.sql`, then `executive_summary.sql`, then check queries A to G, and set the deputy's role in the Users page. Ask them to report any check that does not match before merging.

- [ ] **Step 4: Commit** `chore: back up ticket comments`.
