import Link from "next/link";

import { TicketFiltersBar } from "@/components/tickets/ticket-filters";
import { BulkTrashBar } from "@/components/tickets/bulk-trash-bar";
import { LoadError } from "@/components/ui/state-card";
import { TicketTable } from "@/components/tickets/ticket-table";
import { Button } from "@/components/ui/button";
import { getTicketList, PAGE_SIZE, parseFilters } from "@/lib/data/tickets";

import { guardExecutive } from "@/lib/data/session";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "รายการแจ้งซ่อม | ระบบแจ้งซ่อม โรงเรียนละหานทรายรัชดาภิเษก",
};

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
  const isStaff =
    list.viewer?.role === "staff" || list.viewer?.role === "super_admin";
  const isAdmin = list.viewer?.role === "super_admin";
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));

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

  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">
        {isStaff || !list.viewer ? "รายการแจ้งซ่อม" : "งานที่ฉันแจ้ง"}
      </h1>
      <p className="mt-1 text-muted-foreground">
        {list.total} รายการ{list.source === "mock" && " (ข้อมูลตัวอย่าง)"}
      </p>

      {trashed > 0 && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm"
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

      <div className="mt-6 space-y-4">
        {list.failed ? (
          <LoadError what="รายการแจ้งซ่อม" retryHref="/tickets" />
        ) : (
          <>
            <TicketFiltersBar filters={filters} buildings={list.buildings} />
            {isAdmin && list.tickets.length > 0 && <BulkTrashBar />}
            <TicketTable
              selectable={isAdmin}
              tickets={list.tickets}
              showReporter={isStaff}
              hasFilters={Boolean(
                filters.status ||
                filters.urgency ||
                filters.building ||
                filters.q,
              )}
            />

            {pages > 1 && (
              <nav
                aria-label="หน้ารายการ"
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">
                  หน้า {filters.page} จาก {pages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    nativeButton={false}
                    disabled={filters.page <= 1}
                    render={
                      <Link
                        href={href(filters.page - 1)}
                        aria-disabled={filters.page <= 1}
                      />
                    }
                  >
                    ก่อนหน้า
                  </Button>
                  <Button
                    variant="outline"
                    nativeButton={false}
                    disabled={filters.page >= pages}
                    render={
                      <Link
                        href={href(filters.page + 1)}
                        aria-disabled={filters.page >= pages}
                      />
                    }
                  >
                    ถัดไป
                  </Button>
                </div>
              </nav>
            )}
          </>
        )}
      </div>
    </>
  );
}
