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
  title: "งานที่ขอความเห็น | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

/** The tickets the facility staff sent to the budget deputy for their opinion, by building. */
export default async function BacklogPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canSeeBacklog(session.viewer.role)) redirect("/");

  const unreadIds = await getUnreadTicketIds(session.supabase);
  const tickets = await getBacklog(session.supabase, unreadIds);
  const result = tickets && groupBacklog(tickets, unreadIds, new Date().getTime());

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">{formatDayLong(bangkokYmd(new Date()))}</p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">งานที่ขอความเห็น</h1>
        <p className="mt-1 text-muted-foreground">งานซ่อมที่เจ้าหน้าที่ขอความเห็นจากท่าน แยกตามอาคาร</p>
      </header>
      {result ? <BacklogView result={result} /> : <LoadError what="งานที่ขอความเห็น" retryHref="/backlog" />}
    </div>
  );
}
