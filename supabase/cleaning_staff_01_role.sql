-- Role "cleaning_staff" (เจ้าหน้าที่เขตทำความสะอาด), part 01 of 02: the enum value only.
-- Run this file ON ITS OWN first, then run cleaning_staff_02_policies.sql.
-- A new enum value cannot be used in the same transaction that adds it, so the two files must be
-- two separate runs. Safe to run again: IF NOT EXISTS makes a second run do nothing.
--
-- วิธีรัน: วางไฟล์นี้ไฟล์เดียวใน Supabase SQL Editor แล้วกด Run (ต้องขึ้น "Success")
-- จากนั้นค่อยเปิดไฟล์ cleaning_staff_02_policies.sql แล้วรันแยกอีกครั้ง ห้ามรวมสองไฟล์รันพร้อมกัน
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'cleaning_staff';
