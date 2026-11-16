# แนบรูปแจ้งซ่อมที่ด้านหลังบันทึกข้อความ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ส่งออก PDF/Word และพรีวิวของบันทึกข้อความเรื่องแจ้งซ่อม (เดี่ยวและรวม) มีหน้า "เอกสารแนบ: ภาพประกอบการแจ้งซ่อม" ต่อท้าย พร้อมรูปก่อนซ่อมของงาน

**Architecture:** ตัวโหลด `getMemoPhotos` (server, สิทธิ์ผู้ใช้) คืนกลุ่มรูปเป็นลิงก์ที่เซ็นแล้ว; เส้นทางส่งออกดาวน์โหลดไบต์ด้วย `loadPhotoFiles` แล้วส่งให้ตัวสร้างไฟล์ 3 ตัว (pdfkit, docx-js, python-docx) ที่วางหน้าแนบเหมือนกัน; พรีวิวใช้ลิงก์ตรงๆ ตรรกะที่ไม่แตะเครือข่าย (หัวข้อ, ขนาดรูป, ย่อให้พอดีกรอบ) เป็นฟังก์ชันล้วนมีเทสต์

**Tech Stack:** Next.js (App Router) — ดู AGENTS.md; Supabase storage (signed URLs); pdfkit, docx, python-docx; เทสต์ด้วย `node --experimental-strip-types --test`

**Spec:** `docs/superpowers/specs/2026-11-16-memo-photo-attachment-design.md`

## Global Constraints

- โมดูลใน `src/lib` ที่เทสต์ import ต้องใช้ import แบบ relative พร้อมนามสกุล `.ts` (เช่น `"./model.ts"`); `@/` ใช้ได้เฉพาะ `import type` ในไฟล์ที่เทสต์ import
- ใช้เฉพาะรูปก่อนซ่อม (`image_urls`) ห้ามแตะ `after_image_urls`; ไม่มี SQL ใหม่
- คำบรรยายมาจากสถานที่ + ชื่อเรื่องที่ผู้แจ้งกรอกเท่านั้น ห้ามสร้างข้อความเอง; ชื่อเรื่องว่าง → ไม่มีคำบรรยาย
- หัวหน้าหน้าแนบ (ข้อความตรงตัว): `เอกสารแนบ: ภาพประกอบการแจ้งซ่อม`; รูปที่โหลดไม่ได้: `ไม่สามารถโหลดรูปนี้ได้`; เกินเพดาน: `แสดงรูปไม่ครบ ข้ามอีก {N} รูป`
- กรอบรูปสูงสุด กว้าง 7.6 cm × สูง 8.5 cm ย่อให้พอดีกรอบคงสัดส่วน ไม่ตัดรูป; 2 คอลัมน์; แถวไม่ถูกตัดข้ามหน้า; คำบรรยายตัวอักษร 12 pt; หน้าแนบเริ่มหน้าใหม่ ขอบกระดาษเดียวกับบันทึก
- ดาวน์โหลดรูป: พร้อมกันไม่เกิน 6, timeout 10 วินาที/รูป, เพดานรวม 80 รูป
- งานไม่มีรูป / บันทึกไม่ใช่เรื่องซ่อม / โหมดสาธิต → ไม่มีหน้าแนบ ไฟล์เหมือนเดิมทุกประการ
- ตรวจผลด้วย: `npm test`, `npx eslint <ไฟล์ที่แก้>`, `npx tsc --noEmit` (มี error เดิม `src/app/layout.tsx: Cannot find name 'LayoutProps'` ตรวจว่าไม่มี error ใหม่)
- commit ท้ายข้อความด้วย `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` และ `Claude-Session: https://claude.ai/code/session_018irRbtna7Tbx82wbTJjJFp`; ทำงานบน branch `claude/brave-newton-we3tsw`

## Review Focus

1. งานในบันทึกรวมที่ไม่มีรูป → ไม่มีกลุ่ม แต่เลข "ข้อ N" ของงานอื่นยังตรงกับ `position` (Task 1 เทสต์)
2. ลิงก์รูปโหลดไม่ได้ / timeout / ไบต์ที่ไม่ใช่ JPEG-PNG → ขึ้นกรอบ "ไม่สามารถโหลดรูปนี้ได้" ไฟล์ส่งออกไม่ล้ม (Task 2 เทสต์, Task 3–5 เทสต์)
3. รูปเกิน 80 → ตัดที่ 80 และบอกจำนวนที่ข้าม (Task 2 เทสต์)
4. รูปแนวตั้งยาวมาก/แนวนอนกว้างมาก → ย่อพอดีกรอบ ไม่ล้นคอลัมน์ (Task 2 เทสต์)
5. path ที่เซ็นลิงก์ไม่สำเร็จ (ไฟล์ถูกลบ) → ยังนับเป็นรูปและขึ้นกรอบโหลดไม่ได้ ไม่หายเงียบ (Task 1 เทสต์)

