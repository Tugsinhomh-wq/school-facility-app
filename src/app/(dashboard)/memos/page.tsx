import Link from "next/link";

import { placeOf } from "@/components/tickets/ticket-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  createMemoFromTicket,
  createSummaryMemo,
} from "@/app/(dashboard)/memos/actions";
import { recentPeriods } from "@/lib/summary-period";
import { getMemoList, isStaff } from "@/lib/data/memos";
import {
  APPROVAL_LABEL,
  formatDateTh,
  URGENCY_CLASS,
  URGENCY_LABEL,
} from "@/lib/ticket-meta";

import { guardExecutive } from "@/lib/data/session";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "บันทึกข้อความ | ระบบแจ้งซ่อม โรงเรียนละหานทรายรัชดาภิเษก",
};

export default async function MemosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await guardExecutive();
  const { error } = await searchParams;
  const list = await getMemoList();
  const allowed = !list.viewer || isStaff(list.viewer);

  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">
        บันทึกข้อความ
      </h1>
      <p className="mt-1 text-muted-foreground">
        ร่างบันทึกข้อความเสนอผู้อำนวยการจากงานแจ้งซ่อม แล้วดาวน์โหลดเป็น PDF
        หรือ Word{list.source === "mock" && " (ข้อมูลตัวอย่าง)"}
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}

      {!allowed ? (
        <p className="mt-8 rounded-xl border border-dashed border-border bg-card/60 p-10 text-center text-muted-foreground">
          หน้านี้สำหรับเจ้าหน้าที่ฝ่ายอาคารสถานที่ หากต้องการสิทธิ์
          ติดต่อผู้ดูแลระบบ
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-8 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <section
            aria-labelledby="memo-list"
            className="order-2 min-w-0 lg:order-1"
          >
            <h2 id="memo-list" className="mb-3 text-lg font-semibold">
              ร่างที่สร้างแล้ว
            </h2>
            {list.memos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center text-muted-foreground">
                ยังไม่มีร่างบันทึกข้อความ
                เลือกงานซ่อมที่ยังไม่มีบันทึกเพื่อสร้างร่างแรก
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border bg-card/85 backdrop-blur-sm">
                {list.memos.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/memos/${m.id}`}
                      className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 active:bg-muted/60"
                    >
                      <span className="min-w-0">
                        <span className="line-clamp-2 font-medium leading-snug">
                          {m.subject}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {m.doc_ref_no} · {formatDateTh(m.created_at)}
                        </span>
                      </span>
                      <Badge variant="outline" className="shrink-0">
                        {APPROVAL_LABEL[m.final_status]}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="order-1 min-w-0 space-y-6 lg:order-2 lg:space-y-8">
            <section aria-labelledby="memo-candidates">
              <h2 id="memo-candidates" className="mb-3 text-lg font-semibold">
                งานซ่อมที่ยังไม่มีบันทึก
              </h2>
              {list.candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  งานที่รอรับเรื่องหรือกำลังดำเนินการทุกงานมีบันทึกแล้ว
                </p>
              ) : (
                <ul className="space-y-2">
                  {list.candidates.map((t) => (
                    <li
                      key={t.id}
                      className="rounded-lg border border-border bg-card/85 p-3"
                    >
                      <p className="font-medium leading-snug">{t.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {placeOf(t)}
                        <Badge className={URGENCY_CLASS[t.urgency]}>
                          {URGENCY_LABEL[t.urgency]}
                        </Badge>
                      </p>
                      <form action={createMemoFromTicket} className="mt-2">
                        <input type="hidden" name="ticket_id" value={t.id} />
                        <Button
                          type="submit"
                          variant="outline"
                          className="h-10 w-full sm:w-auto"
                        >
                          ร่างบันทึกข้อความ
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {list.viewer?.role !== "room_staff" && (
              <details className="group rounded-xl border border-border bg-card/85 backdrop-blur-sm">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-base font-semibold [&::-webkit-details-marker]:hidden">
                  บันทึกสรุปเสนอ ผอ.
                  <span className="text-xs font-normal text-muted-foreground group-open:hidden">
                    แตะเพื่อเปิด
                  </span>
                </summary>
                <form
                  action={createSummaryMemo}
                  className="space-y-3 border-t border-border p-4"
                >
                  <p className="text-xs text-muted-foreground">
                    สร้างร่างจากตัวเลขจริงในระบบ ใช้ข้อมูลล่าสุดขณะกดสร้าง
                    แก้ข้อความได้ก่อนส่งออก
                  </p>
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">
                      ช่วงที่ต้องการสรุป
                    </span>
                    <select
                      name="period"
                      className="h-12 w-full rounded-lg border border-input bg-background px-3 text-base"
                    >
                      <optgroup label="รายเดือน">
                        {recentPeriods("month", 6).map((p) => (
                          <option key={p.key} value={`month:${p.key}`}>
                            {p.label}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="รายภาคเรียน">
                        {recentPeriods("term", 4).map((p) => (
                          <option key={p.key} value={`term:${p.key}`}>
                            {p.label}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </label>
                  <Button type="submit" className="h-11 w-full">
                    ร่างบันทึกสรุป
                  </Button>
                </form>
              </details>
            )}
          </div>
        </div>
      )}
    </>
  );
}
