# Budget Deputy Sees Only Shared Tickets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The budget deputy sees only the repair tickets that head/staff/super_admin sent to them with a required message, and the ticket comment thread exists only on those tickets.

**Architecture:** A new table `repair_ticket_shares` (one row per shared ticket) plus a transactional RPC `share_ticket_with_budget(ticket, message)` that inserts the share row and the first comment together. The deputy's ticket SELECT policy changes from "all" to "has a share row", and the existing comment policies already follow ticket visibility, so they narrow by themselves. A separate table (not a column) keeps `repair_tickets.updated_at` untouched, which the summary page reads.

**Tech Stack:** Next.js 16 server actions, Supabase RLS/RPC, Node test runner (`npm test`).

**Spec:** `docs/superpowers/specs/2026-11-19-budget-deputy-share-design.md` (builds on `2026-11-18-budget-deputy-repair-view-design.md` and the code merged in PR 84)

## Global Constraints

- Thai UI text. No notifications outside the app. Same rules as the 2026-11-18 plan: run `npm ci` if `node_modules` is missing, read `node_modules/next/dist/docs/` before using a Next API you have not used here, tests import with relative `.ts` paths, never `@/`.
- SQL follows skill `supabase-sql-rollout`: re-runnable, check block at the end, a new table needs a `BACKUP_TABLES` entry with an `ORDER_BY` entry if it has no `id` column, and a sentence in `docs/backup.md`. The agent writes SQL but does not run it on the live database; the user decides.
- Each task ends with `npm test`, `npx tsc --noEmit`, `npx eslint src`, one commit. Branch `claude/relaxed-turing-6qpzwc`. No PR unless asked.

## Review Focus

- A ticket the deputy was never sent returns 404 by URL, and its thread, photos and reporter are unreadable to the deputy. SQL check B and C in Task 1.
- Cancelling the share hides ticket and thread from the deputy at once; sharing again brings the old thread back. SQL check D.
- Sharing a ticket leaves `repair_tickets.updated_at` unchanged. SQL check E.
- A blank or 1,001-character message, or a ticket already shared, creates neither a share row nor a comment (one transaction). SQL check F and the `cleanComment` tests already in `src/lib/ticket-comments.test.ts`.
- A closed shared ticket still shows for the deputy, in the "ปิดแล้ว" section, with its unread marker. `groupBacklog` tests in Task 2.

---

### Task 1: Database

**Files:**
- Create: `supabase/budget_deputy_03_share.sql`
- Test: `src/lib/ticket-comments.test.ts` (SQL mirror tests)

**Interfaces:**
- Produces: table `repair_ticket_shares(ticket_id uuid pk references repair_tickets on delete cascade, shared_at timestamptz default now(), shared_by uuid not null, shared_by_name text)`; function `public.share_ticket_with_budget(p_ticket uuid, p_message text) RETURNS void` (SECURITY INVOKER).

