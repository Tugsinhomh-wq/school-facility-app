# Cross-building combined repair memo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff combine open repair tickets from different buildings into one memo, merging same-kind tickets into a single numbered item.

**Architecture:** Drop the one-building rule in the picker (`combine.ts`), the server action and the SQL function. Staff pick an optional "group" per ticked ticket; the group exists only in the form post and is used by the pure `draftFromTickets` to build items. Nothing about groups is stored; `memo_tickets.position` follows item order so photo attachments stay aligned with the items.

**Tech Stack:** Next.js (read `node_modules/next/dist/docs/` before touching app code, per AGENTS.md), TypeScript, Supabase SQL, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-25-cross-building-combined-memo-design.md`

## Global Constraints

- Thai UI copy; touch targets at least 44px (`h-11` / `size-11` as in `candidate-list.tsx`).
- Still 2–20 tickets per memo (`COMBINE_MIN`, `COMBINE_MAX` count tickets, not items).
- Item text must not wrap the ticket number in parentheses: keep `เลขที่งาน {number} แจ้งเมื่อ {date}` (existing test, LibreOffice line-break issue).
- No cost text (`บาท`, `ค่าใช้จ่าย`) in the draft.
- Groups are not persisted; no new table or column.
- Follow skills `supabase-sql-rollout` (SQL) and `school-facility-app-verify` (npm test, eslint, tsc).

## Review Focus

- A group value that is garbage (`"0"`, `"10"`, `"abc"`, empty) → ticket stays its own item, never an error.
- A `group_<id>` key for an id not in the submitted ticket list is ignored.
- A group with one ticket renders exactly like an ungrouped item (no "จำนวน 1 จุด").
- Tickets with no building in a cross-building mix → no `undefined`/`null` in the text.
- Tickets with the same group in the same building still work.
- `memo_tickets.position` follows item order, not created-at order (photo attachment order).

---

### Task 1: Picker rules and group parsing

**Files:**
- Modify: `src/lib/memo/combine.ts`
- Test: `src/lib/memo/combine.test.ts`

**Interfaces:**
- Produces: `GROUP_MAX = 9`; `groupFieldName(ticketId: string): string` → `` `group_${ticketId}` ``; `parseGroups(ids: string[], read: (name: string) => unknown): Record<string, number>` — only ids whose field is an integer string `"1"`..`"9"` appear in the result. `selectableTicket` is deleted.

- [ ] **Step 1: Update tests.** Remove the `selectableTicket` test and its import. Add tests: `parseGroups` keeps `"1"` and `"9"`; drops `"0"`, `"10"`, `"abc"`, `""`, `null`, a `File`; ignores fields for ids not in `ids` (read is only called with `groupFieldName(id)` for listed ids); result for no groups is `{}`.
- [ ] **Step 2: Run** `npm test` — Expected: FAIL (`parseGroups` not exported).
- [ ] **Step 3: Implement** in `combine.ts`; delete `selectableTicket`; update the file's header comment (any building, 2–20 tickets).
- [ ] **Step 4: Run** `npm test` — Expected: combine tests PASS (other files may fail until Task 4 removes the `selectableTicket` import in `candidate-list.tsx`; that is type-level only, node tests do not import it).
- [ ] **Step 5: Commit** `feat: combine picker no longer limited to one building; parse group fields`

### Task 2: Draft text with groups and several buildings

**Files:**
- Modify: `src/lib/memo/draft.ts` (`draftFromTickets`, lines ~40–64)
- Test: `src/lib/memo/draft.test.ts`

**Interfaces:**
- Consumes: `parseGroups` result shape (`Record<string, number>`, ticket id → group number).
- Produces: `draftFromTickets(tickets: TicketRow[], groups: Record<string, number> = {})` returning `{ subject, recipient, body_content, proposal, orderedIds: string[] }`. `orderedIds` = ticket ids in item order (each group's tickets contiguous, oldest first within a group; items ordered by their first ticket's `created_at`).

- [ ] **Step 1: Write failing tests** (keep all existing tests passing unchanged; `draftFromTickets([t1,t2,t3])` with no groups must behave exactly as before). Add, using `ticket()` with `building: { name: "อาคาร 2" }` etc.:
  - `groups {a:1, b:1}` for two HDMI tickets in อาคาร 1 / อาคาร 2 plus one ungrouped → body has 3 lines + opening... i.e. lines = opening, `1. สาย HDMI เสีย จำนวน 2 จุด ได้แก่ …`, `2. …`, total; item 1 contains both place strings and both ticket numbers; total line `รวมทั้งสิ้น 3 รายการ`.
  - group with a single ticket renders like an ungrouped item: no `จำนวน`.
  - two buildings → subject `ขออนุมัติซ่อมแซมอาคารสถานที่ จำนวน N รายการ` and the opening contains both building names; one building → subject unchanged from today.
  - `orderedIds` for groups `{1:[t1,t3], t2 ungrouped}` where created order t1<t2<t3 → `[t1,t3,t2]`... precisely: items ordered by first ticket → group(t1,t3) then t2.
  - no building on a ticket → no `undefined`/`null`; ungrouped input array not reordered.
- [ ] **Step 2: Run** `npm test` — Expected: new tests FAIL.
- [ ] **Step 3: Implement.** Sort by `created_at`; bucket by group number (ungrouped tickets are singleton buckets); order buckets by first member. Multi-ticket item: `{i}. {first ticket title} จำนวน {K} จุด ได้แก่ {place} เลขที่งาน {no} แจ้งเมื่อ {date}[ {technician_notes}]` joined by `; `. Single-ticket item: current text unchanged. Distinct non-empty building names: 1 → current subject/opening; ≥2 → generic subject and opening naming them joined with `, `; 0 → `บริเวณโรงเรียน`. Total line stays ticket count.
- [ ] **Step 4: Run** `npm test` — Expected: all PASS.
- [ ] **Step 5: Commit** `feat: draft combined memo with grouped items across buildings`

### Task 3: SQL — allow several buildings, keep item order

**Files:**
- Modify: `supabase/memo_tickets.sql` (function `create_combined_repair_memo`, check block at bottom)

**Interfaces:**
- Produces: same signature `create_combined_repair_memo(UUID[], TEXT, TEXT, TEXT, TEXT) RETURNS UUID`; no `mixed_buildings` error; `memo_tickets.position` = 1-based order of first appearance in `p_ticket_ids` (not created-at order).

- [ ] **Step 1: Edit** — remove `building_n` and its check; build `ids` while preserving array order (`unnest ... WITH ORDINALITY`, distinct on id keeping the first ordinal); insert `memo_tickets` with `position = row_number() OVER (ORDER BY ordinal)`. Keep `CREATE OR REPLACE` so the file stays re-runnable, and keep the REVOKE/GRANT lines.
- [ ] **Step 2: Update the check block comments:** case 2 becomes "รวมต่างอาคาร → สำเร็จ"; add a case that `select * from memo_tickets where memo_id=… order by position` follows the order passed in, e.g. `array['B1','A1']` → B1 position 1.
- [ ] **Step 3: Review the SQL by reading** (no Supabase here). Follow `supabase-sql-rollout`.
- [ ] **Step 4: Commit** `feat: allow combined repair memos across buildings`

### Task 4: Server action and picker UI

**Files:**
- Modify: `src/app/(dashboard)/memos/actions.ts` (`COMBINE_ERROR`, `createCombinedMemo`)
- Modify: `src/components/memos/candidate-list.tsx`

**Interfaces:**
- Consumes: `parseGroups`, `groupFieldName`, `GROUP_MAX` (Task 1); `draftFromTickets(tickets, groups)` and `draft.orderedIds` (Task 2); the RPC from Task 3.

- [ ] **Step 1: Action.** Delete `mixed_buildings` from `COMBINE_ERROR`; change `count_range` text to `เลือกงาน 2–20 งานก่อน`; compute `groups = parseGroups(ids, (n) => formData.get(n))`; call `draftFromTickets(tickets, groups)`; pass `p_ticket_ids: draft.orderedIds`; update the doc comment (any building).
- [ ] **Step 2: UI.** In `CandidateList`: remove `selectableTicket`, `first`/`buildingId` logic and the "ต่างอาคาร…" message; all checkboxes enabled; status line `เลือกแล้ว {count} งาน · {M} อาคาร` (M = distinct `buildingId` among live picks) plus the existing too-few/too-many hints. For each ticked row render a `<select name={groupFieldName(t.id)} form="combine-form" className="h-11 …">` with default option value `""` label `เป็นข้อของตัวเอง` and options `1..GROUP_MAX` labelled `รวมในกลุ่ม {n}`, with an `aria-label` naming the ticket; add a one-line hint under the status bar explaining that tickets in the same group become one item. Unticked rows render no select.
- [ ] **Step 3: Verify** (`school-facility-app-verify`): `npm test`, `npx eslint` on changed files, `npx tsc --noEmit` — Expected: no new errors (the known `LayoutProps` error in `layout.tsx` is pre-existing). If a demo mode exists, run the app, open `/memos`, tick tickets of two buildings, set one group, and confirm the picker enables all rows and the form posts; say plainly what was and was not exercised.
- [ ] **Step 4: Commit** `feat: pick tickets across buildings and group them into one memo item`

### Task 5: Spec note

**Files:**
- Modify: `docs/superpowers/specs/2026-11-25-cross-building-combined-memo-design.md`

- [ ] **Step 1:** Add to section 4 (SQL) a line: `memo_tickets.position` follows the order of items in the draft so photo attachments match item numbers; change status to approved.
- [ ] **Step 2: Commit** `docs: record item-order rule and approval in combined memo spec`

---

## Self-review

- Spec coverage: picker/server/SQL unlock → Tasks 1, 3, 4; group select → Task 4; grouped draft + multi-building subject/opening → Task 2; no persistence → constraints; non-goals untouched; tests → Tasks 1–2; SQL check block → Task 3; rollout caveat → Task 3 + final report.
- Added beyond spec (decided here): `memo_tickets.position` follows item order (Task 3), because photo attachments are ordered by it (`src/lib/data/memo-photos.ts`); recorded in Task 5.
- Signature consistency: `parseGroups`/`groupFieldName`/`GROUP_MAX` (Task 1) are used with the same names in Task 4; `orderedIds` (Task 2) feeds `p_ticket_ids` (Tasks 3–4).
