import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { StatusPill, UrgencyMark } from "@/components/tickets/status-mark";
import type { BacklogRow, groupBacklog } from "@/lib/backlog";

function Row({ r }: { r: BacklogRow }) {
  return (
    <li>
      <Link
        href={`/tickets/${r.id}`}
        className="flex min-h-16 items-center gap-3 px-4 py-3.5 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
      >
        <span className="min-w-0 flex-1 leading-snug">
          <span className="block font-semibold">{r.place}</span>
          <span className="block text-sm text-muted-foreground">{r.title}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <StatusPill status={r.status} />
            <UrgencyMark urgency={r.urgency} />
            <span>{r.ageDays === 0 ? "แจ้งวันนี้" : `ค้าง ${r.ageDays} วัน`}</span>
            {r.unread && <span className="rounded-full bg-red-700 px-2 py-0.5 text-xs font-semibold text-white">ความเห็นใหม่</span>}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

const LIST = "divide-y divide-border overflow-hidden rounded-xl border border-border";

/** The open repairs by building: the tickets with a new comment first, then one fold per building. */
export function BacklogView({ result }: { result: ReturnType<typeof groupBacklog> }) {
  const { unread, groups } = result;
  if (groups.length === 0) return <p className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">ไม่มีงานซ่อมค้าง</p>;
  return (
    <div className="space-y-6">
      {unread.length > 0 && (
        <section aria-labelledby="unread-h">
          <h2 id="unread-h" className="mb-2 font-semibold">
            ความเห็นใหม่ ({unread.length})
          </h2>
          <ul className={LIST}>
            {unread.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </ul>
        </section>
      )}
      {groups.map((g) => (
        <details key={g.building} open className="group">
          <summary className="mb-2 flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            <span>{g.building}</span>
            <span className="text-sm font-normal text-muted-foreground">ค้าง {g.total} ใบ</span>
            {g.urgent > 0 && <span className="rounded-full bg-red-700 px-2 py-0.5 text-xs font-semibold text-white">เร่งด่วน {g.urgent}</span>}
          </summary>
          <ul className={LIST}>
            {g.rows.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
