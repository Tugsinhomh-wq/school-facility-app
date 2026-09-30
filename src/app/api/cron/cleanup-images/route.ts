import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { cleanupOrphanImages } from "@/lib/cleanup-images";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const DEFAULT_MIN_AGE_MINUTES = 24 * 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // not configured: the job stays off instead of being open
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/**
 * Removes repair photos that were uploaded but never attached to a ticket.
 * Call with `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends it automatically).
 * Options: ?dryRun=1 lists what would go, ?minAgeMinutes=N changes the 24 h safety window.
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const minAge = Number(params.get("minAgeMinutes") ?? DEFAULT_MIN_AGE_MINUTES);
  const dryRun = params.get("dryRun") === "1";
  if (!Number.isFinite(minAge) || minAge < 0) return NextResponse.json({ error: "invalid minAgeMinutes" }, { status: 400 });

  try {
    const result = await cleanupOrphanImages(createAdminClient(), { minAgeMinutes: minAge, dryRun });
    console.info(`cleanup-images: scanned ${result.scanned}, orphans ${result.orphans.length}, deleted ${result.deleted}${dryRun ? " (dry run)" : ""}`);
    return NextResponse.json(result);
  } catch (error) {
    console.error("cleanup-images failed:", error);
    return NextResponse.json({ error: "cleanup failed" }, { status: 500 });
  }
}
