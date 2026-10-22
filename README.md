# school-facility-app
## Export บันทึกข้อความ เป็น Word

ปุ่ม Export Word สร้างไฟล์ด้วย `scripts/memo_docx.py` (python-docx + pythainlp ตามสกิล thai-docx เพื่อให้ตัดคำไทยเต็มบรรทัด) ต้องมี Python บนเครื่องที่รันแอป:

```bash
pip install -r scripts/requirements.txt
```

ถ้าไม่มี Python (เช่น deploy แบบ serverless) แอปจะสลับไปใช้ตัวสร้าง Node (`src/lib/memo/docx.ts`) อัตโนมัติ ผลลัพธ์ตัดคำละเอียดกว่าเล็กน้อย ตั้ง `PYTHON_BIN` ถ้า Python ไม่ได้ชื่อ `python3` Export PDF ไม่ต้องใช้ Python

## ระบบขอใช้ห้องประชุม

ต้องรัน `supabase/meeting_rooms.sql` ใน Supabase SQL Editor หนึ่งครั้ง (หลัง `schema.sql`) ก่อนใช้งานกับข้อมูลจริง ไฟล์นี้มี SQL ที่ให้มา (คอลัมน์ `requires_approval`, `equipment`, view `v_live_room_status`) ตามด้วยส่วนเสริม: ห้ามจองซ้อน, ให้ฐานข้อมูลกำหนดสถานะ pending/approved ตามห้อง, สิทธิ์อ่านตารางจอง, สิทธิ์ร่างบันทึกข้อความ, Realtime และข้อมูลห้องตัวอย่าง ตั้ง `requires_approval` ของแต่ละห้องใน Table Editor

ก่อนรันไฟล์นี้ แดชบอร์ดยังใช้งานได้ (การ์ดห้องประชุมว่าง) และหน้า `/meeting-rooms` แสดงข้อมูลตัวอย่าง

## ล้างรูปที่ค้างใน storage

รูปที่ผู้ใช้อัปโหลดแล้วไม่ได้ส่งเรื่องจะค้างใน bucket `repair-images` endpoint `GET /api/cron/cleanup-images` ลบรูปที่ไม่มีงานแจ้งซ่อมใดอ้างถึงและเก่ากว่า 24 ชั่วโมง (รูปที่เพิ่งอัปโหลดไม่ถูกแตะ)

- ตั้ง `CRON_SECRET` (สตริงสุ่มยาว ๆ เช่น `openssl rand -hex 32`) และ `SUPABASE_SECRET_KEY` บนเซิร์ฟเวอร์ ถ้าไม่ตั้ง `CRON_SECRET` endpoint จะตอบ 503 และไม่ทำงาน
- เรียกด้วยหัว `Authorization: Bearer <CRON_SECRET>` ตัวเลือก `?dryRun=1` ดูรายการที่จะลบโดยไม่ลบ, `?minAgeMinutes=N` เปลี่ยนช่วงปลอดภัย (ค่าเริ่มต้น 1440)
- `vercel.json` ตั้ง Vercel Cron ให้รันทุกวัน 03:00 เวลาไทย (Vercel ส่ง `CRON_SECRET` ให้เอง) ถ้าไม่ได้ใช้ Vercel ให้ตั้งตัวจับเวลาอื่นเรียก URL เดียวกัน เช่น GitHub Actions หรือ cron บนเซิร์ฟเวอร์

## โมดูลงานอาคารสถานที่

**แผนที่เมนู:** แจ้งซ่อม, จองห้อง/ห้องประชุม, บันทึกข้อความ, เขตทำความสะอาด (ครูที่ปรึกษายืนยันพื้นที่รับผิดชอบรายวัน เจ้าหน้าที่ดูช่องว่างที่ยังไม่ยืนยัน), ตั้งค่า/นำเข้าข้อมูล (ห้องเรียน ครูที่ปรึกษา วันหยุด)

**บทบาท:**
- `super_admin` ผู้ดูแลระบบ
- `head` หัวหน้ากลุ่มงาน
- `staff` เจ้าหน้าที่งาน
- `room_staff` เจ้าหน้าที่ห้องประชุม
- `executive` ผู้บริหาร
- `user` ผู้ใช้ทั่วไป

**ลำดับรัน SQL ใน Supabase SQL Editor:**
1. `supabase/facility_01_head_role.sql` รันแยกเดี่ยว ๆ ก่อน (เพิ่มค่า role `head` ต้อง commit ก่อนใช้)
2. `supabase/facility_02_cleaning.sql`
3. `supabase/executive_role.sql` (ถ้ายังไม่เคยรัน) รันแยกเดี่ยว ๆ เพราะเพิ่มค่า role `executive` ต้อง commit ก่อนใช้ — เป็นสิ่งที่ต้องมีก่อนไฟล์ถัดไป
4. `supabase/control_01.sql` (โมดูลควบคุมภายใน) รันหลัง facility_02 แล้ววางทั้งไฟล์รันครั้งเดียว ส่วน "ชุดตรวจสอบ" ท้ายไฟล์เป็นคอมเมนต์ ให้คัดลอกไปรันทีละชุดภายหลัง
5. `supabase/control_02.sql` (ผลประเมิน ปค.4) รันหลัง control_01 แล้ววางทั้งไฟล์รันครั้งเดียว ส่วน "ชุดตรวจสอบ" ท้ายไฟล์เป็นคอมเมนต์ ให้คัดลอกไปรันทีละชุดภายหลัง
6. ชุดตรวจสอบ (check sets) ของ `facility_02_cleaning.sql`, `control_01.sql` และ `control_02.sql`
7. `supabase/facility_99_reset_old_data.sql` รันเฉพาะตอนสลับขึ้นระบบจริง หลังสำรองข้อมูลด้วย `/api/cron/backup` แล้ว (ลบเฉพาะแถวข้อมูลเก่า)

**คำเตือน:** `src/lib/backup.ts` อ่านตารางของโมดูลควบคุมภายใน (`control_missions`, `control_projects`, `control_actions`) ด้วย ต้องรัน `supabase/control_01.sql` **ก่อน** deploy โค้ดชุดนี้ (หรือรันทันทีที่ deploy เสร็จ) ถ้ายังไม่มีตาราง การสำรองข้อมูลประจำคืนจะล้มเหลวจนกว่าจะรันไฟล์นี้ เช่นเดียวกัน `src/lib/backup.ts` อ่านตาราง `control_assessments` ด้วย ต้องรัน `supabase/control_02.sql` **ก่อน** deploy โค้ดที่อ่านตารางนี้ (หรือรันทันทีที่ deploy เสร็จ) ไม่งั้นการสำรองข้อมูลประจำคืนจะล้มเหลวเช่นกัน

**Vercel env ที่ไม่ต้องใช้แล้ว (ลบได้):** `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (ถอด Web Push ออกแล้ว)
