import { describeEvent, type TicketEvent } from "@/lib/ticket-events";
import { formatDateTh } from "@/lib/ticket-meta";

/** What happened to a ticket, oldest first, starting from the report itself. Teachers see their own tickets' history too. */
export function TicketTimeline({ createdAt, events }: { createdAt: string; events: TicketEvent[] }) {
  return (
    <section aria-labelledby="timeline-title" className="mt-8 border-t border-border pt-6">
      <h2 id="timeline-title" className="font-semibold">
        ประวัติการดำเนินการ
      </h2>
      <ol className="mt-3 space-y-3 border-l border-border pl-4">
        <li>
          <p className="font-medium">แจ้งซ่อมเข้ามา</p>
          <time dateTime={createdAt} className="text-sm text-muted-foreground">
            {formatDateTh(createdAt)}
          </time>
        </li>
        {events.map((e) => {
          const { who, what } = describeEvent(e);
          return (
            <li key={e.id}>
              <p>
                <span className="font-medium">{who}</span> {what}
              </p>
              <time dateTime={e.created_at} className="text-sm text-muted-foreground">
                {formatDateTh(e.created_at)}
              </time>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
