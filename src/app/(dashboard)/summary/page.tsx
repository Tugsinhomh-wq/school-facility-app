import Link from "next/link";
import { redirect } from "next/navigation";

import { SummaryView } from "@/components/summary/summary-view";
import { fetchSummary } from "@/lib/data/summary";
import { canSeeSummary, getSession } from "@/lib/data/session";
import { getUnreadTicketIds } from "@/lib/data/ticket-comments";
import { resolvePeriod } from "@/lib/summary-period";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "สรุปภาพรวม | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canSeeSummary(session.viewer.role)) redirect("/");

  const q = await searchParams;
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const period = resolvePeriod(one(q.p), one(q.k));
  const data = await fetchSummary(session.supabase, period);
  const unread = session.viewer.role === "budget_deputy" ? (await getUnreadTicketIds(session.supabase)).size : 0;

  return (
    <>
      {unread > 0 && (
        <Link
          href="/backlog"
          role="status"
          className="mb-4 flex min-h-12 items-center rounded-lg border border-border bg-muted/50 px-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {unread} ใบมีความเห็นใหม่ ดูที่งานซ่อมค้าง
        </Link>
      )}
      <SummaryView
      key={`${period.kind}-${period.key}`}
      initial={data}
      period={{
        kind: period.kind,
        key: period.key,
        label: period.label,
        prevKey: period.prevKey,
        nextKey: period.nextKey,
        hasNext: period.hasNext,
        bucket: period.bucket,
      }}
    />
    </>
  );
}
