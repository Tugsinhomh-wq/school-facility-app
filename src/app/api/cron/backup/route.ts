import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import {
  checksum,
  dumpTables,
  encryptBackup,
  pruneDrive,
  uploadToDrive,
} from "@/lib/backup";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEEP_DAYS = 60;
const MIN_KEEP = 14;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return (
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  );
}

/**
 * Nightly encrypted backup of the database tables to a Google Drive folder.
 * Needs CRON_SECRET, BACKUP_ENCRYPTION_KEY, GOOGLE_DRIVE_FOLDER_ID and the Google OAuth variables (see docs/backup.md).
 * ?dryRun=1 builds the file and reports its size without uploading.
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET)
    return NextResponse.json(
      { error: "CRON_SECRET is not set" },
      { status: 503 },
    );
  if (!authorized(request))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const keyHex = process.env.BACKUP_ENCRYPTION_KEY;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!keyHex || !folderId)
    return NextResponse.json(
      { error: "backup is not configured" },
      { status: 503 },
    );
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";

  try {
    const dump = await dumpTables(createAdminClient());
    const counts = Object.fromEntries(
      Object.entries(dump.tables).map(([t, rows]) => [t, rows.length]),
    );
    const file = encryptBackup(dump, keyHex);
    const name = `lrp-backup-${dump.createdAt.slice(0, 10)}.bin`;
    if (dryRun)
      return NextResponse.json({
        dryRun: true,
        name,
        bytes: file.length,
        counts,
      });

    const uploaded = await uploadToDrive(name, file, folderId);
    const pruned = await pruneDrive(folderId, KEEP_DAYS, MIN_KEEP);
    console.info(`backup: ${name} ${file.length} bytes, pruned ${pruned}`);
    return NextResponse.json({
      ok: true,
      name,
      bytes: file.length,
      sha256: checksum(file),
      driveId: uploaded.id,
      counts,
      pruned,
    });
  } catch (error) {
    console.error(
      "backup failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ error: "backup failed" }, { status: 500 });
  }
}
