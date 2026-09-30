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
