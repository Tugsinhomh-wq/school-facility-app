#!/usr/bin/env node
// Decrypts a backup file made by /api/cron/backup and prints it as JSON or as SQL.
//
//   BACKUP_ENCRYPTION_KEY=<64 hex> node scripts/restore-backup.mjs lrp-backup-2026-10-02.bin            > backup.json
//   BACKUP_ENCRYPTION_KEY=<64 hex> node scripts/restore-backup.mjs lrp-backup-2026-10-02.bin --sql      > restore.sql
//
// The SQL inserts the rows that are missing (ON CONFLICT DO NOTHING), parents before children, so it can be
// run in the Supabase SQL editor after data was lost. Profiles are only restored for people who still have an
// auth account; anyone else has to sign up again and be given their role.

import { createDecipheriv } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const [file, flag] = process.argv.slice(2);
const keyHex = process.env.BACKUP_ENCRYPTION_KEY;
if (!file || !keyHex) {
  console.error("usage: BACKUP_ENCRYPTION_KEY=<hex> node scripts/restore-backup.mjs <file.bin> [--sql]");
  process.exit(1);
}

const data = readFileSync(file);
if (data.subarray(0, 6).toString() !== "LRPBK1") throw new Error("not a backup file");
const decipher = createDecipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), data.subarray(6, 18));
decipher.setAuthTag(data.subarray(18, 34));
const backup = JSON.parse(gunzipSync(Buffer.concat([decipher.update(data.subarray(34)), decipher.final()])).toString());

if (flag !== "--sql") {
  console.log(JSON.stringify(backup, null, 2));
} else {
  const lines = [`-- Backup taken ${backup.createdAt}`, "begin;"];
  for (const [table, rows] of Object.entries(backup.tables)) {
    if (!rows.length) continue;
    const json = JSON.stringify(rows).replace(/'/g, "''");
    const filter = table === "profiles" ? " where exists (select 1 from auth.users u where u.id = r.id)" : "";
    lines.push(`insert into public.${table} select r.* from jsonb_populate_recordset(null::public.${table}, '${json}'::jsonb) r${filter} on conflict do nothing;`);
  }
  lines.push("commit;");
  console.log(lines.join("\n"));
}
