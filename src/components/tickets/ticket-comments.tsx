import { CommentForm } from "@/components/tickets/comment-form";
import type { TicketComment } from "@/lib/data/ticket-comments";
import { formatDateTh } from "@/lib/ticket-meta";

/** The thread between the budget deputy and the facility staff on one ticket, oldest first, with the box to add to it. */
export function TicketComments({ ticketId, comments }: { ticketId: string; comments: TicketComment[] }) {
  return (
    <section aria-labelledby="comments-title" className="mt-8 border-t border-border pt-6">
      <h2 id="comments-title" className="font-semibold">
        ความเห็น
      </h2>
      {comments.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">ยังไม่มีความเห็น</p>
      ) : (
        <ol className="mt-3 space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg border border-border p-3">
              <p className="text-sm">
                <span className="font-medium">{c.author_name ?? "ไม่ทราบชื่อ"}</span>{" "}
                <time dateTime={c.created_at} className="text-muted-foreground">
                  {formatDateTh(c.created_at)}
                </time>
              </p>
              <p className="mt-1 max-w-[65ch] whitespace-pre-line leading-relaxed">{c.body}</p>
            </li>
          ))}
        </ol>
      )}
      <CommentForm ticketId={ticketId} />
    </section>
  );
}
