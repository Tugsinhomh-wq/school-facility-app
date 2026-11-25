---
name: supabase-sql-rollout
description: Use when editing supabase/*.sql before merging.
category: database
---

# Run a new Supabase SQL file before merging the code that uses it

When a PR adds a table or function under `supabase/*.sql` and app code (or `BACKUP_TABLES` in `src/lib/backup.ts`) depends on it, the SQL must be applied to the live database before the PR merges. Otherwise the page errors and the nightly backup fails on the missing table.

- Before merge, tell the user the order: run the SQL in the Supabase SQL Editor, run the check block at the end of the file, then merge.
- Never claim the SQL works from reading it alone. Say it was reviewed against `supabase/schema.sql` and the RLS files, and has not run against a real database.
- If you did run it on a throwaway Postgres with stub tables, say exactly that and state that RLS, auth and the real sequence generator were not exercised. Do not describe that run as verified against the database, and keep the claim the same in the commit, the ledger and the final report.
- When the app code calls a function whose behavior changed (for example a relaxed check), the SQL must be applied before that code ships. Shipping the code first gives users a generic failure, so put the SQL step first in the order you give the user.
- Keep the file idempotent where possible (`create table if not exists`, `create or replace function`).
- Each new table in `BACKUP_TABLES` needs an ORDER_BY entry, and restore must handle it with `on conflict do nothing`.
- Also record the new table in the backup description in `docs/backup.md`: name the SQL file that creates it, state that it must run before the code that reads it deploys (or right after), and say what happens to the next backup if it has not run. A read-only marker table (for example a per-user last-read timestamp) is left out of the backup, and the doc says so.
