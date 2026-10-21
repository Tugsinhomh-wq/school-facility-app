-- Facility module, part 01 of 02: role "head" (หัวหน้ากลุ่มงาน), who can do everything staff can.
-- Run this file ON ITS OWN first, then run facility_02_cleaning.sql.
-- A new enum value cannot be used in the same transaction that adds it, so the two files must be
-- two separate runs. Safe to run again: IF NOT EXISTS makes a second run do nothing.
--
-- วิธีรัน: วางไฟล์นี้ไฟล์เดียวใน Supabase SQL Editor แล้วกด Run (ต้องขึ้น "Success")
-- จากนั้นค่อยเปิดไฟล์ facility_02_cleaning.sql แล้วรันแยกอีกครั้ง ห้ามรวมสองไฟล์รันพร้อมกัน
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'head';
