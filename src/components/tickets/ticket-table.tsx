import { AlertCircle, Camera, ChevronRight } from "lucide-react";
import Link from "next/link";

import { StatusPill, UrgencyMark } from "@/components/tickets/status-mark";
import { overdueDays } from "@/lib/ticket-aging";
import { cn } from "@/lib/utils";
import { formatBaht, formatDateTh } from "@/lib/ticket-meta";
import type { TicketRow } from "@/types/tickets";

export function placeOf(t: TicketRow) {
  return (
    [t.building?.name, t.room?.name ?? t.location_detail]
      .filter(Boolean)
      .join(", ") || "ไม่ระบุ"
  );
}

/**
 * Row colours for the staff queue. An open emergency is a light red row with a red bar at its edge (dark text
 * stays readable on it); a new ticket nobody has taken yet is filled in amber. Emergency wins when both apply.
 * A report merged into another ticket is not new work, so it gets neither.
 */
const isEmergency = (t: TicketRow) => t.urgency === "emergency" && (t.status === "pending" || t.status === "in_progress");
const isNew = (t: TicketRow) => t.status === "pending" && !t.duplicate_of_number && !isEmergency(t);
const EMERGENCY_ROW = "bg-queue-emergency hover:bg-queue-emergency";
const NEW_ROW =
  "bg-queue-new text-foreground hover:bg-queue-new [&_.text-muted-foreground]:text-foreground [&_.text-amber-800]:text-foreground";
const rowTone = (t: TicketRow) => (isEmergency(t) ? EMERGENCY_ROW : isNew(t) ? NEW_ROW : "");

/** The urgency cell: an open emergency is a solid red badge, anything else the usual mark. */
function QueueUrgency({ t }: { t: TicketRow }) {
  if (!isEmergency(t)) return <UrgencyMark urgency={t.urgency} />;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-queue-emergency-bar px-2 py-0.5 text-sm font-semibold whitespace-nowrap text-white">
      <AlertCircle className="size-4" aria-hidden />
      ฉุกเฉิน
    </span>
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

/** "ค้างเกินกำหนด 3 วัน" on an open ticket that has waited longer than its urgency allows. */
export function OverdueNote({ t }: { t: TicketRow }) {
  const days = t.duplicate_of_number ? null : overdueDays(t);
  if (days === null) return null;
  return <span className="font-medium text-amber-800">ค้างเกินกำหนด {days} วัน</span>;
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
  assigneeNames = {},
}: {
  tickets: TicketRow[];
  showReporter: boolean;
  hasFilters: boolean;
  /** Administrator only: a checkbox on every row for moving several tickets to the trash at once. */
  selectable?: boolean;
  /** Staff only: who is handling each ticket, by profile id. */
  assigneeNames?: Record<string, string>;
}) {
  const handler = (t: TicketRow) => (t.assignee_id ? (assigneeNames[t.assignee_id] ?? "-") : null);
  if (tickets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
        {hasFilters
          ? "ไม่พบรายการที่ตรงกับตัวกรอง ลองล้างตัวกรองหรือค้นหาด้วยคำอื่น"
          : "ยังไม่มีรายการแจ้งซ่อม"}
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-border border-y-2 border-foreground bg-card md:hidden">
        {tickets.map((t) => (
          <li
            key={t.id}
            className={cn("flex items-center pl-1", rowTone(t), isEmergency(t) && "shadow-[inset_6px_0_0_var(--color-queue-emergency-bar)]")}
          >
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
                {showReporter && (
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {handler(t) ? `ผู้รับผิดชอบ: ${handler(t)}` : "ยังไม่มีผู้รับผิดชอบ"}
                  </span>
                )}
                <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <StatusPill status={t.status} />
                  <QueueUrgency t={t} />
                  <OverdueNote t={t} />
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
      <div className="hidden overflow-x-auto border-y-2 border-foreground bg-card md:block">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead className="border-b-2 border-foreground whitespace-nowrap text-muted-foreground">
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
              {showReporter && (
                <th scope="col" className="px-4 py-3 font-medium">
                  ผู้รับผิดชอบ
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
              <tr
                key={t.id}
                className={cn("hover:bg-muted/40", rowTone(t), isEmergency(t) && "[&>td:first-child]:shadow-[inset_6px_0_0_var(--color-queue-emergency-bar)]")}
              >
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
                    <OverdueNote t={t} />
                    <DuplicateNote t={t} />
                    {t.image_urls?.length > 0 && (
                      <span
                        className="inline-flex items-center gap-1"
                        title={`มีรูปก่อนซ่อม ${t.image_urls.length} รูป`}
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
                {showReporter && (
                  <td className="px-4 py-4 whitespace-nowrap">
                    {handler(t) ?? <span className="text-muted-foreground">ยังไม่มี</span>}
                  </td>
                )}
                <td className="px-4 py-4">
                  <QueueUrgency t={t} />
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
