import { Camera, ChevronRight } from "lucide-react";
import Link from "next/link";

import { StatusPill, UrgencyMark } from "@/components/tickets/status-mark";
import { formatBaht, formatDateTh } from "@/lib/ticket-meta";
import type { TicketRow } from "@/types/tickets";

export function placeOf(t: TicketRow) {
  return (
    [t.building?.name, t.room?.name ?? t.location_detail]
      .filter(Boolean)
      .join(", ") || "ไม่ระบุ"
  );
}

/** "มีรายงานซ้ำ 2 คน" on a main ticket, "รวมกับ REQ-…" on a report that joined one. */
export function DuplicateNote({ t }: { t: TicketRow }) {
  const n = t.dups?.[0]?.count ?? 0;
  if (t.duplicate_of_number)
    return (
      <span className="text-amber-800">
        รวมกับ {t.duplicate_of_number}
      </span>
    );
  if (n > 0)
    return (
      <span className="text-amber-800">
        มีรายงานซ้ำ {n} คน
      </span>
    );
  return null;
}

/** Checkbox tied to the bulk form (id "bulk-trash") rendered above the list. */
function RowCheck({ id, title }: { id: string; title: string }) {
  return (
    <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        name="ids"
        value={id}
        form="bulk-trash"
        aria-label={`เลือก ${title}`}
        className="size-5 accent-[var(--color-primary)]"
      />
    </label>
  );
}

export function TicketTable({
  tickets,
  showReporter,
  hasFilters,
  selectable = false,
}: {
  tickets: TicketRow[];
  showReporter: boolean;
  hasFilters: boolean;
  /** Administrator only: a checkbox on every row for moving several tickets to the trash at once. */
  selectable?: boolean;
}) {
  if (tickets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
        {hasFilters
          ? "ไม่พบรายการที่ตรงกับตัวกรอง ลองล้างตัวกรองหรือค้นหาด้วยคำอื่น"
          : 'ยังไม่มีรายการแจ้งซ่อม กดปุ่ม "แจ้งซ่อม" ที่หน้าแรกเพื่อแจ้งเรื่องแรก'}
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border md:hidden">
        {tickets.map((t) => (
          <li key={t.id} className="flex items-center pl-1">
            {selectable && <RowCheck id={t.id} title={t.title} />}
            <Link
              href={`/tickets/${t.id}`}
              className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-3.5 pr-4 pl-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
            >
              <span className="min-w-0 flex-1 leading-snug">
                <span className="block font-semibold">{t.title}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {placeOf(t)} ·{" "}
                  <time dateTime={t.created_at}>{formatDateTh(t.created_at)}</time>
                  {showReporter && t.reporter?.full_name && ` · ${t.reporter.full_name}`}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <StatusPill status={t.status} />
                  {(t.urgency === "high" || t.urgency === "emergency") && (
                    <UrgencyMark urgency={t.urgency} />
                  )}
                  <DuplicateNote t={t} />
                  <span>{t.ticket_number}</span>
                  {t.image_urls?.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Camera className="size-4" aria-hidden />
                      {t.image_urls.length}
                    </span>
                  )}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead className="border-b border-border bg-muted/50 whitespace-nowrap text-muted-foreground">
            <tr>
              {selectable && (
                <th scope="col" className="w-12 py-3 pl-2">
                  <span className="sr-only">เลือก</span>
                </th>
              )}
              <th scope="col" className="px-4 py-3 font-medium">
                เรื่อง
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                สถานที่
              </th>
              {showReporter && (
                <th scope="col" className="px-4 py-3 font-medium">
                  ผู้แจ้ง
                </th>
              )}
              <th scope="col" className="px-4 py-3 font-medium">
                ความเร่งด่วน
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                สถานะ
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                แจ้งเมื่อ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tickets.map((t) => (
              <tr key={t.id} className="hover:bg-muted/40">
                {selectable && (
                  <td className="py-2 pl-2">
                    <RowCheck id={t.id} title={t.title} />
                  </td>
                )}
                <td className="px-4 py-4">
                  <Link
                    href={`/tickets/${t.id}`}
                    className="font-semibold underline-offset-4 hover:underline focus-visible:underline"
                  >
                    {t.title}
                  </Link>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    {t.ticket_number}
                    <DuplicateNote t={t} />
                    {t.image_urls?.length > 0 && (
                      <span
                        className="inline-flex items-center gap-1"
                        title={`มีรูปประกอบ ${t.image_urls.length} รูป`}
                      >
                        <Camera className="size-3" aria-hidden />
                        {t.image_urls.length}
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-4">{placeOf(t)}</td>
                {showReporter && (
                  <td className="px-4 py-4 whitespace-nowrap">{t.reporter?.full_name ?? "-"}</td>
                )}
                <td className="px-4 py-4">
                  <UrgencyMark urgency={t.urgency} />
                </td>
                <td className="px-4 py-4">
                  <StatusPill status={t.status} />
                </td>
                <td className="px-4 py-4 text-right tabular-nums whitespace-nowrap text-muted-foreground">
                  {formatDateTh(t.created_at)}
                  {Number(t.estimated_cost) > 0 && (
                    <span className="block text-xs">
                      {formatBaht(Number(t.estimated_cost))}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
