-- เพิ่มอาคาร 4, อาคาร 5 และอาคารนาฏศิลป์ (BLD-04/05 เดิมคือโรงอาหาร/อาคารเกษตร จึงใช้รหัสถัดไป)
-- รันซ้ำได้ไม่ซ้ำแถว: ON CONFLICT (code) DO NOTHING
-- วิธีรัน: วางใน Supabase SQL Editor แล้วกด Run
INSERT INTO buildings (code, name, floor_count) VALUES
  ('BLD-06', 'อาคาร 4', 1),
  ('BLD-07', 'อาคาร 5', 1),
  ('BLD-08', 'อาคารนาฏศิลป์', 1)
ON CONFLICT (code) DO NOTHING;
