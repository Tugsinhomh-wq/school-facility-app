import { Camera } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatBaht, formatDateTh, STATUS_CLASS, STATUS_LABEL, URGENCY_CLASS, URGENCY_LABEL } from "@/lib/ticket-meta";
import type { TicketRow } from "@/types/tickets";

export function placeOf(t: TicketRow) {
  return [t.building?.name, t.room?.name ?? t.location_detail].filter(Boolean).join(", ") || "ไม่ระบุ";
}

/** "มีรายงานซ้ำ 2 คน" on a main ticket, "รวมกับ REQ-…" on a report that joined one. */
export function DuplicateNote({ t }: { t: TicketRow }) {
  const n = t.dups?.[0]?.count ?? 0;
  if (t.duplicate_of_number) return <span className="text-amber-700 dark:text-amber-300">รวมกับ {t.duplicate_of_number}</span>;
  if (n > 0) return <span className="text-amber-700 dark:text-amber-300">มีรายงานซ้ำ {n} คน</span>;
  return null;
}

export function TicketTable({ tickets, showReporter, hasFilters }: { tickets: TicketRow[]; showReporter: boolean; hasFilters: boolean }) {
  if (tickets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/60 p-10 text-center text-muted-foreground">
        {hasFilters ? "ไม่พบรายการที่ตรงกับตัวกรอง ลองล้างตัวกรองหรือค้นหาด้วยคำอื่น" : "ยังไม่มีรายการแจ้งซ่อม กดปุ่ม \"แจ้งซ่อม\" ที่หน้าแรกเพื่อแจ้งเรื่องแรก"}
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-2 md:hidden">
        {tickets.map((t) => (
          <li key={t.id}>
            <Link href={`/tickets/${t.id}`} className="block rounded-xl border border-border bg-card/85 p-4 active:bg-muted/40">
              <span className="flex items-start justify-between gap-2">
                <span className="text-base font-medium leading-snug">{t.title}</span>
                <Badge className={`${STATUS_CLASS[t.status]} shrink-0`}>{STATUS_LABEL[t.status]}</Badge>
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">{placeOf(t)}</span>
              <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <Badge className={URGENCY_CLASS[t.urgency]}>{URGENCY_LABEL[t.urgency]}</Badge>
                <span>{t.ticket_number}</span>
                <DuplicateNote t={t} />
                <time dateTime={t.created_at}>{formatDateTh(t.created_at)}</time>
                {showReporter && t.reporter?.full_name && <span>{t.reporter.full_name}</span>}
                {t.image_urls?.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Camera className="size-3" aria-hidden />
                    {t.image_urls.length}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    <div className="hidden overflow-x-auto rounded-xl border border-border bg-card/85 backdrop-blur-sm md:block">
      <table className="w-full min-w-[46rem] text-left text-sm">
        <thead className="border-b border-border text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">เรื่อง</th>
            <th scope="col" className="px-4 py-3 font-medium">สถานที่</th>
            {showReporter && <th scope="col" className="px-4 py-3 font-medium">ผู้แจ้ง</th>}
            <th scope="col" className="px-4 py-3 font-medium">ความเร่งด่วน</th>
            <th scope="col" className="px-4 py-3 font-medium">สถานะ</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">แจ้งเมื่อ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tickets.map((t) => (
            <tr key={t.id} className="hover:bg-muted/40">
              <td className="px-4 py-3">
                <Link href={`/tickets/${t.id}`} className="font-medium underline-offset-4 hover:underline focus-visible:underline">
                  {t.title}
                </Link>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {t.ticket_number}
                  <DuplicateNote t={t} />
                  {t.image_urls?.length > 0 && (
                    <span className="inline-flex items-center gap-1" title={`มีรูปประกอบ ${t.image_urls.length} รูป`}>
                      <Camera className="size-3" aria-hidden />
                      {t.image_urls.length}
                    </span>
                  )}
                </span>
              </td>
              <td className="px-4 py-3">{placeOf(t)}</td>
              {showReporter && <td className="px-4 py-3">{t.reporter?.full_name ?? "-"}</td>}
              <td className="px-4 py-3">
                <Badge className={URGENCY_CLASS[t.urgency]}>{URGENCY_LABEL[t.urgency]}</Badge>
              </td>
              <td className="px-4 py-3">
                <Badge className={STATUS_CLASS[t.status]}>{STATUS_LABEL[t.status]}</Badge>
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                {formatDateTh(t.created_at)}
                {Number(t.estimated_cost) > 0 && <span className="block text-xs">{formatBaht(Number(t.estimated_cost))}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
