# สำรองข้อมูลทุกคืนไป Google Drive

ทุกคืนเวลา 03:30 น. (เวลาไทย) ระบบดึงตารางงานซ่อม การจอง บันทึกข้อความ ผู้ใช้ และความคิดเห็น ออกมา บีบอัด **เข้ารหัส AES-256** แล้วอัปโหลดไปโฟลเดอร์ Google Drive ของโรงเรียน (`lrp-backup-YYYY-MM-DD.bin`) เก็บ 60 วัน อย่างน้อย 14 ไฟล์ล่าสุดเสมอ

ไม่รวมรูปถ่าย (เก็บใน Supabase Storage) และรหัสผ่านผู้ใช้ (เก็บในระบบยืนยันตัวตนของ Supabase)

## ตั้งค่าครั้งเดียว

1. **สร้างโฟลเดอร์ใน Google Drive** (ใช้บัญชี @lrp.ac.th) เช่น "สำรองระบบแจ้งซ่อม" เปิดโฟลเดอร์แล้วคัดลอกรหัสท้าย URL (`.../folders/<รหัสนี้>`) → `GOOGLE_DRIVE_FOLDER_ID`
2. **สร้าง OAuth client** ที่ Google Cloud Console → APIs & Services
   - เปิดใช้ *Google Drive API*
   - Credentials → Create credentials → OAuth client ID → ชนิด *Web application*
   - Authorized redirect URIs: `https://developers.google.com/oauthplayground`
   - เก็บ Client ID → `GOOGLE_OAUTH_CLIENT_ID`, Client secret → `GOOGLE_OAUTH_CLIENT_SECRET`
   - (ใช้ client ตัวเดียวกับการล็อกอินด้วย Google ได้ ถ้าเพิ่ม redirect URI ของ Supabase ไว้ด้วย)
3. **ขอ refresh token** ที่ <https://developers.google.com/oauthplayground>
   - กดเฟือง ⚙ → ติ๊ก *Use your own OAuth credentials* ใส่ Client ID/secret ข้างบน
   - Step 1 เลือก scope `https://www.googleapis.com/auth/drive.file` → Authorize APIs → เข้าด้วยบัญชีโรงเรียนที่เป็นเจ้าของโฟลเดอร์
   - Step 2 กด *Exchange authorization code for tokens* → คัดลอก **Refresh token** → `GOOGLE_OAUTH_REFRESH_TOKEN`
   - scope `drive.file` เห็นเฉพาะไฟล์ที่ระบบสร้างเอง แต่ต้องให้โฟลเดอร์ปลายทางเป็นโฟลเดอร์ที่แอปนี้เข้าถึงได้ ถ้าอัปโหลดไม่ผ่านด้วย 404 ให้ใช้ scope `https://www.googleapis.com/auth/drive` แทน
4. **สร้างกุญแจเข้ารหัส**: `openssl rand -hex 32` → `BACKUP_ENCRYPTION_KEY` (**เก็บสำเนาไว้ที่ปลอดภัยแยกจากระบบ** ถ้าทำกุญแจหาย ไฟล์สำรองทุกไฟล์เปิดไม่ได้)
5. ใส่ตัวแปรทั้ง 5 ตัวใน Vercel → Project → Settings → Environment Variables (Production) แล้ว redeploy

## ทดสอบ

```
curl -H "Authorization: Bearer $CRON_SECRET" "https://<เว็บของโรงเรียน>/api/cron/backup?dryRun=1"
```
ได้ `{"dryRun":true,"bytes":...,"counts":{...}}` แปลว่าอ่านฐานข้อมูลและเข้ารหัสได้ จากนั้นเรียกซ้ำโดยไม่มี `?dryRun=1` ดูว่ามีไฟล์ขึ้นใน Drive

## กู้คืน

1. ดาวน์โหลดไฟล์ `.bin` ล่าสุดจาก Drive
2. ถอดรหัสเป็น SQL:
   ```
   BACKUP_ENCRYPTION_KEY=<กุญแจ> node scripts/restore-backup.mjs lrp-backup-2026-10-02.bin --sql > restore.sql
   ```
   (หรือไม่ใส่ `--sql` เพื่อได้ JSON ไว้ตรวจดู)
3. เปิด Supabase → SQL Editor วางเนื้อหา `restore.sql` แล้วรัน คำสั่งใส่เฉพาะแถวที่ขาดหายและไม่แตะแถวที่มีอยู่
4. โปรไฟล์ผู้ใช้จะกลับมาเฉพาะคนที่ยังมีบัญชีเข้าสู่ระบบอยู่ ถ้าโปรเจกต์ Supabase หายทั้งหมด ผู้ใช้ต้องสมัครใหม่และผู้ดูแลตั้งบทบาทให้อีกครั้ง

**ควรลองกู้คืนลงโปรเจกต์ทดสอบอย่างน้อยหนึ่งครั้งหลังตั้งค่าเสร็จ** เพราะไฟล์สำรองที่ไม่เคยลองกู้คืนยังไม่ใช่ความมั่นใจจริง
