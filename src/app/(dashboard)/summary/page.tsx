import { redirect } from "next/navigation";

import { SummaryView } from "@/components/summary/summary-view";
import { fetchSummary } from "@/lib/data/summary";
import { canSeeSummary, getSession } from "@/lib/data/session";
import { resolvePeriod } from "@/lib/summary-period";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "สรุปภาพรวม | ระบบแจ้งซ่อม โรงเรียนละหานทรายรัชดาภิเษก",
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

  return (
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
  );
}
