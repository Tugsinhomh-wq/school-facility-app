import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createMemoFromTicket } from "@/app/(dashboard)/memos/actions";
import { placeOf } from "@/components/tickets/ticket-table";
import { TicketManageForm } from "@/components/tickets/ticket-manage-form";
import { StatusPill, UrgencyMark } from "@/components/tickets/status-mark";
import { Button } from "@/components/ui/button";
import { MergePanel } from "@/components/tickets/merge-panel";
import { TrashButton } from "@/components/tickets/trash-button";
import { getDuplicateContext, getTicketDetail } from "@/lib/data/tickets";
import { formatBaht, formatDateTh } from "@/lib/ticket-meta";

import { guardExecutive, isStaffRole } from "@/lib/data/session";

export const dynamic = "force-dynamic";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await guardExecutive();
  const { id } = await params;
  const { ticket, viewer, imageUrls, afterImageUrls } =
    await getTicketDetail(id);
  if (!ticket) notFound();
  const isStaff = isStaffRole(viewer?.role);
  const dupCtx = isStaff ? await getDuplicateContext(ticket) : null;

  return (
    <>
      <Link
        href="/tickets"
        className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft className="size-4" aria-hidden />
        รายการแจ้งซ่อม
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <article className="min-w-0">
          <p className="text-sm text-muted-foreground">
            {ticket.ticket_number}
          </p>
          <h1 className="font-display mt-1 text-2xl font-medium leading-snug sm:text-3xl">
            {ticket.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <StatusPill status={ticket.status} />
            <UrgencyMark urgency={ticket.urgency} />
          </div>
          {ticket.duplicate_of_number && (
            <p className="mt-4 rounded-lg border border-border bg-muted/50 p-3 text-sm">
              มีคนแจ้งเรื่องนี้ไว้แล้ว รายงานของคุณรวมกับงาน{" "}
              {ticket.duplicate_of_number} สถานะด้านบนตามงานนั้น
            </p>
          )}

          <dl className="mt-6 grid grid-cols-2 gap-5 border-t border-border pt-6">
            <Field label="สถานที่">{placeOf(ticket)}</Field>
            <Field label="แจ้งเมื่อ">{formatDateTh(ticket.created_at)}</Field>
            {isStaff && (
              <Field label="ผู้แจ้ง">{ticket.reporter?.full_name ?? "-"}</Field>
            )}
            <Field label="ค่าใช้จ่ายประมาณการ">
              {Number(ticket.estimated_cost) > 0
                ? formatBaht(Number(ticket.estimated_cost))
                : "ยังไม่ระบุ"}
            </Field>
            <div className="col-span-2">
              <Field label="รายละเอียด">
                <p className="max-w-[65ch] whitespace-pre-line leading-relaxed">
                  {ticket.description || "ไม่มีรายละเอียดเพิ่มเติม"}
                </p>
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="บันทึกช่าง">
                <p className="max-w-[65ch] whitespace-pre-line leading-relaxed">
                  {ticket.technician_notes || "ยังไม่มีบันทึก"}
                </p>
              </Field>
            </div>
            {imageUrls.length > 0 && (
              <div className="col-span-2">
                <Field label={`รูปก่อนซ่อม (${imageUrls.length})`}>
                  <ul className="mt-1 flex flex-wrap gap-3">
                    {imageUrls.map((url, i) => (
                      <li key={url}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="block overflow-hidden rounded-lg border border-border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`รูปก่อนซ่อม ${i + 1}`}
                            loading="lazy"
                            className="h-32 w-auto max-w-56 object-cover"
                          />
                        </a>
                      </li>
                    ))}
                  </ul>
                </Field>
              </div>
            )}
            {afterImageUrls.length > 0 && (
              <div className="col-span-2">
                <Field label={`รูปหลังซ่อม (${afterImageUrls.length})`}>
                  <ul className="mt-1 flex flex-wrap gap-3">
                    {afterImageUrls.map((url, i) => (
                      <li key={url}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="block overflow-hidden rounded-lg border border-border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`รูปหลังซ่อม ${i + 1}`}
                            loading="lazy"
                            className="h-32 w-auto max-w-56 object-cover"
                          />
                        </a>
                      </li>
                    ))}
                  </ul>
                </Field>
              </div>
            )}
            <Field label="อัปเดตล่าสุด">
              {formatDateTh(ticket.updated_at)}
            </Field>
          </dl>
        </article>

        {isStaff && (
          <aside className="h-fit rounded-xl border border-border p-5">
            <h2 className="mb-4 font-semibold">จัดการงานซ่อม</h2>
            <TicketManageForm ticket={ticket} />
            <form
              action={createMemoFromTicket}
              className="mt-4 border-t border-border pt-4"
            >
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <Button type="submit" variant="outline" className="h-11 w-full">
                ร่างบันทึกข้อความเสนอ ผอ.
              </Button>
            </form>
            {dupCtx && <MergePanel ticket={ticket} ctx={dupCtx} />}
            {viewer?.role === "super_admin" && <TrashButton id={ticket.id} />}
          </aside>
        )}
      </div>
    </>
  );
}
