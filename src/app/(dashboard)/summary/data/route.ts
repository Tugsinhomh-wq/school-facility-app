import { NextResponse } from "next/server";

import { fetchSummary } from "@/lib/data/summary";
import { canSeeSummary, getSession } from "@/lib/data/session";
import { resolvePeriod } from "@/lib/summary-period";

export const dynamic = "force-dynamic";

/** JSON for the summary page's live refresh. The database function checks the role again. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !canSeeSummary(session.viewer.role))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const q = new URL(request.url).searchParams;
  const period = resolvePeriod(
    q.get("p") ?? undefined,
    q.get("k") ?? undefined,
  );
  const data = await fetchSummary(session.supabase, period);
  if (!data)
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