---

### Task 1: กลุ่มรูปและหัวข้อ (ฟังก์ชันล้วน)

**Files:**
- Modify: `src/lib/memo/model.ts` (เพิ่ม type), `src/lib/memo/draft.ts` (export `placeOfTicket`)
- Create: `src/lib/memo/photo-groups.ts`
- Test: `src/lib/memo/photo-groups.test.ts`

**Interfaces:**
- Produces (model.ts): `export interface MemoPhotoGroup { heading: string; urls: string[] }` — `heading` ว่าง = ไม่มีคำบรรยาย; `urls` ว่างสตริง = เซ็นลิงก์ไม่สำเร็จ
- Produces (draft.ts): `export const placeOfTicket: (t: Pick<TicketRow, "building" | "room" | "location_detail">) => string` (ของเดิม แค่ export และผ่อน type)
- Produces (photo-groups.ts):
  - `export interface PhotoTicket { title: string; location_detail: string | null; building: { name: string } | null; room: { name: string } | null; image_urls: string[] }`
  - `export function photoHeading(t: PhotoTicket, position?: number): string` — เดี่ยว: `{สถานที่} – {ชื่อเรื่อง}`; ระบุ `position`: `ข้อ {position} {สถานที่} – {ชื่อเรื่อง}`; ชื่อเรื่องว่าง (หลัง trim) → `""`
  - `export function buildPhotoGroups(entries: { position?: number; ticket: PhotoTicket }[], signed: Map<string, string>): MemoPhotoGroup[]` — ข้ามงานที่ `image_urls` ว่าง; `urls[i] = signed.get(path) ?? ""`

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว** ใน `photo-groups.test.ts` (ประกอบ ticket จำลองโดยตรง):
  - `photoHeading` เดี่ยว: อาคาร 2 + ห้อง "ห้อง 213" + title "หลอดไฟขาด" → `"อาคาร 2 ห้อง 213 – หลอดไฟขาด"`
  - ระบุ `position: 3` → ขึ้นต้น `"ข้อ 3 "`
  - ไม่มีห้อง ใช้ `location_detail`; ไม่มีทั้งคู่ → `"บริเวณโรงเรียน"` ตามหลัง/ตาม `placeOfTicket`
  - title `"  "` → `""`
  - `buildPhotoGroups`: entries position 1 (2 รูป), 2 (ไม่มีรูป), 3 (1 รูป) → 2 กลุ่ม heading ขึ้นต้น `ข้อ 1` และ `ข้อ 3` (ไม่ใช่ `ข้อ 2`)
  - path ที่ไม่อยู่ใน `signed` → `urls` ตำแหน่งนั้นเป็น `""` และความยาว `urls` เท่า `image_urls`
- [ ] **Step 2:** รัน `node --experimental-strip-types --test src/lib/memo/photo-groups.test.ts` ต้องล้ม (ไม่มีโมดูล)
- [ ] **Step 3:** เพิ่ม type ใน `model.ts`, export `placeOfTicket` ใน `draft.ts`, สร้าง `photo-groups.ts` ตาม Interfaces (import `placeOfTicket` จาก `"./draft.ts"`)
- [ ] **Step 4:** รันเทสต์ใหม่และ `npm test` ต้องผ่านทั้งหมด
- [ ] **Step 5:** commit `feat: photo groups and headings for the memo attachment`

---

### Task 2: ดาวน์โหลดรูปและอ่านขนาด

**Files:**
- Create: `src/lib/memo/photo-files.ts`
- Test: `src/lib/memo/photo-files.test.ts`

