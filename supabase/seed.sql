-- Starting buildings and rooms. Edit names to match the real campus.
INSERT INTO buildings (code, name, floor_count) VALUES
  ('BLD-01', 'อาคาร 1', 3),
  ('BLD-02', 'อาคาร 2', 3),
  ('BLD-03', 'อาคาร 3', 3),
  ('BLD-04', 'โรงอาหาร', 1),
  ('BLD-05', 'อาคารเกษตร', 1),
  ('GRD-01', 'สนามและบริเวณโรงเรียน', 1);

INSERT INTO rooms (building_id, room_number, name, capacity, is_bookable)
SELECT b.id, r.room_number, r.name, r.capacity, r.is_bookable
FROM (VALUES
  ('BLD-01', '108', 'ห้องเรียน 108', 40, false),
  ('BLD-01', '112', 'ห้องเรียน 112', 40, false),
  ('BLD-02', 'T01', 'ห้องพักครู', 30, false),
  ('BLD-02', 'MTG-01', 'ห้องประชุม', 40, true),
  ('BLD-03', '301', 'ห้องคอมพิวเตอร์', 40, true),
  ('BLD-04', 'CAN-01', 'โรงอาหาร', 300, true)
) AS r(code, room_number, name, capacity, is_bookable)
JOIN buildings b ON b.code = r.code;
