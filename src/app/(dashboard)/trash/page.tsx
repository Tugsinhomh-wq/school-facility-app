import { redirect } from "next/navigation";

import {
  purgeTrashedTickets,
  restoreTickets,
} from "@/app/(dashboard)/tickets/actions";
import { PurgeButton } from "@/components/tickets/purge-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/data/session";
import {
  formatDateTh,
  STATUS_CLASS,
  STATUS_LABEL,
  URGENCY_LABEL,
} from "@/lib/ticket-meta";
import { TRASH_DAYS } from "@/lib/trash";
import type { TicketStatus, UrgencyLevel } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ถังขยะ | ระบบแจ้งซ่อม โรงเรียนละหานทรายรัชดาภิเษก",
};

interface Trashed {
  id: string;
  ticket_number: string;
  title: string;
  building: string;
  urgency: UrgencyLevel;
  status: TicketStatus;
  reporter_name: string | null;
  deleted_at: string;
  deleted_by_name: string | null;
  memo_count: number;
  duplicate_of_number: string | null;
}

/** Days until the automatic permanent delete. Kept outside the page component because it reads the clock. */
function withDaysLeft(rows: Trashed[]) {
  const now = Date.now();
  return rows.map((r) => ({
    ...r,
    daysLeft: Math.max(
      0,
      Math.ceil(
        TRASH_DAYS - (now - new Date(r.deleted_at).getTime()) / 86_400_000,
      ),
    ),
  }));
}

export default async function TrashPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.viewer.role !== "super_admin") redirect("/");

  const { data, error } = await session.supabase.rpc("list_trashed_tickets");
  const rows = withDaysLeft((data ?? []) as Trashed[]);

  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">
        ถังขยะงานแจ้งซ่อม
      </h1>
      <p className="mt-1 text-muted-foreground">
        งานที่ลบไว้ ไม่แสดงในรายการ แดชบอร์ด และสรุปผู้บริหาร
        ลบถาวรอัตโนมัติเมื่อครบ {TRASH_DAYS} วัน
      </p>

      {error ? (
        <p role="alert" className="mt-6 text-sm text-destructive">
          โหลดไม่สำเร็จ ลองรีเฟรชหน้านี้
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border bg-card/60 p-10 text-center text-muted-foreground">
          ถังขยะว่างอยู่
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-border bg-card/85 p-4 backdrop-blur-sm sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{r.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.ticket_number} · {r.building} ·{" "}
                    {URGENCY_LABEL[r.urgency]}
                    {r.reporter_name ? ` · แจ้งโดย ${r.reporter_name}` : ""}
                  </p>
                </div>
                <Badge className={`${STATUS_CLASS[r.status]} shrink-0`}>
                  {STATUS_LABEL[r.status]}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                ลบเมื่อ {formatDateTh(r.deleted_at)}
                {r.deleted_by_name ? ` โดย ${r.deleted_by_name}` : ""} ·
                ลบถาวรในอีก {r.daysLeft} วัน
                {r.duplicate_of_number
                  ? ` · เป็นรายงานซ้ำของ ${r.duplicate_of_number}`
                  : ""}
              </p>
              {r.memo_count > 0 && (
                <p className="mt-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-2 text-sm">
                  มีบันทึกข้อความ {r.memo_count} ฉบับผูกกับงานนี้
                  ลบงานถาวรแล้วบันทึกยังอยู่ แต่จะไม่มีงานอ้างอิง
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={restoreTickets}>
                  <input type="hidden" name="ids" value={r.id} />
                  <Button type="submit" size="sm">
                    กู้คืน
                  </Button>
                </form>
                <PurgeButton id={r.id} action={purgeTrashedTickets} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
