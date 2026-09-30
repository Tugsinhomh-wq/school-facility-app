# school-facility-app
## Export บันทึกข้อความ เป็น Word

ปุ่ม Export Word สร้างไฟล์ด้วย `scripts/memo_docx.py` (python-docx + pythainlp ตามสกิล thai-docx เพื่อให้ตัดคำไทยเต็มบรรทัด) ต้องมี Python บนเครื่องที่รันแอป:

```bash
pip install -r scripts/requirements.txt
```

ถ้าไม่มี Python (เช่น deploy แบบ serverless) แอปจะสลับไปใช้ตัวสร้าง Node (`src/lib/memo/docx.ts`) อัตโนมัติ ผลลัพธ์ตัดคำละเอียดกว่าเล็กน้อย ตั้ง `PYTHON_BIN` ถ้า Python ไม่ได้ชื่อ `python3` Export PDF ไม่ต้องใช้ Python
