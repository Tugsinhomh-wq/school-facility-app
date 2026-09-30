import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createMemoFromTicket } from "@/app/(dashboard)/memos/actions";
import { PageShell } from "@/components/layout/page-shell";
import { placeOf } from "@/components/tickets/ticket-table";
import { TicketManageForm } from "@/components/tickets/ticket-manage-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getTicketDetail } from "@/lib/data/tickets";
import { formatBaht, formatDateTh, STATUS_CLASS, STATUS_LABEL, URGENCY_CLASS, URGENCY_LABEL } from "@/lib/ticket-meta";

export const dynamic = "force-dynamic";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ticket, viewer } = await getTicketDetail(id);
  if (!ticket) notFound();
  const isStaff = viewer?.role === "staff" || viewer?.role === "super_admin";

  return (
    <PageShell viewer={viewer}>
      <Link href="/tickets" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        รายการแจ้งซ่อม
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <article className="rounded-xl border border-border bg-card/85 p-6 backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">{ticket.ticket_number}</p>
          <h1 className="font-display mt-1 text-2xl font-bold leading-snug sm:text-3xl">{ticket.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge className={STATUS_CLASS[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
            <Badge className={URGENCY_CLASS[ticket.urgency]}>{URGENCY_LABEL[ticket.urgency]}</Badge>
          </div>

          <dl className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field label="สถานที่">{placeOf(ticket)}</Field>
            <Field label="แจ้งเมื่อ">{formatDateTh(ticket.created_at)}</Field>
            {isStaff && <Field label="ผู้แจ้ง">{ticket.reporter?.full_name ?? "-"}</Field>}
            <Field label="ค่าใช้จ่ายประมาณการ">{Number(ticket.estimated_cost) > 0 ? formatBaht(Number(ticket.estimated_cost)) : "ยังไม่ระบุ"}</Field>
            <div className="sm:col-span-2">
              <Field label="รายละเอียด">
                <p className="max-w-[65ch] whitespace-pre-line leading-relaxed">{ticket.description || "ไม่มีรายละเอียดเพิ่มเติม"}</p>
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="บันทึกช่าง">
                <p className="max-w-[65ch] whitespace-pre-line leading-relaxed">{ticket.technician_notes || "ยังไม่มีบันทึก"}</p>
              </Field>
            </div>
            <Field label="อัปเดตล่าสุด">{formatDateTh(ticket.updated_at)}</Field>
          </dl>
        </article>

        {isStaff && (
          <aside className="h-fit rounded-xl border border-border bg-card/85 p-5 backdrop-blur-sm">
            <h2 className="mb-4 text-lg font-semibold">จัดการงานซ่อม</h2>
            <TicketManageForm ticket={ticket} />
            <form action={createMemoFromTicket} className="mt-4 border-t border-border pt-4">
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <Button type="submit" variant="outline" className="w-full">ร่างบันทึกข้อความเสนอ ผอ.</Button>
            </form>
          </aside>
        )}
      </div>
    </PageShell>
  );
}
