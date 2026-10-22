"use client";

import { Check, ChevronDown, Circle, CircleDashed, type LucideIcon } from "lucide-react";
import { useActionState } from "react";

import { deleteAction, saveAction, type ControlResult } from "@/app/(dashboard)/control/actions";
import { areaClass, Field, fieldClass, Result, sectionHeading, selectClass, useControlAction } from "@/components/control/form-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ACTION_STATUSES, type ActionStatus } from "@/lib/control/forms";
import { MAX_NAME, MAX_TEXT } from "@/lib/control/parse";
import type { ControlAction } from "@/lib/control/types";
import { formatDayShort } from "@/lib/time";

export const STATUS_VIEW: Record<ActionStatus, { icon: LucideIcon; className: string }> = {
  open: { icon: Circle, className: "text-amber-800" },
  doing: { icon: CircleDashed, className: "text-primary" },
  done: { icon: Check, className: "text-emerald-800" },
};
export const statusLabel = (s: ActionStatus) => ACTION_STATUSES.find((x) => x.key === s)?.label ?? s;

/** Icon + word, so the status never depends on colour. */
function StatusText({ status }: { status: ActionStatus }) {
  const { icon: Icon, className } = STATUS_VIEW[status];
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${className}`}>
      <Icon className="size-4" aria-hidden />
      {statusLabel(status)}
    </span>
  );
}

/** "จ. 5 ต.ค. 2569": a due date can fall in either half of the fiscal year, so the year is shown. */
export const dueLabel = (ymd: string) => `${formatDayShort(ymd)} ${Number(ymd.slice(0, 4)) + 543}`;

function Meta({ action }: { action: ControlAction }) {
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
      <StatusText status={action.status} />
      {action.responsible && <span className="break-words">{action.responsible}</span>}
      {action.due && <span>กำหนดเสร็จ {dueLabel(action.due)}</span>}
    </span>
  );
}

/** The four fields of a measure, empty (adding) or filled (editing). */
function ActionFields({ idp, action }: { idp: string; action?: ControlAction }) {
  return (
    <>
      <Field id={`${idp}-desc`} label="มาตรการปรับปรุง">
        <Textarea
          id={`${idp}-desc`}
          name="description"
          defaultValue={action?.description}
          required
          maxLength={MAX_TEXT}
          placeholder="เช่น จัดทำคู่มือขั้นตอนการเบิกจ่ายและอบรมผู้เกี่ยวข้อง"
          className={areaClass}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${idp}-who`} label="ผู้รับผิดชอบ" hint="พิมพ์เป็นชื่อได้ ไม่ต้องมีบัญชีในระบบ">
          <Input
            id={`${idp}-who`}
            name="responsible"
            defaultValue={action?.responsible}
            maxLength={MAX_NAME}
            aria-describedby={`${idp}-who-hint`}
            className={fieldClass}
          />
        </Field>
        <Field id={`${idp}-due`} label="กำหนดเสร็จ">
          <Input id={`${idp}-due`} name="due" type="date" defaultValue={action?.due ?? ""} className={fieldClass} />
        </Field>
      </div>
      <Field id={`${idp}-status`} label="สถานะ">
        <select id={`${idp}-status`} name="status" defaultValue={action?.status ?? "open"} className={selectClass}>
          {ACTION_STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

/** One measure, folded to a summary line; open it to change it or remove it. */
function ActionEditor({ action }: { action: ControlAction }) {
  const { ref, state, pending, onSubmit } = useControlAction(saveAction);
  const [removed, remove, removing] = useActionState<ControlResult, FormData>((_prev, formData) => deleteAction(formData), null);
  return (
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-lg px-2 py-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 font-medium break-words whitespace-pre-line">{action.description}</span>
          <Meta action={action} />
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-4 px-2 pt-1 pb-4">
        <form ref={ref} onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="id" value={action.id} />
          <ActionFields idp={action.id} action={action} />
          <Result state={state} />
          <Button type="submit" disabled={pending} className="h-11 w-full sm:w-auto">
            {pending ? "กำลังบันทึก..." : "บันทึกมาตรการ"}
          </Button>
        </form>
        {/* Two clicks: opening this section, then the red button inside it. */}
        <details className="group/del rounded-xl border border-border">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 font-medium text-destructive outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            <span className="flex-1">ลบมาตรการนี้</span>
            <ChevronDown className="size-4 shrink-0 transition-transform group-open/del:rotate-180" aria-hidden />
          </summary>
          <form action={remove} className="space-y-3 border-t border-border px-4 py-4">
            <input type="hidden" name="id" value={action.id} />
            <p className="line-clamp-3 break-words whitespace-pre-line">
              ลบมาตรการ &ldquo;{action.description}&rdquo; ลบแล้วเอากลับคืนไม่ได้
            </p>
            <Result state={removed} />
            <Button type="submit" variant="destructive" disabled={removing} className="h-11 w-full sm:w-auto">
              {removing ? "กำลังลบ..." : "ยืนยันลบมาตรการ"}
            </Button>
          </form>
        </details>
      </div>
    </details>
  );
}

function AddAction({ projectId }: { projectId: string }) {
  const { ref, state, pending, onSubmit } = useControlAction(saveAction, true);
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-4 border-t border-border pt-6">
      <h3 className={sectionHeading}>เพิ่มมาตรการ</h3>
      <input type="hidden" name="project_id" value={projectId} />
      <ActionFields idp="new-action" />
      <Result state={state} />
      <Button type="submit" disabled={pending} className="h-11 w-full sm:w-auto">
        {pending ? "กำลังเพิ่ม..." : "เพิ่มมาตรการ"}
      </Button>
    </form>
  );
}

/**
 * The improvement measures of one project: what is to be done, by whom, by when, and where it stands.
 * `editable` is the owner (even after the head confirmed the project) or an officer.
 */
export function ActionsList({ projectId, actions, editable }: { projectId: string; actions: ControlAction[]; editable: boolean }) {
  return (
    <div className="space-y-4">
      {actions.length > 0 ? (
        <ul className="divide-y divide-border">
          {actions.map((a) => (
            <li key={a.id}>
              {editable ? (
                <ActionEditor action={a} />
              ) : (
                <div className="px-2 py-3">
                  <p className="font-medium break-words whitespace-pre-line">{a.description}</p>
                  <Meta action={a} />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{editable ? "ยังไม่มีมาตรการ เพิ่มมาตรการได้ด้านล่าง" : "ยังไม่มีมาตรการปรับปรุง"}</p>
      )}
      {editable && <AddAction projectId={projectId} />}
    </div>
  );
}
