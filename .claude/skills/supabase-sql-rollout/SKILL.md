---
name: supabase-sql-rollout
description: Use when editing supabase/*.sql before merging.
category: database
---

# Run a new Supabase SQL file before merging the code that uses it

When a PR adds a table or function under `supabase/*.sql` and app code (or `BACKUP_TABLES` in `src/lib/backup.ts`) depends on it, the SQL must be applied to the live database before the PR merges. Otherwise the page errors and the nightly backup fails on the missing table.

- Before merge, tell the user the order: run the SQL in the Supabase SQL Editor, run the check block at the end of the file, then merge.
- Never claim the SQL works from reading it alone. Say it was reviewed against `supabase/schema.sql` and the RLS files, and has not run against a real database.
- Keep the file idempotent where possible (`create table if not exists`, `create or replace function`).
- Each new table in `BACKUP_TABLES` needs an ORDER_BY entry, and restore must handle it with `on conflict do nothing`.
