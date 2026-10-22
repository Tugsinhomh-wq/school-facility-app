# ควบคุมภายใน รอบ 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เจ้าของโครงการ (ครูทุกกลุ่มงาน) กรอกโครงการและคะแนนความเสี่ยง หัวหน้ากลุ่มบริหารทั่วไปตรวจและยืนยัน กรอก CSA 5 ขั้นตอนต่อภารกิจ แล้วสร้างแบบ ปค.5 และ CSA เป็น Word/พิมพ์ PDF ได้ ครบ 6 กลุ่มงาน

**Architecture:** ตรรกะล้วน (คะแนน/ระดับ/ปีงบประมาณ/สิทธิ์/แถว ปค.5) อยู่ใน `src/lib/control/*` พร้อมเทสต์ (`npm test`); ข้อมูลอยู่ใน Supabase 3 ตาราง (`control_missions`, `control_projects`, `control_actions`) ป้องกันด้วย RLS + trigger (ผู้ใช้รัน SQL เอง); หน้า `/control/*` เป็น server component + server action แบบเดียวกับ `/cleaning`; Word สร้างด้วย `docx` (docx-js) ที่โปรเจกต์มีอยู่แล้ว ไม่เพิ่มไลบรารี

**Tech Stack:** Next.js 16 App Router (อ่าน `node_modules/next/dist/docs` ก่อนใช้ API ที่ไม่แน่ใจ ตาม AGENTS.md), Supabase (RLS, ไคลเอนต์ session), `docx`, `node:test` กับ `--experimental-strip-types`

**Spec:** `docs/superpowers/specs/2026-10-22-internal-control-design.md` (แก้ให้ตรงกับแผนนี้แล้ว: 3 ตาราง, คอลัมน์ ปค.5 ข้อ 3–5 เป็นฟิลด์ของโครงการเอง, ผู้บริหารยังไม่เห็น `/control` ในรอบ 1)

## Global Constraints

