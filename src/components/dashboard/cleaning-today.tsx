import { AlertTriangle, ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";

import type { DayState } from "@/lib/cleaning";
import type { TodayCounts } from "@/lib/data/cleaning";
import { cn } from "@/lib/utils";

type MyToday =
  | { rows: { id: string; name: string; state: DayState }[]; failed?: undefined }
  | { failed: true };

const MY_STATE: Partial<Record<DayState, { label: string; className: string }>> = {
  confirmed: { label: "ยืนยันแล้ว", className: "text-emerald-800 dark:text-emerald-300" },
  late: { label: "ยืนยันแล้ว", className: "text-emerald-800 dark:text-emerald-300" },
  pending: { label: "ยังไม่ยืนยัน", className: "font-semibold text-red-700 dark:text-red-300" },
};
const OFF = { label: "วันหยุด", className: "text-muted-foreground" };

/** Same pattern as LoadError (a plain link, so retry re-requests the page), sized for one line. */
function CompactError({ what, retryHref = "/" }: { what: string; retryHref?: string }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
    >
      <AlertTriangle className="size-4 shrink-0 text-destructive" aria-hidden />
      <span className="font-medium">โหลด{what}ไม่สำเร็จ</span>
      <a href={retryHref} className="inline-flex min-h-9 items-center font-medium text-primary underline underline-offset-2">
        ลองใหม่
      </a>
    </div>
  );
}

/**
 * Home page cleaning status. Officers get the "rooms not confirmed today" card (to the filtered
 * overview); an advisor gets one line with today's state of their own classrooms. Either part
 * renders nothing when it does not apply (counts null = not an officer, no rows = not an advisor).
 */
export function CleaningToday({
  counts,
  mine,
}: {
  counts: TodayCounts;
  mine: MyToday;
}) {
  const officer = counts !== null;
  const hasMine = mine.failed || mine.rows.length > 0;
  if (!officer && !hasMine) return null;

  return (
    <section aria-label="เขตทำความสะอาดวันนี้" className="mb-5 space-y-2">
      {counts && "failed" in counts && <CompactError what="สถานะเขตทำความสะอาด" />}
      {counts && !("failed" in counts) && <OfficerCard {...counts} />}
      {mine.failed ? (
        !officer && <CompactError what="สถานะห้องที่ปรึกษา" />
      ) : (
        mine.rows.length > 0 && (
          <Link
            href={officer ? "/cleaning?view=mine" : "/cleaning"}
            className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-0.5 rounded-xl border border-border bg-card/85 px-3 py-2 text-sm outline-none hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Sparkles className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">เขตทำความสะอาดวันนี้:</span>
            {mine.rows.map((r, i) => {
              const look = MY_STATE[r.state] ?? OFF;
              return (
                <span key={r.id}>
                  {r.name} <span className={look.className}>{look.label}</span>
                  {i < mine.rows.length - 1 && <span className="text-muted-foreground"> ·</span>}
                </span>
              );
            })}
            <ChevronRight className="ml-auto size-4 text-muted-foreground" aria-hidden />
          </Link>
        )
      )}
    </section>
  );
}

function OfficerCard({ confirmed, total, off }: { confirmed: number; total: number; off: boolean }) {
  const missing = Math.max(0, total - confirmed);
  const alert = !off && missing > 0;
  return (
    <Link
      href="/cleaning?only=missing"
      className={cn(
        "flex items-center gap-4 rounded-xl border p-4 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
        alert
          ? "border-red-500/60 bg-red-500/5 hover:border-red-500 dark:border-red-400/60"
          : "border-border bg-card/85 hover:border-primary/40",
      )}
    >
      <span
        className={cn(
          "text-4xl leading-none font-semibold tabular-nums",
          alert ? "text-red-700 dark:text-red-300" : "text-muted-foreground",
        )}
      >
        {off ? "–" : missing}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">ห้องเรียนยังไม่ยืนยันเขตวันนี้</span>
        <span className="block text-sm text-muted-foreground">
          {total === 0
            ? "ยังไม่มีห้องเรียนในภาคเรียนนี้"
            : off
              ? "วันนี้เป็นวันหยุด ไม่ต้องยืนยัน"
              : `ยืนยันแล้ว ${confirmed} / ${total} ห้อง`}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
