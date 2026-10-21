import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { placeOf } from "@/components/tickets/ticket-table";
import { ApprovalPill, UrgencyMark } from "@/components/tickets/status-mark";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadError } from "@/components/ui/state-card";
import {
  createMemoFromTicket,
  createSummaryMemo,
} from "@/app/(dashboard)/memos/actions";
import { recentPeriods } from "@/lib/summary-period";
import { getMemoList } from "@/lib/data/memos";
import { formatDateTh } from "@/lib/ticket-meta";
import type { ModuleType } from "@/types/database";

import { guardExecutive, isRoomManager } from "@/lib/data/session";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "บันทึกข้อความ | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

const ORIGIN_LABEL: Record<ModuleType, string> = {
  repair: "งานแจ้งซ่อม",
  reservation: "ขอใช้ห้องประชุม",
  environment: "งานสิ่งแวดล้อม",
  general_memo: "บันทึกทั่วไป",
};

const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50";

export default async function MemosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await guardExecutive();
  const { error } = await searchParams;
  const list = await getMemoList();
  const allowed = !list.viewer || isRoomManager(list.viewer.role);

  return (
    <>
      <h1 className="font-display text-3xl font-medium tracking-tight">
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

      {list.failed ? (
        <LoadError what="บันทึกข้อความ" retryHref="/memos" className="mt-6" />
      ) : !allowed ? (
        <EmptyState
          className="mt-8 py-10"
          title="หน้านี้สำหรับเจ้าหน้าที่ฝ่ายอาคารสถานที่"
          hint="หากต้องการสิทธิ์ ติดต่อผู้ดูแลระบบ"
        />
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
              <EmptyState
                title="ยังไม่มีร่างบันทึกข้อความ"
                hint="เลือกงานซ่อมที่ยังไม่มีบันทึกเพื่อสร้างร่างแรก"
              />
            ) : (
              <>
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border md:hidden">
                  {list.memos.map((m) => (
                    <li key={m.id}>
                      <Link
                        href={`/memos/${m.id}`}
                        className={`flex min-h-16 items-center gap-3 py-3.5 pr-4 pl-4 transition-colors hover:bg-muted/60 ${focusRing}`}
                      >
                        <span className="min-w-0 flex-1 leading-snug">
                          <span className="block font-semibold">
                            {m.subject}
                          </span>
                          <span className="mt-0.5 block text-sm text-muted-foreground">
                            {m.doc_ref_no} ·{" "}
                            <time dateTime={m.created_at}>
                              {formatDateTh(m.created_at)}
                            </time>{" "}
                            · {ORIGIN_LABEL[m.origin_module]}
                          </span>
                          <ApprovalPill
                            status={m.final_status}
                            className="mt-1.5"
                          />
                        </span>
                        <ChevronRight
                          className="size-5 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border whitespace-nowrap text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-medium">
                          เรื่อง
                        </th>
                        <th scope="col" className="px-4 py-3 font-medium">
                          สถานะ
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-right font-medium"
                        >
                          สร้างเมื่อ
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {list.memos.map((m) => (
                        <tr key={m.id} className="hover:bg-muted/40">
                          <td className="px-4 py-4">
                            <Link
                              href={`/memos/${m.id}`}
                              className="font-semibold underline-offset-4 hover:underline focus-visible:underline"
                            >
                              {m.subject}
                            </Link>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {m.doc_ref_no} · {ORIGIN_LABEL[m.origin_module]}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <ApprovalPill status={m.final_status} />
                          </td>
                          <td className="px-4 py-4 text-right whitespace-nowrap text-muted-foreground tabular-nums">
                            {formatDateTh(m.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
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
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                  {list.candidates.map((t) => (
                    <li key={t.id} className="px-4 py-3.5">
                      <p className="font-semibold leading-snug">{t.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                        {placeOf(t)}
                        <UrgencyMark urgency={t.urgency} />
                      </p>
                      <form action={createMemoFromTicket} className="mt-2">
                        <input type="hidden" name="ticket_id" value={t.id} />
                        <Button
                          type="submit"
                          variant="outline"
                          className="h-11 w-full sm:w-auto"
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
              <details className="group rounded-xl border border-border">
                <summary
                  className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-base font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden"
                >
                  บันทึกสรุปเสนอ ผอ.
                  <span className="text-sm font-normal text-muted-foreground group-open:hidden">
                    แตะเพื่อเปิด
                  </span>
                </summary>
                <form
                  action={createSummaryMemo}
                  className="space-y-3 border-t border-border p-4"
                >
                  <p className="text-sm text-muted-foreground">
                    สร้างร่างจากตัวเลขจริงในระบบ ใช้ข้อมูลล่าสุดขณะกดสร้าง
                    แก้ข้อความได้ก่อนส่งออก
                  </p>
                  <label className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">
                      ช่วงที่ต้องการสรุป
                    </span>
                    <select
                      name="period"
                      className="h-12 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
