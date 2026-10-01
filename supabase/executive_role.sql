-- Role "executive" (ผู้บริหาร): sees the summary page only, through executive_summary() below.
-- Apply on its own: a new enum value cannot be used in the same transaction.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'executive';
