# บันทึกข้อความขอซ่อมแซมรวมหลายงาน Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เจ้าหน้าที่ติ๊กเลือกงานซ่อมในอาคารเดียวกัน 2–20 งาน แล้วกดปุ่มเดียวได้ร่างบันทึกข้อความฉบับเดียวเสนอผู้อำนวยการ

**Architecture:** ตาราง `memo_tickets` ผูกบันทึกกับหลายงาน + ฟังก์ชัน Postgres `create_combined_repair_memo` สร้างบันทึกและลิงก์ใน transaction เดียวพร้อมตรวจเงื่อนไข; ข้อความร่างสร้างจากฟังก์ชันล้วน `draftFromTickets`; กฎการเลือกอยู่ในโมดูลล้วน `combine.ts` ใช้ร่วมทั้งหน้าจอและ action; หน้า `/memos` เพิ่ม client component ของรายการงานที่ติ๊กได้

**Tech Stack:** Next.js (App Router, server actions — ดู AGENTS.md: อ่าน `node_modules/next/dist/docs/` ก่อนแก้โค้ด Next), Supabase (Postgres + RLS), เทสต์ด้วย `node --experimental-strip-types --test`

**Spec:** `docs/superpowers/specs/2026-11-12-combined-repair-memo-design.md`

## Global Constraints