**Interfaces:**
- Consumes: `MemoPhotoGroup` (Task 1)
- Produces:
  - `export type LoadedPhoto = { data: Buffer; width: number; height: number; type: "jpg" | "png" } | { failed: true }`
  - `export interface LoadedPhotoGroup { heading: string; photos: LoadedPhoto[] }`
  - `export interface MemoPhotoPages { groups: LoadedPhotoGroup[]; omitted: number }`
  - `export const PHOTO_LIMIT = 80`
  - `export function imageSize(buf: Buffer): { width: number; height: number; type: "jpg" | "png" } | null` — อ่านหัวไฟล์ JPEG (SOF0–SOF15 ยกเว้น C4/C8/CC) และ PNG (IHDR); อย่างอื่น/ไฟล์ตัด → `null`
  - `export function fitWithin(width: number, height: number, maxWidth: number, maxHeight: number): { width: number; height: number }` — ย่อคงสัดส่วนให้พอดีกรอบ ไม่ขยายเกินขนาดจริงไม่จำเป็น (ย่อ/ขยายให้เต็มกรอบได้ ใช้ scale = min(maxW/w, maxH/h))
  - `export async function loadPhotoFiles(groups: MemoPhotoGroup[], fetchImpl?: typeof fetch): Promise<MemoPhotoPages>` — เพดาน `PHOTO_LIMIT` นับตามลำดับกลุ่ม ส่วนที่เกินไม่โหลดและนับใน `omitted`; กลุ่มที่เหลือรูปเป็น 0 หลังตัดไม่ต้องคืน; URL ว่าง, HTTP ไม่ ok, exception/timeout, `imageSize` เป็น `null` → `{ failed: true }`
- Constants ใช้ร่วม: `export const PHOTO_BOX_CM = { width: 7.6, height: 8.5 }`

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว** (ใช้ PNG/JPEG จำลองที่สร้างเองในเทสต์ — PNG ขนาด W×H ประกอบด้วย `zlib.deflateSync` + `zlib.crc32`; JPEG เป็นไบต์ขั้นต่ำ SOI + SOF0 ที่ระบุขนาด):
  - `imageSize` PNG 30×20 → `{ width: 30, height: 20, type: "png" }`; JPEG ที่ SOF0 ระบุ 40×60 (มี APP0 นำหน้า) → `{40, 60, "jpg"}`; ไบต์สุ่ม/ว่าง → `null`
  - `fitWithin(3000, 4000, 7.6, 8.5)` สูงเท่า 8.5 และกว้าง ≤ 7.6; `fitWithin(4000, 1000, 7.6, 8.5)` กว้างเท่า 7.6; ผลคงสัดส่วน
  - `loadPhotoFiles` ด้วย fetch จำลอง: 2 กลุ่ม (2+1 รูป) → ลำดับรูปเดิม, รูปที่ fetch โยน exception / `ok:false` / URL `""` / ไบต์ไม่ใช่รูป เป็น `{ failed: true }` และไม่โยน
  - 85 รูปใน 2 กลุ่ม → รวมรูปที่คืน = 80, `omitted = 5`, fetch ถูกเรียก 80 ครั้ง
  - ความพร้อมกัน: fetch จำลองนับจำนวนที่ค้างพร้อมกัน ต้องไม่เกิน 6
- [ ] **Step 2:** รันเทสต์ ต้องล้ม
- [ ] **Step 3:** implement ตาม Interfaces; timeout ด้วย `AbortSignal.timeout(10_000)`; ความพร้อมกันด้วยคิวตัวทำงาน 6 ตัว (ไม่เพิ่ม dependency)
- [ ] **Step 4:** รันเทสต์และ `npm test` ต้องผ่าน
- [ ] **Step 5:** commit `feat: download memo photos and read image sizes`

---

### Task 3: หน้าแนบใน PDF

**Files:**
- Modify: `src/lib/memo/pdf.ts` (`memoToPdf(doc, photos?)`)
- Test: `src/lib/memo/pdf.test.ts`

**Interfaces:**
- Consumes: `MemoPhotoPages`, `fitWithin`, `PHOTO_BOX_CM` (Task 2)
- Produces: `export function memoToPdf(doc: MemoDoc, photos?: MemoPhotoPages): Promise<Buffer>` — ไม่ส่ง/ไม่มีรูป = ผลเหมือนเดิม

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว** (เพิ่มใน `pdf.test.ts`; นับหน้าด้วย `/\/Type \/Page[^s]/g`):
  - ไม่ส่ง `photos` กับส่ง `{ groups: [], omitted: 0 }` → จำนวนหน้าเท่ากัน
  - 4 รูป PNG จำลอง (หัวข้อกลุ่มเดียว) → หน้ามากกว่าไม่มีรูป 1 หน้า
  - 1 รูป `{ failed: true }` → ไม่โยนและหน้าเพิ่ม 1
  - 12 รูปแนวตั้ง 3:4 → หน้าแนบมากกว่า 1 หน้า (แถวไม่ถูกตัด: ไม่เช็คตำแหน่ง แค่ไม่โยน)
