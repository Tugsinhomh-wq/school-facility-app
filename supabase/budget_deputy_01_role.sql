-- Role "budget_deputy" (รองผู้อำนวยการฝ่ายงบประมาณ): reads the open repairs and talks with the facility staff in a comment thread.
-- Run this file ON ITS OWN first (a new enum value cannot be used in the same transaction that adds it),
-- then run budget_deputy_02_comments.sql, then executive_summary.sql again. Safe to run again.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'budget_deputy';
