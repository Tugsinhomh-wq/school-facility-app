-- ตัวเลือก "อื่นๆ (นอกอาคาร)" ในฟอร์มแจ้งซ่อม สำหรับสถานที่ที่ไม่อยู่ในรายการอาคาร (เช่น สนาม ลานจอดรถ รั้ว)
-- repair_tickets.building_id บังคับมีค่า จึงต้องมีอาคารจริงหนึ่งแถว รหัสขึ้นต้น OTHER- ให้แอปรู้ว่าเป็นตัวเลือกนี้
-- รันซ้ำได้ไม่ซ้ำแถว: ON CONFLICT (code) DO NOTHING
-- วิธีรัน: วางใน Supabase SQL Editor แล้วกด Run
INSERT INTO buildings (code, name, floor_count) VALUES
  ('OTHER-01', 'อื่นๆ (นอกอาคาร)', 1)
ON CONFLICT (code) DO NOTHING;
