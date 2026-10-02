"use client";

import { useActionState } from "react";

import {
  mergeTicket,
  type UpdateResult,
} from "@/app/(dashboard)/tickets/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { DuplicateContext } from "@/lib/data/tickets";
import { timeAgoTh } from "@/lib/ticket-meta";
import { cn } from "@/lib/utils";
import type { TicketRow } from "@/types/tickets";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:[&>option]:bg-card";

/** Staff: merge a repeat report into the main ticket, see who else reported it, or split it out. */
export function MergePanel({
  ticket,
  ctx,
}: {
  ticket: TicketRow;
  ctx: DuplicateContext;
}) {
  const [state, action, pending] = useActionState<UpdateResult, FormData>(
    mergeTicket,
    null,
  );
  const merged = Boolean(ticket.duplicate_of);

  return (
    <section
      aria-labelledby="merge-title"
      className="mt-4 space-y-3 border-t border-border pt-4"
    >
      <h3 id="merge-title" className="text-sm font-semibold">
        รายงานซ้ำ
      </h3>

      {ctx.reports.length > 0 && (
        <ul className="space-y-1 text-sm">
          {ctx.reports.map((r) => (
            <li key={r.id} className="text-muted-foreground">
              {r.reporter_name ?? "ไม่ระบุ"} · {r.ticket_number} ·{" "}
              {timeAgoTh(r.created_at)}
            </li>
          ))}
        </ul>
      )}

      {merged ? (
        <form action={action} className="space-y-2">
          <input type="hidden" name="id" value={ticket.id} />
          <input type="hidden" name="split" value="1" />
          <p className="text-sm">
            รวมอยู่กับ {ticket.duplicate_of_number} สถานะตามงานหลัก
          </p>
          <Button
            type="submit"
            variant="outline"
            disabled={pending}
            className="w-full"
          >
            แยกออกจากงานหลัก
          </Button>
        </form>
      ) : ctx.candidates.length > 0 ? (
        <form action={action} className="space-y-2">
          <input type="hidden" name="id" value={ticket.id} />
          <div className="space-y-1.5">
            <Label htmlFor="main_id">รวมกับงานหลัก</Label>
            <select
              id="main_id"
              name="main_id"
              defaultValue=""
              required
              className={selectClass}
            >
              <option value="" disabled>
                เลือกงานในอาคารเดียวกัน
              </option>
              {ctx.candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.ticket_number} {c.title}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="submit"
            variant="outline"
            disabled={pending}
            className="w-full"
          >
            รวมเป็นรายงานซ้ำ
          </Button>
        </form>
      ) : (
        ctx.reports.length === 0 && (
          <p className="text-sm text-muted-foreground">
            ไม่มีงานเปิดอื่นในอาคารนี้ให้รวม
          </p>
        )
      )}

      {state && (
        <p
          role={state.ok ? "status" : "alert"}
          className={cn(
            "text-sm",
            state.ok
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-destructive",
          )}
        >
          {state.message}
        </p>
      )}
    </section>
  );
}
