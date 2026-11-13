import { Plus } from "lucide-react";
import Link from "next/link";

import { NewReportCard } from "@/components/tickets/new-report-card";
import { RepairDeskList } from "@/components/tickets/repair-desk";
import { TicketFiltersBar } from "@/components/tickets/ticket-filters";
import { BulkTrashBar } from "@/components/tickets/bulk-trash-bar";
import { LoadError } from "@/components/ui/state-card";
import { TicketTable } from "@/components/tickets/ticket-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { getTicketList, PAGE_SIZE, parseFilters } from "@/lib/data/tickets";
import { bangkokYmd, formatDayLong } from "@/lib/time";
import { cn } from "@/lib/utils";

import { guardExecutive, isStaffRole } from "@/lib/data/session";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "รายการแจ้งซ่อม | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

/**
 * Two views of one page. Admin, head and staff get the queue: a table with open emergencies in amber and
 * the report form under it. Everyone else (a regular user, the meeting-room officer, a signed-out visitor
 * looking at sample data) gets the repair desk: the report form beside their own jobs, each with its lane.
 * Executives never get here (guardExecutive sends them to the summary).
 */
export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await guardExecutive();
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const trashed =
    Number(Array.isArray(sp.trashed) ? sp.trashed[0] : sp.trashed) || 0;
  const list = await getTicketList(filters);
  const isStaff = isStaffRole(list.viewer?.role);
  const isAdmin = list.viewer?.role === "super_admin";
  const canReport = list.viewer !== null;
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const hasFilters = Boolean(filters.status || filters.urgency || filters.building || filters.q);
  const total = `${list.total} รายการ${list.source === "mock" ? " (ข้อมูลตัวอย่าง)" : ""}`;

  const href = (page: number) => {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.urgency) params.set("urgency", filters.urgency);
    if (filters.building) params.set("building", filters.building);
    if (filters.q) params.set("q", filters.q);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `/tickets?${qs}` : "/tickets";
  };

  const pager = pages > 1 && (
    <nav aria-label="หน้ารายการ" className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">
        หน้า {filters.page} จาก {pages}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="h-11 px-4"
          nativeButton={false}
          disabled={filters.page <= 1}
          render={<Link href={href(filters.page - 1)} aria-disabled={filters.page <= 1} />}
        >
          ก่อนหน้า
        </Button>
        <Button
          variant="outline"
          className="h-11 px-4"
          nativeButton={false}
          disabled={filters.page >= pages}
          render={<Link href={href(filters.page + 1)} aria-disabled={filters.page >= pages} />}
        >
          ถัดไป
        </Button>
      </div>
    </nav>
  );

  const today = formatDayLong(bangkokYmd(new Date()));

  if (!isStaff) {
    return (
      <div className="space-y-6">
        <header>
          <p className="text-sm font-medium text-muted-foreground">{today}</p>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">แจ้งซ่อม</h1>
        </header>
        <div className={cn("grid grid-cols-1 items-start gap-6", canReport && "lg:grid-cols-2")}>
          {canReport && <NewReportCard buildings={list.buildings} variant="well" />}
          <section aria-labelledby="mine-h" className="rounded-2xl bg-secondary p-4 shadow-xs sm:p-6">
            <h2 id="mine-h" className="font-display text-2xl font-medium leading-snug">
              {list.viewer ? "งานที่ฉันแจ้ง" : "รายการแจ้งซ่อม"}
            </h2>
            <p className="mt-0.5 mb-4 text-muted-foreground">
              {total}
              {!list.failed && list.total > 0 && " แต่ละเรื่องบอกว่าตอนนี้อยู่ขั้นไหน"}
            </p>
            {list.failed ? (
              <LoadError what="รายการแจ้งซ่อม" retryHref="/tickets" />
            ) : (
              <div className="space-y-4">
                <TicketFiltersBar filters={filters} buildings={list.buildings} showOpenView={!list.viewer} />
                <RepairDeskList tickets={list.tickets} hasFilters={hasFilters} />
                {pager}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b-2 border-foreground pb-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{today}</p>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">รายการแจ้งซ่อม</h1>
          <p className="mt-1 text-muted-foreground">{total}</p>
        </div>
        {canReport && (
          <Link href="#new" className={cn(buttonVariants(), "hidden h-12 px-5 text-sm font-semibold md:inline-flex")}>
            <Plus className="size-4" aria-hidden />
            แจ้งซ่อมใหม่
          </Link>
        )}
      </header>

      {trashed > 0 && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-border bg-muted/50 p-3 text-sm"
        >
          ย้าย {trashed} งานไปถังขยะแล้ว{" "}
          <Link href="/trash" className="underline">
            ดูถังขยะ / กู้คืน
          </Link>
        </p>
      )}
      {isAdmin && (
        <p className="mt-2 text-sm">
          <Link
            href="/trash"
            className="text-muted-foreground underline-offset-4 hover:underline"
          >
            ถังขยะ
          </Link>
        </p>
      )}

      <div className="mt-5 space-y-4">
        {list.failed ? (
          <LoadError what="รายการแจ้งซ่อม" retryHref="/tickets" />
        ) : (
          <>
            <TicketFiltersBar
              filters={filters}
              buildings={list.buildings}
              showOpenView
              showMine
            />
            {(filters.status === "open" || filters.status === "mine") && (
              <p className="text-sm text-muted-foreground">
                {filters.status === "mine" ? "งานที่ยังไม่ปิดและมอบหมายให้คุณ" : "งานที่ยังไม่ปิด"}{" "}
                เรียงฉุกเฉินก่อน แล้วงานที่รอนานสุดก่อน
              </p>
            )}
            {isAdmin && list.tickets.length > 0 && <BulkTrashBar />}
            <TicketTable
              selectable={isAdmin}
              tickets={list.tickets}
              showReporter
              assigneeNames={list.assigneeNames}
              hasFilters={hasFilters}
            />
            {pager}
          </>
        )}
      </div>

      {canReport && <NewReportCard buildings={list.buildings} variant="plate" className="mt-10 hidden md:block" />}
    </>
  );
}