- ภาษาในหน้าจอทั้งหมดเป็นไทย; ชื่อระบบ "สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก" ใน `metadata.title`
- UI โทน C (ดู `src/components/ui/state-card.tsx`, `src/components/tickets/status-mark.tsx` `Pill`, แถวเรียบ + chevron, เป้ากด ≥ 44px, ธีมสว่างอย่างเดียว, ไม่มีคลาส `dark:`); โหลดข้อมูลไม่สำเร็จขณะล็อกอินต้องขึ้น `LoadError` ห้ามแสดงข้อมูลตัวอย่าง
- สิทธิ์: เจ้าหน้าที่ = `isStaffRole` ใน `src/lib/data/session.ts` (staff, head, super_admin) — ห้ามสร้างบทบาทใหม่
- ระดับความเสี่ยง (ตามไฟล์ผู้ใช้): 16–25 สูงมาก · 9–15 สูง · 4–8 ปานกลาง · 1–3 ต่ำ; คัดเข้า ปค.5 เมื่อคะแนน ≥ 9
- ปีงบประมาณ พ.ศ. เริ่ม 1 ต.ค.: `fiscalYear("2026-09-30") = 2569`, `fiscalYear("2026-10-01") = 2570`
- ชื่อกลุ่มงาน 6 กลุ่มและหัวข้อฟอร์ม อยู่ที่ `src/lib/control/forms.ts` ที่เดียว
- ไม่ใช้ AI/บริการภายนอก; ห้ามใส่ชื่อบุคลากรหรือตัวเลขจากไฟล์ตัวอย่างจริงลงในโค้ด เทสต์ หรือ seed
- ผมไม่รัน SQL กับ Supabase; ไฟล์ SQL ต้องรันซ้ำได้ปลอดภัย (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`)
- ก่อน commit: `npm test`, `npx tsc --noEmit`, `npx eslint <ไฟล์ที่แก้>` ผ่าน; ท้ายแผน `npm run build` และ `.claude/skills/impeccable/scripts/impeccable detect --json <ไฟล์หน้าที่แก้>` ได้ `[]`
- Commit ต่อท้ายด้วย `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` และ `Claude-Session: https://claude.ai/code/session_01LwYGFMpHSsC8wre41sRDAB`

## Review Focus

- เจ้าของโครงการแก้โครงการของคนอื่น หรือของตัวเองหลังหัวหน้ายืนยันแล้ว → ต้องถูกปฏิเสธทั้งในโค้ด (`canEditProject`) และ RLS/trigger (Task 1, 2)
- โครงการยังไม่ให้ L/I หรือให้ค่านอก 1–5 → คะแนนเป็น `null` ไม่เข้า ปค.5 แต่แสดงในภาพรวมว่า "ยังไม่ให้คะแนน" (Task 1, 4)
- โครงการ ≥ 9 คะแนนที่คอลัมน์ว่าง/ไม่มีมาตรการ → ปค.5 ยังออกแถวนั้น ช่องว่างเป็น "-" ไม่ทำให้เอกสารพัง (Task 6)
- ข้อความไทยยาว/ขึ้นบรรทัดใหม่ในช่อง และเอกสารที่ไม่มีโครงการเลย → Word ถูกสร้างและเปิดได้ (Task 6)
- หัวหน้าปรับ L/I แล้วคะแนนที่ใช้ต้องเป็นของหัวหน้า; ยกเลิกยืนยันแล้วเจ้าของแก้ได้อีก; ขอบปีงบประมาณ 30 ก.ย./1 ต.ค. (Task 1, 3)

---

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/control/forms.ts` (สร้าง) | ค่าคงที่ฟอร์ม: กลุ่มงาน, ประเภทความเสี่ยง, หัวข้อ CSA 5 ขั้น, หัวคอลัมน์ ปค.5, คำอธิบายระดับ L/I |
| `src/lib/control/risk.ts` (สร้าง) | `fiscalYear`, `riskScore`, `riskLevel`, `effectiveScore`, `needsPk5` |
| `src/lib/control/access.ts` (สร้าง) | `canEditProject`, `canReview` (ตรงกับ RLS) |
| `src/lib/control/pk5.ts` (สร้าง) | `pk5Rows` — แปลงโครงการ+มาตรการเป็นแถว 7 คอลัมน์ |
| `src/lib/control/docx.ts` (สร้าง) | `pk5ToDocx`, `csaToDocx` |
| `supabase/control_01.sql` (สร้าง) | ตาราง, RLS, trigger, ชุดตรวจสอบ |
| `src/lib/data/control.ts` (สร้าง) | อ่านข้อมูล (server) |
| `src/app/(dashboard)/control/**` (สร้าง) | หน้า, actions, route ส่งออก |
| `src/components/control/*` (สร้าง) | ฟอร์ม/แถวของหน้า |
| `src/lib/modules.ts`, `src/lib/modules.test.ts`, `src/lib/backup.ts` (แก้) | เปิดเมนู + สำรองตารางใหม่ |

---

### Task 1: ตรรกะล้วน — ฟอร์ม ความเสี่ยง ปีงบประมาณ สิทธิ์

**Files:**
- Create: `src/lib/control/forms.ts`, `src/lib/control/risk.ts`, `src/lib/control/access.ts`
- Test: `src/lib/control/risk.test.ts`, `src/lib/control/access.test.ts`

**Interfaces:**
- Produces (`forms.ts`): `GROUPS: readonly { key: GroupKey; label: string }[]` (6 กลุ่ม: `finance` การเงินและงบประมาณ, `student` กิจการนักเรียน, `personnel` งานบุคคล, `academic` วิชาการ, `general` บริหารทั่วไป, `royal` ศาสตร์พระราชา — ใช้คำเต็ม "กลุ่มบริหาร…" ตามไฟล์ผู้ใช้), `type GroupKey`, `RISK_TYPES: readonly { key: "F"|"C"|"O"; label: string }[]` (ด้านการเงิน/ด้านกฎหมาย/ด้านการดำเนินงาน), `CSA_STEPS: readonly { n: 1..5; label: string; hint: string }[]`, `PK5_COLUMNS: readonly string[]` (7 หัวคอลัมน์ตามไฟล์ ปค.5), `LIKELIHOOD: readonly string[]` และ `IMPACT: readonly string[]` (คำอธิบายระดับ 1–5 ภาษาไทยทั่วไป เขียนเอง ไม่ได้มาจากไฟล์ — ระบุใน commit message ว่าให้ผู้ใช้ตรวจ)
- Produces (`risk.ts`): `fiscalYear(ymd: string): number`; `riskScore(l: number | null, i: number | null): number | null` (null ถ้าขาด/ไม่ใช่จำนวนเต็ม 1–5); `type RiskLevel = "extreme"|"high"|"moderate"|"low"`; `riskLevel(score: number): RiskLevel`; `LEVEL_LABEL: Record<RiskLevel, string>` (สูงมาก/สูง/ปานกลาง/ต่ำ); `effectiveScore(p: { likelihood: number|null; impact: number|null; headLikelihood: number|null; headImpact: number|null }): number | null` (ใช้ค่าของหัวหน้าก่อนเมื่อมี); `needsPk5(score: number | null): boolean` (≥ 9)
- Produces (`access.ts`): `type ProjectAccess = { ownerId: string; confirmed: boolean }`; `canEditProject(p: ProjectAccess, viewer: { userId: string; role: UserRole | null }): boolean` (เจ้าหน้าที่เสมอ; เจ้าของเมื่อยังไม่ยืนยัน; อื่นๆ ไม่); `canReview(role): boolean` = `isStaffRole` แต่ **ไม่ import `data/session`** (ไฟล์นั้นใช้ `next/headers` ทำให้เทสต์รันไม่ได้) ให้ประกาศเซตบทบาท `["staff","head","super_admin"]` เองและมีเทสต์ยืนยันว่าตรงกับ `isStaffRole`

- [ ] **Step 1: เขียนเทสต์ที่ล้มก่อน** `risk.test.ts`: `fiscalYear` สามค่าใน Global Constraints + `"2027-01-15" → 2570`; `riskScore(4,4)=16`, `riskScore(5,3)=15`, `riskScore(null,3)=null`, `riskScore(0,3)=null`, `riskScore(6,1)=null`, `riskScore(2.5,2)=null`; `riskLevel` ที่ขอบ 1,3,4,8,9,15,16,25 ได้ low,low,moderate,moderate,high,high,extreme,extreme; `effectiveScore({likelihood:2,impact:2,headLikelihood:5,headImpact:3})=15` และเมื่อ head เป็น null ใช้ของเจ้าของ; `needsPk5(9)=true`, `needsPk5(8)=false`, `needsPk5(null)=false`. `access.test.ts`: เจ้าของยังไม่ยืนยัน แก้ได้; เจ้าของยืนยันแล้ว แก้ไม่ได้; ผู้ใช้อื่นแก้ไม่ได้; staff/head/super_admin แก้ได้ทุกกรณี; executive/user/room_staff/null ที่ไม่ใช่เจ้าของ แก้ไม่ได้; `canReview` ตรงกับ `isStaffRole` สำหรับทุกค่า `UserRole`
- [ ] **Step 2:** รัน `npm test` — คาดว่า FAIL (ไม่พบไฟล์)
- [ ] **Step 3:** สร้างสามไฟล์ตาม Interfaces; `fiscalYear` อ่านปี/เดือนจากสตริง (เดือน ≥ 10 → ปี+544 ไม่งั้น ปี+543)
- [ ] **Step 4:** รัน `npm test` และ `npx tsc --noEmit` — ผ่านทั้งหมด
- [ ] **Step 5:** Commit `feat(control): ตรรกะคะแนนความเสี่ยง ปีงบประมาณ และสิทธิ์`

---

### Task 2: ฐานข้อมูล — ตาราง RLS trigger และสำรองข้อมูล

**Files:**
- Create: `supabase/control_01.sql`
- Modify: `src/lib/backup.ts` (เพิ่ม `control_missions`, `control_projects`, `control_actions` ต่อท้าย `BACKUP_TABLES` ตามลำดับพ่อก่อนลูก; ทุกตารางมีคอลัมน์ `id` จึงไม่ต้องเพิ่ม `ORDER_BY`)

**Interfaces:**
- Produces ตาราง (ชื่อคอลัมน์ที่ Task 3–6 ใช้):
  - `control_missions`: `id uuid pk`, `fiscal_year int`, `group_key text` (CHECK ในหกค่า), `name text`, `objective text` (CSA ขั้น 1), `procedures text` (ขั้น 2), `practice text` (ขั้น 3), `assessment text` (ขั้น 4), `improvement text` (ขั้น 5), `created_at`, `updated_at`
  - `control_projects`: `id`, `fiscal_year int`, `group_key text`, `name text`, `budget numeric NULL`, `owner_id uuid → profiles(id)`, `mission_id uuid NULL → control_missions ON DELETE SET NULL`, `objective text`, `risk_issue text`, `risk_cause text`, `risk_impact text`, `risk_type text NULL` (F/C/O), `likelihood smallint NULL`, `impact smallint NULL` (CHECK 1–5), `head_likelihood`, `head_impact` (เหมือนกัน), `existing_controls text`, `assessment text`, `residual_risk text`, `confirmed_at timestamptz NULL`, `confirmed_by uuid NULL`, `created_at`, `updated_at`
  - `control_actions`: `id`, `project_id → control_projects ON DELETE CASCADE`, `description text`, `responsible text`, `due date NULL`, `status text` (`open|doing|done`, default `open`), `created_at`
- ข้อความ text ทุกคอลัมน์ `NOT NULL DEFAULT ''` ยกเว้นที่ระบุ NULL

- [ ] **Step 1:** เขียน `control_01.sql` ตามด้านบน; เปิด RLS ทั้งสามตาราง; นโยบาย (ใช้ `public.current_role_is(...)` และ `(SELECT auth.uid())` เหมือน `facility_02_cleaning.sql`):
  - missions: SELECT ผู้ล็อกอินทุกคน; ALL เฉพาะ `current_role_is('staff','super_admin')`
  - projects: SELECT เจ้าหน้าที่, `executive`, หรือ `owner_id = auth.uid()`; INSERT เจ้าหน้าที่ หรือ `owner_id = auth.uid()` (และ `confirmed_at IS NULL`); UPDATE/DELETE เจ้าหน้าที่ หรือ (`owner_id = auth.uid()` และ `confirmed_at IS NULL`)
  - actions: SELECT/ALL เมื่อ `EXISTS` โครงการที่เจ้าหน้าที่ หรือเจ้าของ (เจ้าของแก้มาตรการได้แม้ยืนยันแล้ว เพราะใช้อัปเดตสถานะติดตามผล); SELECT ของ `executive` ด้วย
  - trigger `BEFORE UPDATE` บน `control_projects` (`SECURITY INVOKER`): ถ้าไม่ใช่เจ้าหน้าที่ ให้ raise exception เมื่อ `owner_id, fiscal_year, group_key, mission_id, head_likelihood, head_impact, confirmed_at, confirmed_by` ต่างจากค่าเดิม; ทุกกรณีตั้ง `updated_at = now()`
- [ ] **Step 2:** ท้ายไฟล์เติมบล็อกคอมเมนต์ "ชุดตรวจสอบ" 5 ข้อ ที่ผู้ใช้รันเองหลังติดตั้ง พร้อมผลที่คาด: (1) ตารางทั้งสามมี RLS เปิด (`pg_tables.rowsecurity`), (2) ผู้ใช้ทั่วไปไม่เห็นโครงการของคนอื่น, (3) เจ้าของแก้ `head_likelihood` แล้ว error, (4) เจ้าของแก้โครงการที่ยืนยันแล้ว 0 แถว, (5) หัวหน้าแก้ได้ — เขียนเป็นขั้นตอนใช้ `SET LOCAL ROLE authenticated` + `request.jwt.claims` ในธุรกรรมที่ `ROLLBACK` ท้ายสุด
- [ ] **Step 3:** แก้ `backup.ts`; รัน `npm test`, `npx tsc --noEmit`, `npx eslint src/lib/backup.ts`
- [ ] **Step 4:** อ่านทวนไฟล์ SQL ทีละนโยบายเทียบกับ `canEditProject` ใน Task 1 (ต้องให้ผลเดียวกัน) แล้ว Commit `feat(control): ตาราง RLS และ trigger ควบคุมภายใน`

---

### Task 3: ชั้นข้อมูลและ server actions

**Files:**
- Create: `src/lib/data/control.ts`, `src/app/(dashboard)/control/actions.ts`
- Test: `src/lib/control/access.test.ts` (ขยายถ้าจำเป็น) — actions ไม่มีเทสต์ยูนิต เพราะต้องใช้ session; ความถูกต้องยึด `access.ts` + RLS

**Interfaces:**
- Consumes: Task 1 ทั้งหมด; `getSession`, `hasSupabase`, `isStaffRole` จาก `@/lib/data/session`
- Produces (`data/control.ts`, ทุกฟังก์ชัน server-only, คืน `{ …; failed?: true }` แบบเดียวกับ `data/cleaning.ts`; ไม่มี session = โหมดสาธิตคืนรายการว่าง):
  - `type ControlProject = { id; fiscalYear; groupKey; name; budget: number|null; ownerId; ownerName; missionId: string|null; objective; riskIssue; riskCause; riskImpact; riskType: "F"|"C"|"O"|null; likelihood; impact; headLikelihood; headImpact; existingControls; assessment; residualRisk; confirmed: boolean; confirmedAt: string|null; score: number|null; actions: ControlAction[] }` โดย `score = effectiveScore(...)`
  - `type ControlAction = { id; description; responsible; due: string|null; status: "open"|"doing"|"done" }`
  - `type ControlMission = { id; fiscalYear; groupKey; name; objective; procedures; practice; assessment; improvement }`
  - `listProjects(fy: number): Promise<{ projects: ControlProject[]; failed?: true }>` (RLS ตัดแถวให้เอง), `getProject(id: string)`, `listMissions(fy: number)`, `getMission(id: string)`
- Produces (`actions.ts`, `"use server"`, ทุก action คืน `ControlResult = { ok: boolean; message: string } | null` และเรียก `revalidatePath("/control")`):
  - `saveProject(prev, formData)` — สร้าง/แก้ (ฟิลด์ `id?`, `fiscal_year`, `group_key`, `name`, `budget?`, `owner_email?` เฉพาะเจ้าหน้าที่, `objective`, ฟิลด์ความเสี่ยง, `existing_controls`, `assessment`, `residual_risk`); ใช้ `canEditProject` ก่อนเขียนทุกครั้ง; ผู้ใช้ทั่วไปสร้างได้โดย owner = ตัวเอง
  - `scoreProject(prev, formData)` — เจ้าของ/เจ้าหน้าที่ตั้ง `likelihood`, `impact` (ตรวจ 1–5 ด้วย `riskScore`)
  - `reviewProject(prev, formData)` — เฉพาะ `canReview`: ตั้ง `head_likelihood/impact` (ว่าง = ใช้ของเจ้าของ), `mission_id`, และ `confirm = "1"|"0"` (ยืนยัน/ยกเลิกยืนยัน → ตั้งหรือล้าง `confirmed_at/by`)
  - `deleteProject(formData)`
  - `saveMission(prev, formData)` / `deleteMission(formData)` — เฉพาะ `canReview`; ปีงบประมาณ+กลุ่มงานตรวจกับ `GROUPS`
  - `saveAction(prev, formData)` / `deleteAction(formData)` — ตามสิทธิ์โครงการแม่ (เจ้าของแก้ได้เสมอ)
  - ทุก action: ข้อความปฏิเสธเป็นไทย (เช่น "เฉพาะเจ้าของโครงการหรือเจ้าหน้าที่"), ตรวจ UUID ก่อน query, อีเมลเจ้าของหาไม่เจอ/บัญชีปิด → ข้อความชัดเจน (ทำ helper `ownerIdFromEmail(db, email)` ในไฟล์เดียวกัน อ้างวิธีเดียวกับ `resolveEmails` ใน `cleaning/manage/actions.ts` แต่ไม่ import ข้ามโมดูล)

- [ ] **Step 1:** เขียน `data/control.ts` (select แล้ว map เป็น camelCase; หนึ่ง query ต่อรายการ + embed `owner:profiles(full_name)`, `actions:control_actions(*)`); จุดผิดพลาดใดๆ → `failed: true` ไม่ throw
- [ ] **Step 2:** เขียน `actions.ts` ตามรายการ; ใช้ pattern `officerDb`/`isDb` จาก `cleaning/manage/actions.ts` เป็นต้นแบบ
- [ ] **Step 3:** `npx tsc --noEmit`, `npx eslint` ไฟล์ที่เพิ่ม, `npm test` ผ่าน
- [ ] **Step 4:** Commit `feat(control): ชั้นข้อมูลและ server actions`

---

### Task 4: หน้าภาพรวมและโครงการ

**Files:**
- Create: `src/app/(dashboard)/control/page.tsx`, `src/app/(dashboard)/control/projects/[id]/page.tsx`, `src/app/(dashboard)/control/projects/new/page.tsx`, `src/components/control/project-form.tsx`, `src/components/control/score-picker.tsx`, `src/components/control/project-row.tsx`, `src/components/control/actions-list.tsx`

**Interfaces:**
- Consumes: Task 3 ทั้งหมด; `LoadError`/`EmptyState` (`src/components/ui/state-card.tsx`), `Pill` (`src/components/tickets/status-mark.tsx`)
- Produces: เส้นทาง `/control?fy=2569&group=general` (ค่าเริ่ม `fiscalYear(bangkokYmd(new Date()))` และทุกกลุ่ม), `/control/projects/new`, `/control/projects/[id]`

- [ ] **Step 1:** `/control`: หัวเรื่อง + ตัวเลือกปี (ลิงก์ปีก่อน/ถัดไป 44px) + ตัวกรองกลุ่มงาน (ชิปเหมือน `chip` ใน `officer-overview.tsx`); สรุปประโยคเดียว เช่น "ปี 2569 มี N โครงการ · ≥9 คะแนน M · ยังไม่ให้คะแนน K"; รายการโครงการเป็นแถวเรียบแยกหัวกลุ่มงาน (ชื่อ, เจ้าของ, Pill ระดับพร้อมคะแนน หรือ "ยังไม่ให้คะแนน", Pill "ยืนยันแล้ว"); เจ้าหน้าที่เห็นลิงก์ไป `/control/missions` และ `/control/export`; ผู้ไม่ใช่เจ้าหน้าที่เห็นเฉพาะโครงการตัวเอง (RLS) และ EmptyState ชวนเพิ่มโครงการ
- [ ] **Step 2:** `project-form.tsx` (client, `useActionState(saveProject)` + ฟอร์มให้คะแนนแยก `useActionState(scoreProject)`): ช่องตามฟิลด์; `score-picker` แสดงตัวเลือก 1–5 ของ L และ I พร้อมคำอธิบาย (`LIKELIHOOD`/`IMPACT`) แล้วโชว์ "คะแนน = L×I · ระดับ …" สดๆ ด้วย `riskScore`/`riskLevel`; ปิดช่องแก้ทั้งหมดเมื่อ `!canEditProject` และแสดงเหตุผล ("หัวหน้ายืนยันแล้ว แก้ไม่ได้")
- [ ] **Step 3:** หน้า `[id]`: ฟอร์มข้างต้น + ส่วนมาตรการ (`actions-list.tsx`: แถวมาตรการ, ผู้รับผิดชอบ, กำหนดเสร็จ, สถานะ 3 ค่า, เพิ่ม/ลบ) + ส่วนหัวหน้า (เห็นเฉพาะ `canReview`: ช่อง L/I ของหัวหน้า, เลือกภารกิจ, ปุ่ม "ยืนยัน"/"ยกเลิกยืนยัน" → `reviewProject`); แสดง CSA ของภารกิจที่ผูกแบบอ่านอย่างเดียวเป็นข้อมูลอ้างอิง; ไม่พบ/ไม่มีสิทธิ์ → `notFound()`
- [ ] **Step 4:** `npx tsc --noEmit`, `npx eslint src/app/(dashboard)/control src/components/control`, `impeccable detect` ได้ `[]`
- [ ] **Step 5:** Commit `feat(control): หน้าภาพรวมและแบบฟอร์มโครงการ`

---

### Task 5: ภารกิจและ CSA

**Files:**
- Create: `src/app/(dashboard)/control/missions/page.tsx`, `src/app/(dashboard)/control/missions/[id]/page.tsx`, `src/components/control/mission-form.tsx`

**Interfaces:**
- Consumes: `listMissions`, `getMission`, `listProjects`, `saveMission`, `deleteMission`, `CSA_STEPS`, `GROUPS`; เฉพาะ `canReview` (คนอื่น → `redirect("/control")`)

- [ ] **Step 1:** `/control/missions`: รายการภารกิจตามปี/กลุ่ม (แถว + จำนวนโครงการที่ผูก) และฟอร์มสร้างภารกิจ (ชื่อ, กลุ่มงาน)
- [ ] **Step 2:** `/control/missions/[id]`: ฟอร์ม 5 ขั้นตอนตาม `CSA_STEPS` (ป้ายหัวข้อและ hint จาก `forms.ts`), รายชื่อโครงการที่ผูก (ลิงก์ไปโครงการ), ปุ่มลบภารกิจ (ยืนยันก่อน; โครงการที่ผูกไม่ถูกลบ เพราะ `ON DELETE SET NULL`)
- [ ] **Step 3:** `npx tsc --noEmit`, `npx eslint`, `impeccable detect` ได้ `[]`
- [ ] **Step 4:** Commit `feat(control): ภารกิจและฟอร์ม CSA 5 ขั้นตอน`

---

### Task 6: สร้างเอกสาร ปค.5 และ CSA

**Files:**
- Create: `src/lib/control/pk5.ts`, `src/lib/control/docx.ts`, `src/app/(dashboard)/control/export/page.tsx`, `src/app/(dashboard)/control/export/pk5/route.ts`, `src/app/(dashboard)/control/export/csa/route.ts`, `src/app/(dashboard)/control/print/page.tsx`, `src/components/control/print-button.tsx`
- Test: `src/lib/control/pk5.test.ts`, `src/lib/control/docx.test.ts`

**Interfaces:**
- Consumes: `ControlProject`, `ControlMission` (Task 3) — ใช้เป็น **type-only import** ในไฟล์ที่เทสต์เรียก (ไฟล์เทสต์ห้ามดึง `data/control.ts` ที่ import `server-only`); `PK5_COLUMNS`, `CSA_STEPS`, `needsPk5`, `withBreakHints` จาก `@/lib/memo/thai-text`
- Produces:
  - `pk5Rows(projects: ControlProject[]): { projectId: string; score: number; cells: [string,string,string,string,string,string,string] }[]` — เฉพาะ `confirmed && needsPk5(score)`; เรียงคะแนนมากไปน้อย แล้วตามชื่อ; เซลล์: 1 วัตถุประสงค์ (`objective`, ว่างให้ใช้ชื่อโครงการ), 2 `riskIssue`, 3 `existingControls`, 4 `assessment`, 5 `residualRisk`, 6 มาตรการทุกข้อเรียงเลข "1. …\n2. …", 7 `"ชื่อผู้รับผิดชอบ / กำหนดเสร็จ d MMM yyyy พ.ศ."` ต่อข้อ; ช่องว่างทุกช่องเป็น `"-"`
  - `pk5ToDocx(rows, meta: { fiscalYear: number; groupLabel: string }): Promise<Buffer>` และ `csaToDocx(missions: ControlMission[], meta: { fiscalYear: number; groupLabel: string }): Promise<Buffer>` — หน้า A4 แนวนอนสำหรับ ปค.5, แนวตั้งสำหรับ CSA; ฟอนต์ "TH Sarabun New" 16pt; หัวเรื่องตามไฟล์ผู้ใช้ ("รายงานการประเมินผลการควบคุมภายใน สำหรับระยะเวลาการดำเนินงานสิ้นสุด วันที่ 30 กันยายน พ.ศ. <ปี>"); ท้ายเอกสารเว้นช่องลายมือชื่อผู้รายงาน (**ไม่ใส่ชื่อ** ให้ผู้ใช้พิมพ์เอง); ทุกข้อความผ่าน `withBreakHints`
  - routes `GET /control/export/pk5?fy=&group=` และ `/control/export/csa?fy=&group=` → `.docx` (`Content-Disposition` แบบเดียวกับ `memos/[id]/docx/route.ts`, `Cache-Control: private, no-store`); เฉพาะ `canReview` (อื่นๆ ตอบ 403); พารามิเตอร์ไม่ถูกต้อง 400

- [ ] **Step 1:** เขียน `pk5.test.ts` ที่ล้มก่อน: (a) ไม่ยืนยัน/คะแนน 8/ไม่ให้คะแนน ไม่ออกแถว; (b) 3 โครงการ (16, 9, 12) เรียง 16,12,9; (c) ช่องว่างเป็น `"-"` และโครงการที่ไม่มีมาตรการได้ cell 6 และ 7 เป็น `"-"`; (d) มาตรการ 2 ข้อเรียงเลขและแสดงผู้รับผิดชอบ/กำหนดเสร็จ; (e) คะแนนใช้ค่าของหัวหน้าเมื่อปรับ (L/I เจ้าของ 2×2 แต่หัวหน้า 4×4 → ออกแถว)
- [ ] **Step 2:** เขียน `docx.test.ts` ที่ล้มก่อน: สร้าง `pk5ToDocx([], …)` และกรณี 1 แถวข้อความไทยยาวมีขึ้นบรรทัดใหม่ → ได้ Buffer ที่ขึ้นต้น `PK` และ (ใช้ `jszip` ที่ docx พึ่งอยู่ ถ้า resolve ได้จาก `node_modules`) `word/document.xml` มีหัวคอลัมน์ทั้ง 7 และข้อความที่ใส่; `csaToDocx([], …)` ไม่ throw
- [ ] **Step 3:** รัน `npm test` — FAIL
- [ ] **Step 4:** Implement `pk5.ts`, `docx.ts` (ใช้ `Document`/`Table`/`PageOrientation.LANDSCAPE` ของ docx-js; รูปแบบ run เลียนแบบ `src/lib/memo/docx.ts`; **ไม่** ใช้ python-docx) และ routes
- [ ] **Step 5:** `/control/export`: เลือกปี + กลุ่มงาน (หรือ "ทุกกลุ่ม" → ไฟล์เดียวรวมทุกกลุ่ม เรียงตามกลุ่ม) แล้วปุ่มดาวน์โหลด ปค.5 / CSA (.docx) และลิงก์ "ดูแบบพิมพ์" ไป `/control/print?doc=pk5|csa&fy=&group=`; `/control/print` เป็นตาราง HTML เดียวกับในเอกสาร + `print-button.tsx` (client, `window.print()`) และ CSS `@page { size: A4 landscape }` สำหรับ ปค.5; ซ่อนแถบเมนูตอนพิมพ์ (`print:hidden` บนปุ่มและลิงก์)
- [ ] **Step 6:** `npm test` ผ่าน, `npx tsc --noEmit`, `npx eslint`, `impeccable detect` ได้ `[]`; ถ้ามี `soffice`/`libreoffice` ในเครื่อง ลองแปลง docx ตัวอย่างเป็น PDF ดูว่าเปิดได้ (ไม่มี = ข้ามและรายงาน)
- [ ] **Step 7:** Commit `feat(control): สร้างเอกสาร ปค.5 และ CSA เป็น Word และหน้าพิมพ์`

---

### Task 7: เปิดเมนู ตรวจรวม และส่งมอบ

**Files:**
- Modify: `src/lib/modules.ts` (โมดูล `control`: `href: "/control"`, ลบ `soon`, `roles` = `["user","staff","head","room_staff","super_admin"]`, `group: "other"` ตามเดิม), `src/lib/modules.test.ts` (ปรับให้ตรงพฤติกรรมใหม่: ผู้ใช้ทั่วไป/staff/head/room_staff/super_admin เห็น `control` พร้อมลิงก์ `/control`; ผู้ไม่ได้ล็อกอิน (`null`) **ไม่เห็น** `control`; executive ยังไม่เห็นโมดูลใดเลย), `src/lib/nav.ts` / `src/lib/nav.test.ts` ถ้าเมนูล่างมือถือต้องเพิ่มรายการ

**Interfaces:**
- Consumes: ทุก task ก่อนหน้า

- [ ] **Step 1:** แก้เทสต์ใน `modules.test.ts` ให้ล้มก่อน แล้วแก้ `modules.ts` ให้ผ่าน; ตรวจ `nav.ts`/`mobile-nav` ว่าไม่พังเมื่อมีโมดูลที่ไม่ใช่ "soon" เพิ่ม
- [ ] **Step 2:** ตรวจรวม: `npm test`, `npx tsc --noEmit`, `npx eslint src`, `npm run build` (ต้องเห็น `/control`, `/control/export/pk5` ใน route list), `impeccable detect` ทุกไฟล์หน้าใน `control` ได้ `[]`
- [ ] **Step 3:** ตรวจ Playwright (ถ้าทำได้: mock หน้าชั่วคราวเหมือนรอบก่อน แล้ว**ลบก่อน commit**) ที่ 390 และ 1280px สำหรับ `/control`, ฟอร์มโครงการ, หน้า CSA — ถ้าทำไม่ได้ให้บอกชัดว่าไม่ได้เปิดดูหน้าจริง
- [ ] **Step 4:** ท้ายคำตอบรายงานผู้ใช้: ต้องรัน `supabase/control_01.sql` เอง (+ชุดตรวจสอบ), ข้อที่ผมตัดสินใจเอง (คำอธิบายระดับ L/I, ผู้บริหารยังไม่เห็น `/control`, ปค.5 ใช้ฟิลด์ของโครงการเอง), และสิ่งที่ยังไม่ได้ทดสอบกับข้อมูลจริง
- [ ] **Step 5:** Commit `feat(control): เปิดเมนูควบคุมภายในและตรวจรวมรอบ 1`
