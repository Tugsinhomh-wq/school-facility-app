"use client";

import { ChevronDown } from "lucide-react";
import { useActionState } from "react";

import { deleteMission, saveMission, type ControlResult } from "@/app/(dashboard)/control/actions";
import { areaClass, Field, fieldClass, Result, selectClass, useControlAction } from "@/components/control/form-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CSA_FIELD, CSA_STEPS, GROUPS, type GroupKey } from "@/lib/control/forms";
import { MAX_NAME, MAX_TEXT } from "@/lib/control/parse";
import type { ControlMission } from "@/lib/control/types";

/**
 * Add a mission: a name and a group, in the fiscal year the list is showing. Saving opens the new
 * mission's page (the server redirects), where the five CSA steps are filled in.
 */
export function NewMissionForm({ fiscalYear, groupKey }: { fiscalYear: number; groupKey?: GroupKey }) {
  const { state, pending, onSubmit } = useControlAction(saveMission);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="fiscal_year" value={fiscalYear} />
      <p className="text-sm text-muted-foreground">
        ภารกิจใหม่จะอยู่ในปีงบประมาณ {fiscalYear} ถ้าต้องการปีอื่น ให้เปลี่ยนปีที่ด้านบนก่อน
      </p>
      <Field id="new-mission-group" label="กลุ่มงาน">
        <select id="new-mission-group" name="group_key" defaultValue={groupKey ?? ""} required className={selectClass}>
          <option value="" disabled>
            เลือกกลุ่มงาน
          </option>
          {GROUPS.map((g) => (
            <option key={g.key} value={g.key}>
              {g.label}
            </option>
          ))}
        </select>
      </Field>
      <Field id="new-mission-name" label="ชื่อภารกิจ">
        <Input id="new-mission-name" name="name" required maxLength={MAX_NAME} autoComplete="off" className={fieldClass} />
      </Field>
      <Result state={state} />
      <Button type="submit" disabled={pending} className="h-11 w-full sm:w-auto">
        {pending ? "กำลังเพิ่ม..." : "เพิ่มภารกิจ"}
      </Button>
    </form>
  );
}

/** The mission's name and its five CSA steps (labels and hints from CSA_STEPS), saved together with one button. */
export function MissionForm({ mission }: { mission: ControlMission }) {
  const { state, pending, onSubmit } = useControlAction(saveMission);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="id" value={mission.id} />
      <Field id={`${mission.id}-name`} label="ชื่อภารกิจ">
        <Input id={`${mission.id}-name`} name="name" defaultValue={mission.name} required maxLength={MAX_NAME} className={fieldClass} />
      </Field>
      {CSA_STEPS.map((s) => {
        const name = CSA_FIELD[s.n];
        return (
          <Field key={s.n} id={`${mission.id}-${name}`} label={`${s.n}. ${s.label}`} hint={s.hint}>
            <Textarea
              id={`${mission.id}-${name}`}
              name={name}
              defaultValue={mission[name]}
              maxLength={MAX_TEXT}
              aria-describedby={`${mission.id}-${name}-hint`}
              className={areaClass}
            />
          </Field>
        );
      })}
      <Result state={state} />
      <Button type="submit" disabled={pending} className="h-11 w-full sm:w-auto">
        {pending ? "กำลังบันทึก..." : "บันทึกภารกิจ"}
      </Button>
    </form>
  );
}

/**
 * Remove the mission, behind a confirmation: opening the section is the first click, the red button
 * inside is the second. On success the server redirects to the list (this page would be a 404).
 * `linked` is how many projects point at it now, or null when that could not be read.
 */
export function DeleteMission({ missionId, name, linked }: { missionId: string; name: string; linked: number | null }) {
  const [state, run, pending] = useActionState<ControlResult, FormData>((_prev, formData) => deleteMission(formData), null);
  return (
    <details className="group rounded-xl border border-border">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 font-medium text-destructive outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <span className="flex-1">ลบภารกิจนี้</span>
        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <form action={run} className="space-y-3 border-t border-border px-4 py-4">
        <input type="hidden" name="id" value={missionId} />
        <p className="break-words">
          ลบภารกิจ &ldquo;{name || "(ไม่มีชื่อ)"}&rdquo; พร้อมข้อความ CSA ทั้ง 5 ขั้นตอน ลบแล้วเอากลับคืนไม่ได้
        </p>
        <p className="text-sm text-muted-foreground">
          {linked === null || linked > 0
            ? `โครงการที่ผูกอยู่${linked ? ` ${linked} โครงการ` : ""}จะไม่ถูกลบ แต่จะไม่ได้ผูกกับภารกิจใดอีก`
            : "ไม่มีโครงการผูกอยู่กับภารกิจนี้"}
        </p>
        <Result state={state} />
        <Button type="submit" variant="destructive" disabled={pending} className="h-11 w-full sm:w-auto">
          {pending ? "กำลังลบ..." : "ยืนยันลบภารกิจ"}
        </Button>
      </form>
    </details>
  );
}
