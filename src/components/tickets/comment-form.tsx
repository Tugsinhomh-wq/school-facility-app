"use client";

import { useActionState, useEffect, useRef } from "react";

import { markTicketRead, postComment, type CommentResult } from "@/app/(dashboard)/tickets/comment-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COMMENT_MAX } from "@/lib/ticket-comments";
import { cn } from "@/lib/utils";

/** The box under the thread. The text is cleared once the comment is saved. */
export function CommentForm({ ticketId }: { ticketId: string }) {
  const [state, action, pending] = useActionState<CommentResult, FormData>(postComment, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="mt-4 space-y-3">
      <input type="hidden" name="ticket_id" value={ticketId} />
      <div className="space-y-1.5">
        <Label htmlFor="comment-body">เขียนความเห็น</Label>
        <Textarea id="comment-body" name="body" rows={3} maxLength={COMMENT_MAX} required placeholder="เช่น ขอให้ซ่อมจุดนี้ก่อน หรือรอตัดสินใจเรื่องงบ" />
      </div>
      {state && (
        <p role={state.ok ? "status" : "alert"} className={cn("text-sm", state.ok ? "text-emerald-800" : "text-destructive")}>
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-11 w-full sm:w-auto">
        {pending ? "กำลังส่ง..." : "ส่งความเห็น"}
      </Button>
    </form>
  );
}

/** Tells the server this person has opened the ticket, so its "new comment" marker goes away. Renders nothing. */
export function MarkRead({ ticketId }: { ticketId: string }) {
  useEffect(() => {
    void markTicketRead(ticketId);
  }, [ticketId]);
  return null;
}
