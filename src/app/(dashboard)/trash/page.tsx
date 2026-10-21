import { ChevronRight, TriangleAlert } from "lucide-react";
import { redirect } from "next/navigation";

import {
  purgeTrashedTickets,
  restoreTickets,
} from "@/app/(dashboard)/tickets/actions";
import { TONE } from "@/components/dashboard/home-actions";
import { PurgeButton } from "@/components/tickets/purge-button";
import { Pill, StatusPill } from "@/components/tickets/status-mark";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadError } from "@/components/ui/state-card";
import { getSession } from "@/lib/data/session";
import { formatDateTh, URGENCY_LABEL } from "@/lib/ticket-meta";
import { TRASH_DAYS } from "@/lib/trash";
import type { TicketStatus, UrgencyLevel } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ถังขยะ | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
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

/** Within this many days of the automatic delete the countdown turns red. */
const URGENT_DAYS = 3;

function TrashRow({ r }: { r: ReturnType<typeof withDaysLeft>[number] }) {
  const pill = (
    <Pill
      tone={r.daysLeft <= URGENT_DAYS ? TONE.alert : TONE.wait}
      label={r.daysLeft === 0 ? "ลบถาวรวันนี้" : `ลบถาวรใน ${r.daysLeft} วัน`}
    />
  );
  const deleted = (
    <>
      ลบเมื่อ <time dateTime={r.deleted_at}>{formatDateTh(r.deleted_at)}</time>
      {r.deleted_by_name ? ` โดย ${r.deleted_by_name}` : ""}
    </>
  );
  return (
    <li>
      <details className="group">
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 md:grid md:grid-cols-[minmax(0,1fr)_19rem_10rem_1.25rem] [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1 leading-snug md:flex-none">
            <span className="line-clamp-2 font-semibold group-open:line-clamp-none">
              {r.title}
            </span>
            <span className="mt-0.5 block truncate text-sm text-muted-foreground">
              {r.ticket_number}
              {r.reporter_name ? ` · แจ้งโดย ${r.reporter_name}` : ""}
            </span>
            <span className="mt-0.5 block truncate text-sm text-muted-foreground md:hidden">
              {deleted}
            </span>
            {r.memo_count > 0 && (
              <span className="mt-0.5 block text-sm text-muted-foreground">
                มีบันทึกข้อความที่เชื่อมอยู่
              </span>
            )}
            <span className="mt-1.5 block md:hidden">{pill}</span>
          </span>
          <span className="hidden min-w-0 truncate text-sm text-muted-foreground md:block">
            {deleted}
          </span>
          <span className="hidden md:block">{pill}</span>
          <ChevronRight
            className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
            aria-hidden
          />
        </summary>

        <div className="space-y-4 border-t border-border bg-muted/30 px-4 py-4">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <StatusPill status={r.status} />
            <span>
              {r.building} · {URGENCY_LABEL[r.urgency]}
              {r.duplicate_of_number
                ? ` · เป็นรายงานซ้ำของ ${r.duplicate_of_number}`
                : ""}
            </span>
          </p>
          {r.memo_count > 0 && (
            <p className="flex items-start gap-2 text-sm font-medium text-amber-800">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              มีบันทึกข้อความ {r.memo_count} ฉบับผูกกับงานนี้
              ลบงานถาวรแล้วบันทึกยังอยู่ แต่จะไม่มีงานอ้างอิง
            </p>
          )}
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <form action={restoreTickets}>
              <input type="hidden" name="ids" value={r.id} />
              <Button type="submit" variant="outline" className="h-11 px-5">
                กู้คืน
              </Button>
            </form>
            <PurgeButton id={r.id} action={purgeTrashedTickets} />
          </div>
        </div>
      </details>
    </li>
  );
}

export default async function TrashPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.viewer.role !== "super_admin") redirect("/");

  const { data, error } = await session.supabase.rpc("list_trashed_tickets");
  const rows = withDaysLeft((data ?? []) as Trashed[]);

  return (
    <>
      <h1 className="font-display text-3xl font-medium tracking-tight">
        ถังขยะงานแจ้งซ่อม
      </h1>
      <p className="mt-1 text-muted-foreground">
        งานที่ลบไว้ ไม่แสดงในรายการ แดชบอร์ด และสรุปผู้บริหาร
        ลบถาวรอัตโนมัติเมื่อครบ {TRASH_DAYS} วัน
      </p>

      {error ? (
        <LoadError what="ถังขยะ" retryHref="/trash" className="mt-6" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="ถังขยะว่างเปล่า"
          hint="งานแจ้งซ่อมที่ลบจะมาอยู่ที่นี่ และกู้คืนได้ก่อนครบกำหนด"
          className="mt-6 py-10"
        />
      ) : (
        <>
          <p className="mt-5 mb-2 text-sm text-muted-foreground">
            {rows.length} รายการ
          </p>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {rows.map((r) => (
              <TrashRow key={r.id} r={r} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