- [ ] **Step 2:** รันเทสต์ ต้องล้ม
- [ ] **Step 3:** หลังบล็อกลายเซ็น/ความเห็นเดิม (ก่อน `pdf.end()`) ถ้ามีรูป: `addPage()` รีเซ็ต `y = M.top` วางหัวข้อตรงกลางตัวหนา; ต่อด้วยกริด 2 คอลัมน์ (ช่องว่างระหว่างคอลัมน์ = ความกว้างเนื้อหา − 2×7.6 cm) แต่ละแถว: คำนวณความสูง = สูงสุดของรูปในแถว + คำบรรยาย (ห่อด้วย `wrap` ที่ 12 pt) แล้ว `ensure(rowHeight)`; รูปวางตรงกลางกรอบด้วย `pdf.image(data, x, y, fit)`; `failed` วาดกรอบเส้นประสูง 3 cm พร้อมข้อความ; ท้ายสุดถ้า `omitted > 0` พิมพ์บรรทัดแจ้ง; heading ที่เป็นสตริงว่างไม่พิมพ์ใต้รูป
- [ ] **Step 4:** รันเทสต์และ `npm test` ต้องผ่าน
- [ ] **Step 5:** commit `feat: attach repair photos to the PDF memo`

---

### Task 4: หน้าแนบใน Word (docx-js สำรอง)

**Files:**
- Modify: `src/lib/memo/docx.ts` (`memoToDocx(doc, photos?, options?)`)
- Test: `src/lib/memo/docx.test.ts`

**Interfaces:**
- Consumes: `MemoPhotoPages`, `fitWithin`, `PHOTO_BOX_CM` (Task 2)
- Produces: `export async function memoToDocx(doc: MemoDoc, photos?: MemoPhotoPages, options?: Options): Promise<Buffer>` — **ลำดับพารามิเตอร์เปลี่ยน** (เดิม `options` เป็นตัวที่ 2); ผู้เรียกเดิมใน `docx/route.ts` และเทสต์ต้องตามไป

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว** (เพิ่มใน `docx.test.ts`):
  - ไม่ส่ง `photos` → รายการไฟล์ใน `word/media/` เท่าเดิม (ตราครุฑ 1 ไฟล์)
  - 3 รูป PNG จำลอง → `word/media/` มี 4 ไฟล์ และ `document.xml` มีข้อความ `เอกสารแนบ: ภาพประกอบการแจ้งซ่อม` กับ heading ของกลุ่ม
  - รูป `failed` → มีข้อความ `ไม่สามารถโหลดรูปนี้ได้` และไม่เพิ่มไฟล์ใน `word/media/`
  - `omitted: 5` → มีข้อความ `แสดงรูปไม่ครบ ข้ามอีก 5 รูป`
  - เทสต์เดิม "body text is 14 pt … ["28","40"]" และ "no folder entries" ยังผ่านเมื่อไม่มีรูป
- [ ] **Step 2:** รันเทสต์ ต้องล้ม
- [ ] **Step 3:** ต่อท้ายหลัง `children` เดิม (ก่อนสร้าง `Document`): ย่อหน้าหัวเรื่องจัดกลางตัวหนา `pageBreakBefore: true`; ตารางไร้เส้น 2 คอลัมน์ (กว้าง 7.6 + 7.6 + ช่องว่าง = 16 cm) แต่ละแถว `cantSplit: true` ในเซลล์: ย่อหน้ารูป (`ImageRun`, `type` จาก `LoadedPhoto.type`, ขนาดพิกเซลที่ 96 dpi จาก `fitWithin` ในหน่วย cm) และย่อหน้าคำบรรยายขนาด 12 pt (`size: 24`); `failed` ใช้ย่อหน้าข้อความแทนรูป; เซลล์ว่างเติมเมื่อรูปเป็นเลขคี่; ตาราง 1 ตารางต่อกลุ่มเพื่อให้คำบรรยายแยกกลุ่ม
- [ ] **Step 4:** รันเทสต์และ `npm test` ต้องผ่าน
- [ ] **Step 5:** commit `feat: attach repair photos to the docx-js memo`