- [ ] **Step 1: Write failing tests** appended to `ticket-comments.test.ts`, reading `supabase/budget_deputy_03_share.sql` as `SQL3`: `the share SQL replaces the deputy's read-all ticket policy` (contains `DROP POLICY IF EXISTS "tickets: budget deputy read all"` and a `CREATE POLICY "tickets: budget deputy read shared"` whose text mentions `repair_ticket_shares`); `the share SQL narrows the deputy's photo policy to shared tickets` (contains `DROP POLICY IF EXISTS "repair images: budget deputy read"` and `repair_ticket_shares` after it); `the share goes in with its first comment in one function` (contains `share_ticket_with_budget` and, inside it, inserts into both `repair_ticket_shares` and `repair_ticket_comments`).
- [ ] **Step 2: Run `npm test`** — Expected: FAIL (file not found).
- [ ] **Step 3: Write `budget_deputy_03_share.sql`.** Header: run after 02, safe to rerun. Contents:
  - `CREATE TABLE IF NOT EXISTS public.repair_ticket_shares` as in Interfaces, RLS on. Policies: SELECT for `current_role_is('budget_deputy', 'staff', 'super_admin')`; INSERT for `current_role_is('staff', 'super_admin')` with `shared_by = (SELECT auth.uid())`; DELETE for `current_role_is('staff', 'super_admin')`; no UPDATE.
  - Replace `"tickets: budget deputy read all"` with `"tickets: budget deputy read shared"` on `repair_tickets` FOR SELECT: `current_role_is('budget_deputy') AND EXISTS (SELECT 1 FROM public.repair_ticket_shares s WHERE s.ticket_id = repair_tickets.id)`. The comment, reporter-profile and `unread_comment_tickets()` rules follow ticket visibility and need no change.
  - Replace `"repair images: budget deputy read"`: `bucket_id = 'repair-images' AND current_role_is('budget_deputy') AND EXISTS (SELECT 1 FROM public.repair_tickets t WHERE storage.objects.name = ANY (t.image_urls) OR storage.objects.name = ANY (t.after_image_urls))` (the subquery already sees only shared tickets under the deputy's policy).
  - `share_ticket_with_budget`: `LANGUAGE plpgsql SET search_path = ''`, inserts the share row (`shared_by` = `auth.uid()`, `shared_by_name` from `public.profiles`) then the comment `(p_ticket, auth.uid(), p_message)`; a second share of the same ticket fails with 23505 on the primary key. `REVOKE EXECUTE ... FROM PUBLIC, anon; GRANT ... TO authenticated`.
  - Check block (comments, style of file 02): A objects exist; B deputy with no share sees 0 tickets and the ticket id by URL query returns 0 rows; C deputy cannot read an unshared ticket's comments or photos; D after `DELETE FROM repair_ticket_shares` the deputy sees 0 again and after sharing again the old comments are back; E `updated_at` of the ticket is identical before and after sharing; F blank message, 1,001 characters, and a second share each raise an error and leave neither a share row nor a comment.
- [ ] **Step 4: Run `npm test`, `npx tsc --noEmit`, `npx eslint src`** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(db): share tickets with the budget deputy`.

---

### Task 2: Backlog grouping and page text

**Files:**
- Modify: `src/lib/backlog.ts`, `src/lib/backlog.test.ts`, `src/lib/nav.ts`, `src/components/backlog/backlog-view.tsx`, `src/app/(dashboard)/backlog/page.tsx`, `src/app/(dashboard)/summary/page.tsx`, `src/app/(dashboard)/tickets/[id]/page.tsx`

**Interfaces:**
- Consumes: existing `BacklogTicket`, `BacklogRow`, `BacklogGroup`.
- Produces: `groupBacklog(tickets, unreadIds, now)` now returns `{ unread: BacklogRow[]; groups: BacklogGroup[]; closed: BacklogRow[] }`. `closed` holds every row that is not open (status `completed`/`cancelled`, or `duplicate_of` set), newest `created_at` first, including those with an unread comment. Nav entry `backlog` label becomes `งานที่ขอความเห็น`.

- [ ] **Step 1: Update and add tests.** The empty case expects `{ unread: [], groups: [], closed: [] }`. Add `a closed ticket goes to the closed list, newest first, and keeps its unread flag` (two completed tickets of different age, one unread) and `an open ticket is never in the closed list`. Add to `nav.test.ts`: the deputy's second entry has label `งานที่ขอความเห็น`.
- [ ] **Step 2: Run `npm test`** — Expected: FAIL (closed missing, label differs).
- [ ] **Step 3: Implement** in `backlog.ts` (collect non-open rows into `closed` before the `continue`, sort newest first) and change the label in `nav.ts`.
- [ ] **Step 4: Texts and view.** `BacklogView` renders a native `<details>` section `ปิดแล้ว ({n})` after the building groups when `closed` is non-empty; its empty state reads `ยังไม่มีงานที่ขอความเห็น`. Page title, `h1` and subtitle (`งานซ่อมที่เจ้าหน้าที่ขอความเห็นจากท่าน แยกตามอาคาร`), the summary strip (`ดูที่งานที่ขอความเห็น`), the ticket page back link for the deputy, and the load-error name all use `งานที่ขอความเห็น`.
- [ ] **Step 5: Run `npm test`, `tsc`, `eslint`** — Expected: PASS. Commit `feat: closed section and new name for the deputy's page`.

---

### Task 3: Data and actions

**Files:**
- Create: `src/lib/data/ticket-shares.ts`
- Modify: `src/lib/data/backlog.ts`, `src/app/(dashboard)/tickets/comment-actions.ts`

**Interfaces:**
- Consumes: `cleanComment`, `canComment` (ticket-comments), `isStaffRole`, `getSession`.
- Produces: `TicketShare = { shared_at: string; shared_by_name: string | null }`; `getTicketShare(supabase: SupabaseClient, ticketId: string): Promise<TicketShare | null>`; `getSharedTicketIds(supabase: SupabaseClient): Promise<Set<string>>` (empty on error); `getBacklog(supabase: SupabaseClient): Promise<BacklogTicket[] | null>` (no second argument now); actions `shareWithDeputy(_prev: CommentResult, formData: FormData): Promise<CommentResult>` (fields `ticket_id`, `body`) and `unshareFromDeputy(formData: FormData): Promise<void>` (field `ticket_id`), both in `comment-actions.ts`.

- [ ] **Step 1: `getBacklog`.** Select the same columns plus an inner embed `repair_ticket_shares!inner(ticket_id)` (so even the administrator sees only shared tickets), no status filter, `.limit(500)`; update its doc comment (the unread-or-open rule is gone). Callers: only `backlog/page.tsx`; drop the `unreadIds` argument there.
- [ ] **Step 2: `ticket-shares.ts`** with the two readers (`select("shared_at, shared_by_name").eq("ticket_id", ...).maybeSingle()` and `select("ticket_id")`).
- [ ] **Step 3: `shareWithDeputy`.** Session required, `isStaffRole(role)` else `{ ok: false, message: "ไม่มีสิทธิ์ส่งให้รองงบประมาณ" }`; UUID check; `cleanComment` null → `ข้อความถึงรองต้องมี 1-1,000 ตัวอักษร`; `supabase.rpc("share_ticket_with_budget", { p_ticket, p_message })`; error code `23505` → `ใบนี้ส่งให้รองแล้ว`; other errors log the code only and return `ส่งไม่สำเร็จ ลองอีกครั้ง`; success `revalidatePath(`/tickets/${id}`)` and `{ ok: true, message: "ส่งให้รองงบประมาณแล้ว" }`.
- [ ] **Step 4: `unshareFromDeputy`.** Same role and UUID checks (return silently on failure); `delete().eq("ticket_id", id)`; revalidate the ticket path.
- [ ] **Step 5: Run `tsc`, `eslint`, `npm test`.** Expected: clean. Commit `feat: share and unshare actions, backlog reads shared tickets`.

---

### Task 4: Ticket page, list marker

**Files:**
- Create: `src/components/tickets/share-panel.tsx`
- Modify: `src/app/(dashboard)/tickets/[id]/page.tsx`, `src/components/tickets/ticket-comments.tsx`, `src/components/tickets/ticket-table.tsx`, `src/app/(dashboard)/tickets/page.tsx`

**Interfaces:**
- Consumes: Task 3 readers and actions.
- Produces: `SharePanel({ ticketId, share }: { ticketId: string; share: TicketShare | null })` (client; unshared: textarea `name="body"` with `maxLength={COMMENT_MAX}` and button `ขอความเห็นรองงบประมาณ`; shared: text `ส่งให้รองเมื่อ {formatDateTh} โดย {name}` and a form button `ยกเลิกการส่ง`); `TicketComments` gains prop `canPost: boolean` (hides the form when false); `SharedMark()` exported from `ticket-table.tsx` (pill `ส่งรองแล้ว`); `TicketTable` gains `sharedIds?: ReadonlySet<string>`.

- [ ] **Step 1: `SharePanel`** using `useActionState(shareWithDeputy, null)` with the status message style of `comment-form.tsx`; place it in the staff `<aside>` below the manage form.
- [ ] **Step 2: Detail page.** For staff roles load `getTicketShare`; the deputy's page has no panel. `shared = isDeputy || share !== null`. Comments are loaded when `canComment(role)`; render the thread (and `MarkRead`) when `comments` is non-null and (`shared` or `comments.length > 0`); pass `canPost={shared}`.
- [ ] **Step 3: List marker.** `tickets/page.tsx` loads `getSharedTicketIds` for staff beside `unreadIds`; `TicketTable` shows `<SharedMark />` next to `NewCommentMark` in both row layouts when the id is in `sharedIds`.
- [ ] **Step 4: Run `tsc`, `eslint`, `npm test`, `npm run build`.** Expected: clean. Commit `feat: send a ticket to the deputy from the ticket page`.

---

### Task 5: Backup and docs

**Files:**
- Modify: `src/lib/backup.ts`, `docs/backup.md`

- [ ] **Step 1:** Add `"repair_ticket_shares"` after `"repair_ticket_comments"` in `BACKUP_TABLES` and `repair_ticket_shares: ["ticket_id"]` to `ORDER_BY` (it has no `id` column).
- [ ] **Step 2:** In `docs/backup.md` name `supabase/budget_deputy_03_share.sql`, say it must run before the code that reads the table deploys (or right after) and that the next backup fails if it has not.
- [ ] **Step 3: Run `npm test`, `tsc`, `eslint`, `npm run build`.** Expected: all pass. Commit `chore: back up ticket shares`.
