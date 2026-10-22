"use client";

import { reviewProject } from "@/app/(dashboard)/control/actions";
import { Field, Result, selectClass, useControlAction } from "@/components/control/form-kit";
import { ScorePicker } from "@/components/control/score-picker";
import { Button } from "@/components/ui/button";

export type MissionOption = { id: string; name: string; note?: string };

/**
 * The head's side of a project, for officers only (the server checks it again): the head's own
 * likelihood and impact (an empty choice keeps the owner's value on that axis), the mission, and
 * confirm / withdraw the confirmation. "บันทึก" saves without touching the confirmation.
 */
export function ReviewForm({
  projectId,
  ownerLevels,
  headLevels,
  missionId,
  missions,
  missionsFailed,
  confirmed,
  retryHref,
}: {
  projectId: string;
  ownerLevels: { likelihood: number | null; impact: number | null };
  headLevels: { likelihood: number | null; impact: number | null };
  missionId: string | null;
  missions: MissionOption[];
  /** The mission list could not be read: only the project's current mission is offered. */
  missionsFailed?: boolean;
  confirmed: boolean;
  retryHref: string;
}) {
  const { state, pending, onSubmit } = useControlAction(reviewProject);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="id" value={projectId} />
      <ScorePicker likelihoodName="head_likelihood" impactName="head_impact" initial={headLevels} ownerLevels={ownerLevels} />

      <Field
        id={`${projectId}-mission`}
        label="ภารกิจที่ผูก"
        hint="แสดงเฉพาะภารกิจของกลุ่มงานและปีงบประมาณเดียวกับโครงการ"
      >
        <select
          id={`${projectId}-mission`}
          name="mission_id"
          defaultValue={missionId ?? ""}
          aria-describedby={`${projectId}-mission-hint`}
          className={selectClass}
        >
          <option value="">ไม่ผูกภารกิจ</option>
          {missions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name || "(ไม่มีชื่อ)"}
              {m.note ? ` ${m.note}` : ""}
            </option>
          ))}
        </select>
      </Field>
      {missionsFailed && (
        <p role="alert" className="text-sm text-destructive">
          โหลดรายการภารกิจไม่สำเร็จ{" "}
          <a href={retryHref} className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">
            ลองใหม่
          </a>
        </p>
      )}

      <Result state={state} />
      {/* "บันทึก" is first so that Enter in the form never confirms by accident. */}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={pending} className="h-11 flex-1 sm:flex-none">
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
        <Button type="submit" name="confirm" value={confirmed ? "0" : "1"} disabled={pending} className="h-11 flex-1 sm:flex-none">
          {confirmed ? "ยกเลิกการยืนยัน" : "ยืนยันโครงการ"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {confirmed
          ? "ยกเลิกการยืนยันเพื่อให้เจ้าของแก้ข้อมูลและคะแนนได้อีกครั้ง"
          : "เมื่อยืนยันแล้ว เจ้าของแก้ข้อมูลและคะแนนไม่ได้ (เจ้าหน้าที่ยังแก้ได้)"}
      </p>
    </form>
  );
}