---

### Task 5: หน้าแนบใน Word (python-docx ตัวหลัก)

**Files:**
- Modify: `scripts/memo_docx.py`, `src/lib/memo/docx-python.ts`
- Test: `src/lib/memo/docx-python.test.ts` (ใหม่; ข้ามอัตโนมัติถ้าไม่มี python-docx)

**Interfaces:**
- Consumes: `MemoPhotoPages` (Task 2)
- Produces: `export function memoToDocxPython(doc: MemoDoc, photos?: MemoPhotoPages, timeoutMs = 30_000): Promise<Buffer>` — **ลำดับพารามิเตอร์เปลี่ยน**; JSON ที่ส่งเข้า stdin เพิ่มคีย์ `photos: { groups: [{ heading, photos: [{ data: <base64>, width, height } | { failed: true }] }], omitted }` (ไม่มีรูป → ไม่ส่งคีย์นี้)

- [ ] **Step 1: เขียนเทสต์ที่ล้มเหลว** (`docx-python.test.ts`, ใช้ `test.skip`/ตรวจ `python3 -c "import docx"` ก่อน):
  - ไม่ส่ง `photos` → `word/media/` 1 ไฟล์ (ตราครุฑ)
  - 3 รูป → `word/media/` 4 ไฟล์ และ `document.xml` มีข้อความหัวหน้าหน้าแนบกับ heading; `failed` → มีข้อความโหลดไม่ได้; `omitted` → ข้อความแจ้งข้าม
- [ ] **Step 2:** รันเทสต์ ต้องล้ม
- [ ] **Step 3:** `docx-python.ts`: เพิ่มพารามิเตอร์ แปลง `Buffer` เป็น base64 ตอน `JSON.stringify`. `memo_docx.py` ฟังก์ชันใหม่ `add_photo_pages(doc, photos)` เรียกต่อจากส่วนลายเซ็นก่อน `doc.core_properties`: ย่อหน้าหัวเรื่องจัดกลางตัวหนา `page_break_before = True`; ตารางไร้เส้น 2 คอลัมน์ต่อกลุ่ม แถวใส่ `w:cantSplit`; รูปผ่าน `add_picture` โดยคำนวณ cm ด้วยสูตรเดียวกับ `fitWithin` (scale = min(7.6/w, 8.5/h)); คำบรรยาย 12 pt ผ่าน `add_text`; ภาพถูกถอดรหัส base64 เป็น `io.BytesIO`
- [ ] **Step 4:** รันเทสต์และ `npm test` ต้องผ่าน; ถ้ามี LibreOffice ให้แปลงไฟล์ที่ได้เป็น PDF เพื่อดูว่าเปิดได้และหน้ารูปอยู่หน้าใหม่ (ไม่มี → รายงานว่าไม่ได้ลอง)
- [ ] **Step 5:** commit `feat: attach repair photos to the python-docx memo`

---

### Task 6: ตัวโหลดรูปและเส้นทางส่งออก

**Files:**
- Create: `src/lib/data/memo-photos.ts`
- Modify: `src/app/(dashboard)/memos/[id]/pdf/route.ts`, `src/app/(dashboard)/memos/[id]/docx/route.ts`

**Interfaces:**
- Consumes: `buildPhotoGroups`, `PhotoTicket` (Task 1); `loadPhotoFiles` (Task 2); ตัวสร้างไฟล์ 3 ตัว (Task 3–5); `getSession` จาก `@/lib/data/session`
- Produces: `export async function getMemoPhotos(memo: { id: string; origin_module: string; reference_id: string | null }): Promise<MemoPhotoGroup[]>`

