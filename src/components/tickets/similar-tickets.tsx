"use client";

import { useEffect, useState } from "react";

import { looksSimilar } from "@/lib/similar";
import { createClient } from "@/lib/supabase/client";
import { STATUS_LABEL, timeAgoTh } from "@/lib/ticket-meta";
import type { TicketStatus } from "@/types/database";
import { cn } from "@/lib/utils";

interface Open {
  id: string;
  ticket_number: string;
  title: string;
  location_detail: string | null;
  status: TicketStatus;
  created_at: string;
  reporter_name: string | null;
  report_count: number;
}

/**
 * Before a report is sent: open tickets in the same building that look like it. The teacher can
 * join one (the form then posts duplicate_of) or carry on with a new report. Names are shown so
 * colleagues can talk to each other.
 */
export function SimilarTickets({
  buildingId,
  text,
  nameId = "duplicate_of",
}: {
  buildingId: string;
  text: string;
  nameId?: string;
}) {
  const [open, setOpen] = useState<Open[]>([]);
  const [joined, setJoined] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!buildingId) return;
    let cancelled = false;
    void createClient()
      .rpc("similar_open_tickets", { p_building: buildingId })
      .then(({ data }) => {
        if (!cancelled) setOpen((data as Open[] | null) ?? []);
      });
    return () => {
      cancelled = true;
      setOpen([]);
      setJoined(null);
    };
  }, [buildingId]);

  const matches = buildingId
    ? open.filter(
        (t) =>
          looksSimilar(text, `${t.title}${t.location_detail ?? ""}`) &&
          !dismissed.has(t.id),
      )
    : [];
  const chosen = joined ? open.find((t) => t.id === joined) : null;

  if (chosen) {
    return (
      <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm">
        <input type="hidden" name={nameId} value={chosen.id} />
        <p className="font-medium">รวมกับงาน {chosen.ticket_number}</p>
        <p className="text-muted-foreground">
          {chosen.title} · แจ้งโดย {chosen.reporter_name ?? "ไม่ระบุ"} ·
          สถานะจะตามงานนี้
        </p>
        <button
          type="button"
          onClick={() => setJoined(null)}
          className="mt-1 text-primary underline underline-offset-4"
        >
          ไม่รวม ส่งเป็นงานใหม่
        </button>
      </div>
    );
  }

  if (matches.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="งานที่คล้ายกัน"
      className="space-y-2 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-sm"
    >
      <p className="font-medium">
        มีคนแจ้งเรื่องคล้ายกันในอาคารนี้แล้ว ใช่เรื่องเดียวกันไหม
      </p>
      <ul className="space-y-2">
        {matches.slice(0, 3).map((t) => (
          <li
            key={t.id}
            className="rounded-lg border border-border bg-background/70 p-2.5"
          >
            <p className="font-medium">{t.title}</p>
            <p className="text-xs text-muted-foreground">
              {t.ticket_number} · {STATUS_LABEL[t.status]} ·{" "}
              {timeAgoTh(t.created_at)}
              {t.location_detail ? ` · ${t.location_detail}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              แจ้งโดย {t.reporter_name ?? "ไม่ระบุ"}
              {t.report_count > 1 ? ` และอีก ${t.report_count - 1} คน` : ""}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setJoined(t.id)}
                className={cn(
                  "min-h-10 rounded-lg bg-primary px-2 text-sm font-medium text-primary-foreground",
                )}
              >
                เจอเหมือนกัน รวมกับงานนี้
              </button>
              <button
                type="button"
                onClick={() => setDismissed((d) => new Set(d).add(t.id))}
                className="min-h-10 rounded-lg border border-input px-2 text-sm"
              >
                ไม่ใช่ ส่งใหม่
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