- โมดูลใน `src/lib` ที่เทสต์ import ต้องใช้ import แบบ relative พร้อมนามสกุล `.ts` (เช่น `"./model.ts"`); alias `@/` ใช้ไม่ได้ใต้ node test runner. `import type` ใช้ `@/` ได้เพราะถูกลบทิ้ง
- จำนวนงานต่อบันทึกรวม: ต่ำสุด 2, สูงสุด 20
- ไม่มีส่วนค่าใช้จ่ายประมาณการ/ยอดเงิน; ไม่แตะ `estimated_cost`; `proposal` เป็นสตริงว่าง (ข้อความขออนุมัติคือ `REPAIR_CLOSING` ที่ renderer เติม)
- ข้อความหน้าจอเป็นภาษาไทย; ปุ่ม/ช่องติ๊กกดได้สูงอย่างน้อย 44px (`h-11` / `size-11`)
- ไฟล์ SQL รันซ้ำได้ปลอดภัย (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`); ผู้ช่วยไม่รัน SQL กับ Supabase จริง ผู้ใช้เป็นคนรัน
- บันทึกเดี่ยวที่มีอยู่เดิม (`reference_id`) ต้องทำงานเหมือนเดิมทุกประการ
- ตรวจผลด้วย: `npm test`, `npx eslint <ไฟล์ที่แก้>`, `npx tsc --noEmit` (มี error เดิม `src/app/layout.tsx: Cannot find name 'LayoutProps'` อยู่ก่อนแล้ว ตรวจว่าไม่มี error ใหม่)
- commit ท้ายข้อความด้วย `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` และ `Claude-Session: https://claude.ai/code/session_018irRbrcb3E4sr3hLB1g6cT`; ทำงานบน branch `claude/nice-turing-lg0b16`

## Review Focus

1. สองคนรวมงานเดียวกันพร้อมกัน → คนที่สองได้ข้อความ "มีบันทึกแล้ว" และไม่เหลือบันทึกครึ่งๆ กลางๆ (Task 3 check block, Task 4 การแปลงรหัสข้อผิดพลาด)
2. ส่งฟอร์มปลอมที่มีงานต่างอาคาร/งานที่ปิดแล้ว → ฐานข้อมูลปฏิเสธ ไม่พึ่งการ disable ปุ่มฝั่งเบราว์เซอร์ (Task 3, Task 4)
3. รายการ id ซ้ำกันในฟอร์ม, id ที่ไม่ใช่ UUID, 1 งาน หรือ 21 งาน → ถูกปฏิเสธ (Task 2 เทสต์)
4. งานที่ไม่มีห้องและไม่มี `location_detail`, งานที่ไม่มีบันทึกช่าง → ร่างยังอ่านรู้เรื่อง ใช้ "บริเวณโรงเรียน" (Task 1 เทสต์)
5. ลบบันทึกรวมแล้ว งานกลับมาอยู่ในรายการ "ยังไม่มีบันทึก" และติ๊กรวมใหม่ได้ (Task 3 check block, Task 4)

---

### Task 1: `draftFromTickets` — ข้อความร่างรวม

**Files:**
- Modify: `src/lib/memo/draft.ts` (เปลี่ยน 2 บรรทัดบนสุดเป็น relative import: `"./model.ts"`, `"../time.ts"`; เพิ่มฟังก์ชัน)
- Test: `src/lib/memo/draft.test.ts` (ใหม่)

**Interfaces:**
- Produces: `draftFromTickets(tickets: TicketRow[]): { subject: string; recipient: string; body_content: string; proposal: string }` — `TicketRow` จาก `@/types/tickets` (`import type`)

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** ใน `draft.test.ts` ด้วยงานตัวอย่าง 3 งานอาคารเดียวกัน (สร้าง helper ในเทสต์ที่ปั้น `TicketRow` ขั้นต่ำ) แล้วยืนยัน:
  - `subject === "ขออนุมัติซ่อมแซมอาคารสถานที่ อาคาร 1 จำนวน 3 รายการ"`; `recipient === "ผู้อำนวยการโรงเรียนละหานทรายรัชดาภิเษก"`; `proposal === ""`
  - `body_content.split("\n")` มี 1 ย่อหน้าเปิด + 3 ข้อ + 1 บรรทัดสรุป; ข้อขึ้นต้น `"1. "`, `"2. "`, `"3. "` เรียงตาม `created_at` เก่าก่อน แม้ส่ง input สลับลำดับ; บรรทัดสุดท้าย `"รวมทั้งสิ้น 3 รายการ"`
  - แต่ละข้อมี `ticket_number`; ข้อที่มี `technician_notes` มีข้อความนั้น
  - ย่อหน้าเปิดมี `"โดยเร็ว"` เมื่อทุกงานเป็น `low`/`medium` และ `"อย่างเร่งด่วน"` เมื่อมีงาน `high` หรือ `emergency` อย่างน้อยหนึ่ง
  - ไม่มีคำว่า `"บาท"` และ `"ค่าใช้จ่าย"` ใน `body_content`
  - งานที่ไม่มี `room` และไม่มี `location_detail` → ข้อนั้นมีชื่ออาคารแต่ไม่มี `undefined`/`null`; ถ้าไม่มีทั้ง `building` ใช้ `"บริเวณโรงเรียน"`
- [ ] **Step 2: รันให้ล้ม** — `node --experimental-strip-types --test src/lib/memo/draft.test.ts` คาดว่า fail (ไม่มี `draftFromTickets`)
- [ ] **Step 3: เขียน `draftFromTickets`** — รูปแบบข้อ: `{n}. {สถานที่}: {ความเสียหาย} (เลขที่งาน {ticket_number}, แจ้งเมื่อ {formatThaiDate(created_at)})` ตามด้วย ` {technician_notes}` ถ้ามี; สถานที่ = `[building.name, room.name ?? location_detail]` กรองค่าว่างแล้วคั่นด้วยช่องว่าง (ว่าง → `"บริเวณโรงเรียน"`); ความเสียหาย = `title` และ `description` ถ้าต่างจาก `title` (ตรรกะเดียวกับ `draftFromTicket`); ย่อหน้าเปิด = `ด้วยงานอาคารสถานที่ได้รับแจ้งความชำรุดเสียหายของอาคารสถานที่ ณ {ชื่ออาคารของงานแรก} รวม {N} รายการ และได้ตรวจสอบสภาพความเสียหายแล้ว พบว่ามีความจำเป็นต้องดำเนินการซ่อมแซม{อย่างเร่งด่วน|โดยเร็ว} เพื่อความปลอดภัยของนักเรียนและครูผู้สอน และไม่ให้เกิดความเสียหายลุกลาม ดังรายการต่อไปนี้`; ย่อหน้าต่อกันด้วย `"\n"`; เรียงสำเนาของ input ตาม `created_at` ห้ามแก้ array เดิม
- [ ] **Step 4: รันเทสต์ทั้งไฟล์ให้ผ่าน** และ `npm test` ทั้งชุดต้องไม่มี fail (การเปลี่ยน import เป็น relative ต้องไม่ทำให้ Next build พัง — รัน `npx tsc --noEmit` ยืนยัน)
- [ ] **Step 5: Commit** — `feat(memos): ตัวสร้างข้อความร่างบันทึกรวมหลายงานซ่อม`

### Task 2: กฎการรวมงาน `combine.ts`

**Files:**
- Create: `src/lib/memo/combine.ts`
- Test: `src/lib/memo/combine.test.ts`

**Interfaces:**
- Produces:
  - `COMBINE_MIN = 2`, `COMBINE_MAX = 20` (`number`)
  - `parseTicketIds(values: unknown[]): string[] | null` — รับค่าจาก `formData.getAll("ticket_ids")`; คืนรายการ UUID ไม่ซ้ำ (เรียงตามลำดับที่เจอครั้งแรก) หรือ `null` ถ้ามีค่าใดไม่ใช่ string UUID รูปแบบ 8-4-4-4-12 หรือจำนวนไม่ซ้ำอยู่นอก 2–20
  - `selectableTicket(selectedBuildingId: string | null, ticketBuildingId: string): boolean` — `true` เมื่อยังไม่ได้เลือกงานใด (`null`) หรืออาคารตรงกัน

- [ ] **Step 1: เขียนเทสต์ที่ล้ม** — ครอบ: 2 id ถูกต้อง → รายการเดิม; id ซ้ำ 2 ตัว (เหลือไม่ซ้ำ 1) → `null`; id ซ้ำแต่ไม่ซ้ำรวม ≥2 → ถูกกรองซ้ำ; 1 งาน → `null`; 21 งาน → `null`, 20 งาน → ผ่าน; ค่าที่ไม่ใช่ UUID หรือไม่ใช่ string (เช่น `File`/`null`/`"abc"`) → `null`; รายการว่าง → `null`; `selectableTicket(null, "b1")` true, `("b1","b1")` true, `("b1","b2")` false
- [ ] **Step 2: รันให้ล้ม** — `node --experimental-strip-types --test src/lib/memo/combine.test.ts`
- [ ] **Step 3: เขียนโมดูลให้ผ่านเทสต์** (ไม่มี import นอกจาก built-in)
- [ ] **Step 4: รันให้ผ่าน** แล้ว `npx eslint src/lib/memo/combine.ts src/lib/memo/combine.test.ts`
- [ ] **Step 5: Commit** — `feat(memos): กฎเลือกงานซ่อมเพื่อรวมเป็นบันทึกเดียว`

### Task 3: ฐานข้อมูล `supabase/memo_tickets.sql`

**Files:**
- Create: `supabase/memo_tickets.sql`

**Interfaces:**
- Produces: ตาราง `public.memo_tickets(memo_id UUID, ticket_id UUID, position INT)`; ฟังก์ชัน `public.create_combined_repair_memo(p_ticket_ids UUID[], p_subject TEXT, p_recipient TEXT, p_body TEXT, p_proposal TEXT) RETURNS UUID` เรียกผ่าน `supabase.rpc("create_combined_repair_memo", {...})`. ข้อผิดพลาดใช้ `RAISE EXCEPTION '<รหัส>'` โดยรหัสเป็นหนึ่งใน `not_staff`, `count_range`, `missing_ticket`, `mixed_buildings`, `not_open`, `already_has_memo`; ชนกันพร้อมกันได้ unique violation `23505` ซึ่ง Task 4 แปลเป็น `already_has_memo`

- [ ] **Step 1: เขียนไฟล์ SQL** ตามหัวข้อ 4 ของสเปกทุกข้อ: ตาราง (PK `(memo_id, ticket_id)`, `UNIQUE (ticket_id)`, FK ทั้งสองแบบ `ON DELETE CASCADE`), เปิด RLS, policy SELECT/INSERT ใช้ `public.current_role_is('staff', 'super_admin')` (ตรงกับ policy ของ `memorandums` — `head` ถูกนับเป็น `staff` อยู่แล้วโดยฟังก์ชันนี้), ฟังก์ชัน `SECURITY INVOKER` + `SET search_path = public` ตรวจ 6 ข้อตามลำดับในสเปก, `INSERT INTO memorandums` ด้วย `origin_module 'repair'`, `reference_id NULL`, `author_id auth.uid()`, `approval_mode 'paper_hybrid'`, `doc_ref_no ''`, แล้วใส่ `memo_tickets` เรียงตาม `created_at` ของงาน (position เริ่ม 1), `GRANT EXECUTE` ให้ `authenticated`, `REVOKE ... FROM PUBLIC, anon`
- [ ] **Step 2: เขียน check block เป็นคอมเมนต์ท้ายไฟล์** ให้ผู้ใช้รันเทียบ: รวมต่างอาคาร → `mixed_buildings`; รวมงานที่ปิดแล้ว → `not_open`; รวมงานที่มีบันทึกแล้ว (ทั้งบันทึกเดี่ยวและบันทึกรวม) → `already_has_memo`; รวม 1 งาน → `count_range`; สำเร็จ → ได้ 1 บันทึกและ `memo_tickets` ครบตามลำดับ; ลบบันทึกด้วย service role แล้ว `memo_tickets` ของบันทึกนั้นหาย และงานกลับมารวมใหม่ได้
- [ ] **Step 3: ทบทวนด้วยการอ่านทีละบรรทัด** เทียบกับสเปกหัวข้อ 4 และกับ policy เดิมใน `supabase/schema.sql` (ไม่มีฐานข้อมูลให้รัน — รายงานตรงๆ ว่ายังไม่ได้รัน)
- [ ] **Step 4: Commit** — `feat(memos): ตารางและฟังก์ชันฐานข้อมูลสำหรับบันทึกรวมหลายงานซ่อม`

### Task 4: ฝั่งเซิร์ฟเวอร์ — action, รายการ "ยังไม่มีบันทึก", สำรองข้อมูล

**Files:**
- Modify: `src/app/(dashboard)/memos/actions.ts` (เพิ่ม `createCombinedMemo`; แก้ `createMemoFromTicket`)
- Modify: `src/lib/data/memos.ts` (`getMemoList` รวม `memo_tickets.ticket_id` เข้าชุด `used`)
- Modify: `src/lib/backup.ts` (`BACKUP_TABLES` เพิ่ม `"memo_tickets"` ต่อจาก `"memorandums"`; `ORDER_BY` เพิ่ม `memo_tickets: ["memo_id", "ticket_id"]`)

**Interfaces:**
- Consumes: `draftFromTickets` (Task 1), `parseTicketIds` (Task 2), RPC และรหัสข้อผิดพลาดของ Task 3
- Produces: `createCombinedMemo(formData: FormData): Promise<never>` (server action, `redirect` เสมอ) อ่านฟิลด์ `ticket_ids` หลายค่า; ใช้เป็น `<form action>` ใน Task 5

- [ ] **Step 1: `getMemoList`** — เพิ่ม query `memo_tickets` (`select("ticket_id")`) ใน `Promise.all` เดิม; error ใดๆ → `failed()` เหมือนเดิม; `used` = `reference_id` ของบันทึกเดี่ยว ∪ `ticket_id` ทั้งหมดจาก `memo_tickets`
- [ ] **Step 2: `createMemoFromTicket`** — ก่อนสร้างร่างเดี่ยว ถ้า `memo_tickets` มีแถวของ `ticketId` ให้ `redirect(`/memos/${memo_id}`)`
- [ ] **Step 3: `createCombinedMemo`** — `parseTicketIds(formData.getAll("ticket_ids"))` เป็น `null` → redirect `/memos?error=…` ข้อความไทย "เลือกงาน 2–20 งานในอาคารเดียวกันก่อน"; โหมดสาธิต → ไปบันทึกตัวอย่างแรกเหมือน `createMemoFromTicket`; ไม่ได้ล็อกอิน → `/login`; โหลดงานด้วย select เดียวกับ `createMemoFromTicket` (`*, building:buildings(name), room:rooms(room_number, name), reporter:profiles(full_name)`) ด้วย `.in("id", ids)`; ถ้าจำนวนที่ได้ไม่เท่าจำนวนที่ขอ → ข้อผิดพลาด `missing_ticket`; เรียก `draftFromTickets` แล้ว `supabase.rpc("create_combined_repair_memo", {...})`; แปลงรหัส (`error.message` ตรงกับรหัสใน Interfaces ของ Task 3, `error.code === "23505"` ⇒ `already_has_memo`) เป็นข้อความไทยที่ต่างกันต่อรหัส (ต่างอาคาร / งานปิดแล้ว / มีบันทึกแล้ว / ไม่ใช่เจ้าหน้าที่ / อื่นๆ ทั่วไป); สำเร็จ → `revalidatePath("/memos")`, `revalidatePath("/")`, `redirect(`/memos/${id}`)` — ดู AGENTS.md: ตรวจ docs ของ Next เรื่อง `redirect` ใน server action ก่อนเขียน
- [ ] **Step 4: ตรวจ** — `npx eslint` ไฟล์ที่แก้, `npx tsc --noEmit` (ต้องไม่มี error ใหม่), `npm test`
- [ ] **Step 5: Commit** — `feat(memos): action สร้างบันทึกรวมหลายงานซ่อม และนับบันทึกรวมในรายการ`

### Task 5: หน้าจอ `/memos` — เลือกงานและปุ่มรวม

**Files:**
- Create: `src/components/memos/candidate-list.tsx` (client component)
- Modify: `src/app/(dashboard)/memos/page.tsx` (ส่วน "งานซ่อมที่ยังไม่มีบันทึก" ใช้ `CandidateList` แทน `<ul>` เดิม)

**Interfaces:**
- Consumes: `createCombinedMemo`, `createMemoFromTicket` (Task 4), `selectableTicket`, `COMBINE_MIN`, `COMBINE_MAX` (Task 2), `UrgencyMark` จาก `@/components/tickets/status-mark`, `placeOf` จาก `@/components/tickets/ticket-table`
- Produces: `CandidateList({ candidates }: { candidates: TicketRow[] })`

- [ ] **Step 1: เขียน `CandidateList`** — คงหน้าตาแถวเดิม (ชื่อเรื่อง สถานที่ ความเร่งด่วน และฟอร์มปุ่ม "ร่างบันทึกข้อความ" ที่เรียก `createMemoFromTicket`) เพิ่มช่องติ๊กต่อแถว `name="ticket_ids"` `value={t.id}` ผูกกับฟอร์มรวมด้วย `form="combine-form"` (รูปแบบเดียวกับ `RowCheck`/`bulk-trash` ใน `ticket-table.tsx` เพื่อไม่ให้ฟอร์มซ้อนฟอร์ม; พื้นที่กด `size-11`); state ของงานที่เลือก; ช่องของงานต่างอาคารจาก `selectableTicket` เป็น `false` ถูก `disabled` พร้อมข้อความ "ต่างอาคาร" ที่ผู้ใช้อ่านได้บนแถว (ไม่พึ่งสีอย่างเดียว); แถบด้านบนเมื่อเลือก ≥1 งาน แสดง "เลือกแล้ว N งาน · {ชื่ออาคาร}", ปุ่ม "ล้างที่เลือก" และฟอร์ม `id="combine-form" action={createCombinedMemo}` ปุ่ม **รวมเป็นร่างเดียว** (`h-11`) ที่ `disabled` เมื่อ N < `COMBINE_MIN` หรือ N > `COMBINE_MAX` พร้อมบอกเหตุผล; ปุ่ม submit ใช้ `useFormStatus` แสดง "กำลังสร้าง..." และกดซ้ำไม่ได้
- [ ] **Step 2: ต่อเข้า `page.tsx`** — แทนรายการเดิมด้วย `<CandidateList candidates={list.candidates} />` (ส่วนอื่นของหน้าไม่เปลี่ยน; `list.candidates` เป็นข้อมูล serializable อยู่แล้ว)
- [ ] **Step 3: ตรวจ** — `npx eslint` ไฟล์ที่แก้, `npx tsc --noEmit`, `npm test`; เปิดดู responsive ที่ 390px ด้วย Playwright ถ้ารัน dev server ได้ (ไม่มี Supabase ให้เข้าสู่ระบบ — หน้าจะเป็นโหมดสาธิตจาก `MOCK_TICKETS`) และถ้าตรวจหน้าไม่ได้ให้รายงานตรงๆ
- [ ] **Step 4: Commit** — `feat(memos): ติ๊กเลือกงานซ่อมในอาคารเดียวกันแล้วรวมเป็นร่างเดียว`

### Task 6: ตรวจรวมก่อนส่ง

**Files:** ไม่มีไฟล์ใหม่

- [ ] **Step 1:** `npm test` — ทุกข้อผ่าน รายงานจำนวน
- [ ] **Step 2:** `npx eslint` ทุกไฟล์ที่เปลี่ยนใน branch (`git diff --name-only origin/main`) ผ่าน
- [ ] **Step 3:** `npx tsc --noEmit` — มีเฉพาะ error เดิมเรื่อง `LayoutProps`
- [ ] **Step 4:** เทียบสเปกทีละหัวข้อ (1–9) กับ diff ว่าไม่มีข้อไหนตกหล่น; รายงานให้ผู้ใช้ทราบ: ยังไม่ได้ลองบนเว็บจริง, SQL ยังไม่ได้รัน, ผู้ใช้ต้องรัน `supabase/memo_tickets.sql` ก่อน merge
- [ ] **Step 5:** push branch (ยังไม่เปิด PR จนกว่าผู้ใช้สั่ง)