- [ ] **Step 1:** implement `getMemoPhotos`: `origin_module !== "repair"` / ไม่มี Supabase / ไม่มี session → `[]`. มี `reference_id` → โหลดงานนั้น (`id, title, location_detail, image_urls, building:buildings(name), room:rooms(name)`) เป็น 1 entry ไม่มี `position`; ไม่มี → `memo_tickets` ที่ `memo_id = memo.id` เรียง `position` พร้อม `ticket:repair_tickets(...)` เดียวกัน เป็น entries ที่มี `position`. ลิงก์: `createSignedUrls(allPaths, 3600)` ครั้งเดียวบนบัคเก็ต `repair-images` แล้วทำ `Map<path, signedUrl>` จากรายการที่ `signedUrl` มีค่า; ส่งเข้า `buildPhotoGroups`. error/exception ใดๆ → `console.warn` แล้วคืน `[]`
- [ ] **Step 2:** เส้นทางส่งออกทั้งสอง: หลัง `getMemo` เรียก `getMemoPhotos(memo)` แล้ว `loadPhotoFiles(groups)` ส่งต่อให้ตัวสร้างไฟล์ (แก้การเรียก `memoToDocxPython(doc, photos)` / `memoToDocx(doc, photos)` / `memoToPdf(doc, photos)`)
- [ ] **Step 3:** `npx tsc --noEmit` ไม่มี error ใหม่; `npx eslint` ไฟล์ที่แก้ผ่าน; `npm test` ผ่าน (ไม่มีเทสต์ใหม่: ไฟล์นี้ต่อกับ Supabase ซึ่งไม่ได้รันในสภาพแวดล้อมนี้ ให้ระบุในรายงานท้ายงาน)
- [ ] **Step 4:** commit `feat: load repair photos for memo exports`

---

### Task 7: พรีวิวบนหน้าจอ

**Files:**
- Modify: `src/components/memos/memo-preview.tsx`, `src/components/memos/memo-editor.tsx`, `src/app/(dashboard)/memos/[id]/page.tsx`

**Interfaces:**
- Consumes: `MemoPhotoGroup` (Task 1), `getMemoPhotos` (Task 6)
- Produces: `MemoPreview` รับ prop ใหม่ `photos?: MemoPhotoGroup[]`; `MemoEditor` รับ `photos: MemoPhotoGroup[]` ส่งต่อ

- [ ] **Step 1:** `page.tsx`: หลังตรวจ `memo` เรียก `getMemoPhotos(memo)` แล้วส่ง `photos` ให้ `MemoEditor` → `MemoPreview`
- [ ] **Step 2:** `MemoPreview`: ถ้า `photos` มีกลุ่ม แสดงหน้า A4 ที่สองใต้หน้าบันทึก (สไตล์เดียวกัน: พื้นขาว เงา `min-height` เท่าสัดส่วน A4 ให้ยาวตามจำนวนรูป ไม่ตัดหน้า) หัวเรื่อง `เอกสารแนบ: ภาพประกอบการแจ้งซ่อม` กริด 2 คอลัมน์ รูป `object-contain` ในกรอบสัดส่วนเดียวกับ 7.6×8.5 พร้อม `alt` เป็น heading (ว่าง → `รูปประกอบการแจ้งซ่อม`) คำบรรยายใต้รูป; `url` เป็น `""` แสดงกรอบพร้อมข้อความ `ไม่สามารถโหลดรูปนี้ได้`. ใช้หน่วย `cqw` เหมือนส่วนเดิม และ `<img>` ธรรมดาพร้อมคอมเมนต์ปิด eslint `@next/next/no-img-element` เหมือนตราครุฑ
- [ ] **Step 3:** `npx tsc --noEmit`, `npx eslint` ไฟล์ที่แก้, `npm test` ผ่าน; ถ้ารัน dev server ได้ให้เปิดหน้าบันทึกในโหมดสาธิตดูว่าหน้าเดิมไม่เปลี่ยน (โหมดสาธิตไม่มีรูปจึงไม่เห็นหน้าแนบ — ระบุในรายงาน)
- [ ] **Step 4:** commit `feat: show the repair photo attachment in the memo preview`

---

## Self-Review

- Spec §4 ครบ: ตัวโหลด (T6), โมเดล (T1), ดาวน์โหลดไบต์ (T2), เส้นทางส่งออก (T6), หน้าตาหน้าแนบ + ตัวสร้าง 3 ตัว (T3–5), พรีวิว (T7); §5 การทดสอบกระจายอยู่ในแต่ละ task
- ลำดับพารามิเตอร์เปลี่ยนที่ `memoToDocx` / `memoToDocxPython` ถูกระบุใน Interfaces พร้อมผู้เรียกที่ต้องตาม
- ชื่อที่ใช้ข้าม task ตรงกัน: `MemoPhotoGroup`, `LoadedPhoto`, `MemoPhotoPages`, `fitWithin`, `PHOTO_BOX_CM`, `PHOTO_LIMIT`
