"use client";

import { AlertCircle, Clock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { saveAction } from "@/app/(dashboard)/control/actions";
import { dueLabel, STATUS_VIEW, statusLabel } from "@/components/control/actions-list";
import { Result, useControlAction } from "@/components/control/form-kit";
import { dueText, type FollowUpItem } from "@/lib/control/follow-up";
import { ACTION_STATUSES, type ActionStatus } from "@/lib/control/forms";
import { cn } from "@/lib/utils";

export type FollowUpRowData = { item: FollowUpItem; editable: boolean };

/** Overdue and soon get an icon and a coloured word; the rest is plain grey text. */
const DUE_VIEW = {
  overdue: { icon: AlertCircle, className: "font-medium text-red-700" },
  soon: { icon: Clock, className: "font-medium text-amber-800" },
} as const;

function Due({ item, status }: { item: FollowUpItem; status: ActionStatus }) {
  // A row changed here keeps the position it was loaded in; a done measure (or a reopened one) has no countdown.
  const text = status === "done" || item.bucket === "done" ? null : dueText(item);
  const view = status !== "done" && (item.bucket === "overdue" || item.bucket === "soon") ? DUE_VIEW[item.bucket] : null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1.5", view?.className)}>
      {view && <view.icon className="size-4" aria-hidden />}
      {text}
      {item.due && <span className="font-normal text-muted-foreground">{text ? "· " : "กำหนด "}{dueLabel(item.due)}</span>}
    </span>
  );
}

/** Icon + word on a light wash, like the pills elsewhere; the colour only backs the word up. */
function StatusPill({ status }: { status: ActionStatus }) {
  const { icon: Icon, className } = STATUS_VIEW[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium whitespace-nowrap", className)}>
      <Icon className="size-4" aria-hidden />
      {statusLabel(status)}
    </span>
  );
}

/** Three 44px buttons posting `id` + `status` to saveAction, which updates only that field. */
function StatusButtons({ id, current, onSaved }: { id: string; current: ActionStatus; onSaved: (s: ActionStatus) => void }) {
  const { ref, state, pending, onSubmit } = useControlAction(async (prev, formData) => {
    const r = await saveAction(prev, formData);
    if (r?.ok) onSaved(formData.get("status") as ActionStatus);
    return r;
  });
  // Not `disabled` while saving: that would drop the focus from the button just pressed.
  return (
    <form ref={ref} onSubmit={(e) => (pending ? e.preventDefault() : onSubmit(e))} className="space-y-1.5">
      <input type="hidden" name="id" value={id} />
      <div role="group" aria-label="เปลี่ยนสถานะมาตรการ" className="flex w-full overflow-hidden rounded-lg border border-border sm:inline-flex sm:w-auto">
        {ACTION_STATUSES.map((s) => {
          const { icon: Icon } = STATUS_VIEW[s.key];
          const on = current === s.key;
          return (
            <button
              key={s.key}
              type="submit"
              name="status"
              value={s.key}
              aria-pressed={on}
              aria-disabled={pending}
              className={cn(
                "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 border-l border-border px-3 text-sm outline-none first:border-l-0 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 aria-disabled:opacity-60 sm:min-w-24 sm:flex-none",
                on ? "bg-primary font-medium text-primary-foreground" : "bg-card hover:bg-muted",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {s.label}
            </button>
          );
        })}
      </div>
      <Result state={state} />
    </form>
  );
}

function Row({ item, editable, showOwner }: FollowUpRowData & { showOwner: boolean }) {
  const [status, setStatus] = useState(item.status);
  return (
    <li className="space-y-1 px-4 py-4 sm:px-5">
      <p className="font-semibold break-words whitespace-pre-line">{item.description}</p>
      <Link
        href={`/control/projects/${item.projectId}`}
        className="inline-flex min-h-11 items-center text-sm font-medium break-words text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {item.projectName}
      </Link>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
        <StatusPill status={status} />
        <Due item={item} status={status} />
        <span className="break-words">{item.responsible ? `ผู้รับผิดชอบ ${item.responsible}` : "ไม่ระบุผู้รับผิดชอบ"}</span>
        {showOwner && <span className="break-words">เจ้าของโครงการ {item.ownerName}</span>}
      </p>
      {editable && (
        <div className="pt-2">
          <StatusButtons id={item.actionId} current={status} onSaved={setStatus} />
        </div>
      )}
    </li>
  );
}

/**
 * The measures of the chosen view. The rows are kept as loaded (the page gives this list a key per
 * view): saving a status re-renders the page with the measure already in its new bucket, and a row
 * that vanished under the person's finger, with the answer and the focus, would be worse than one
 * that stays until the next visit.
 */
export function FollowUpList({ rows, showOwner }: { rows: FollowUpRowData[]; showOwner: boolean }) {
  const [kept] = useState(rows);
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {kept.map((r) => (
        <Row key={r.item.actionId} {...r} showOwner={showOwner} />
      ))}
    </ul>
  );
}
