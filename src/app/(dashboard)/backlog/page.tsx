import { redirect } from "next/navigation";

import { BacklogView } from "@/components/backlog/backlog-view";
import { LoadError } from "@/components/ui/state-card";
import { groupBacklog } from "@/lib/backlog";
import { getBacklog } from "@/lib/data/backlog";
import { canSeeBacklog, getSession } from "@/lib/data/session";
import { getUnreadTicketIds } from "@/lib/data/ticket-comments";
import { bangkokYmd, formatDayLong } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "งานซ่อมค้าง | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

/** The open repairs by building, for the budget deputy to talk through with the facility staff. */
export default async function BacklogPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canSeeBacklog(session.viewer.role)) redirect("/");

  const [tickets, unreadIds] = await Promise.all([getBacklog(session.supabase), getUnreadTicketIds(session.supabase)]);
  const result = tickets && groupBacklog(tickets, unreadIds, new Date().getTime());

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">{formatDayLong(bangkokYmd(new Date()))}</p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">งานซ่อมค้าง</h1>
        <p className="mt-1 text-muted-foreground">งานที่รอดำเนินการและกำลังดำเนินการ แยกตามอาคาร</p>
      </header>
      {result ? <BacklogView result={result} /> : <LoadError what="งานซ่อมค้าง" retryHref="/backlog" />}
    </div>
  );
}
