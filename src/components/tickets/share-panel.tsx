"use client";

import { useActionState } from "react";

import { shareWithDeputy, unshareFromDeputy, type CommentResult } from "@/app/(dashboard)/tickets/comment-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TicketShare } from "@/lib/data/ticket-shares";
import { COMMENT_MAX } from "@/lib/ticket-comments";
import { formatDateTh } from "@/lib/ticket-meta";
import { cn } from "@/lib/utils";

/** Staff: send this ticket to the budget deputy with a message, or take it back. */
export function SharePanel({ ticketId, share }: { ticketId: string; share: TicketShare | null }) {
  const [state, action, pending] = useActionState<CommentResult, FormData>(shareWithDeputy, null);
  return (
    <section aria-labelledby="share-title" className="mt-4 border-t border-border pt-4">
      <h3 id="share-title" className="mb-2 font-semibold">
        ขอความเห็นรองงบประมาณ
      </h3>
      {share ? (
        <form action={unshareFromDeputy} className="space-y-3">
          <input type="hidden" name="ticket_id" value={ticketId} />
          <p className="text-sm text-muted-foreground">
            ส่งให้รองเมื่อ {formatDateTh(share.shared_at)}
            {share.shared_by_name ? ` โดย ${share.shared_by_name}` : ""} รองเห็นใบนี้และเธรดความเห็นอยู่
          </p>
          <Button type="submit" variant="outline" className="h-11 w-full">
            ยกเลิกการส่ง
          </Button>
        </form>
      ) : (
        <form action={action} className="space-y-3">
          <input type="hidden" name="ticket_id" value={ticketId} />
          <div className="space-y-1.5">
            <Label htmlFor="share-body">ข้อความถึงรอง</Label>
            <Textarea id="share-body" name="body" rows={3} maxLength={COMMENT_MAX} required placeholder="เช่น ขอซื้อก๊อกน้ำ ประมาณ 2,500 บาท" />
          </div>
          {state && (
            <p role={state.ok ? "status" : "alert"} className={cn("text-sm", state.ok ? "text-emerald-800" : "text-destructive")}>
              {state.message}
            </p>
          )}
          <Button type="submit" disabled={pending} className="h-11 w-full">
            {pending ? "กำลังส่ง..." : "ส่งให้รองเห็น"}
          </Button>
        </form>
      )}
    </section>
  );
}
