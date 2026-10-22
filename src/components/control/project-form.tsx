"use client";

import { saveProject, scoreProject } from "@/app/(dashboard)/control/actions";
import { areaClass, Field, fieldClass, Result, sectionHeading, selectClass, useControlAction } from "@/components/control/form-kit";
import { ScorePicker } from "@/components/control/score-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GROUPS, RISK_TYPES, type GroupKey } from "@/lib/control/forms";
import { MAX_NAME, MAX_TEXT } from "@/lib/control/parse";
import type { ControlProject } from "@/lib/control/types";

type TextKey = "objective" | "riskIssue" | "riskCause" | "riskImpact" | "existingControls" | "assessment" | "residualRisk";

// [form field, project key, label, hint]. The three under "การควบคุมภายใน" are the columns of ปค.5.
const RISK_FIELDS: readonly (readonly [string, TextKey, string, string])[] = [
  ["risk_issue", "riskIssue", "ประเด็นความเสี่ยง", "อะไรอาจทำให้โครงการไม่เป็นไปตามเป้าหมาย"],
  ["risk_cause", "riskCause", "สาเหตุของความเสี่ยง", "ทำไมจึงเสี่ยง"],
  ["risk_impact", "riskImpact", "ผลกระทบของความเสี่ยง", "ถ้าเกิดขึ้นจริง จะเสียหายอะไร"],
];
const CONTROL_FIELDS: readonly (readonly [string, TextKey, string, string])[] = [
  ["existing_controls", "existingControls", "การควบคุมภายในที่มีอยู่", "สิ่งที่ทำอยู่แล้วเพื่อป้องกันความเสี่ยงนี้"],
  ["assessment", "assessment", "การประเมินผลการควบคุมภายใน", "การควบคุมที่มีอยู่เพียงพอหรือไม่"],
  ["residual_risk", "residualRisk", "ความเสี่ยงที่ยังมีอยู่", "ความเสี่ยงที่ยังเหลือหลังมีการควบคุมแล้ว"],
];

/**
 * Add a project (no `project`) or edit one. `editable` false closes every field (the page says why);
 * the server refuses the save in that case as well. Year and group are fields only for an officer
 * when editing; the owner's email is an officer's field and is never filled in: empty means "keep the owner".
 */
export function ProjectForm({
  officer,
  project,
  start,
  editable = true,
}: {
  officer: boolean;
  project?: ControlProject;
  /** Adding: the year and group to start from. */
  start?: { fiscalYear: number; groupKey?: GroupKey };
  editable?: boolean;
}) {
  const { ref, state, pending, onSubmit } = useControlAction(saveProject);
  const idp = project?.id ?? "new";
  const showYearGroup = !project || officer;

  const textArea = ([name, key, label, hint]: readonly [string, TextKey, string, string]) => (
    <Field key={name} id={`${idp}-${name}`} label={label} hint={hint}>
      <Textarea
        id={`${idp}-${name}`}
        name={name}
        defaultValue={project?.[key] ?? ""}
        maxLength={MAX_TEXT}
        aria-describedby={`${idp}-${name}-hint`}
        className={areaClass}
      />
    </Field>
  );

  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-4">
      <fieldset disabled={!editable} className="min-w-0 space-y-4">
        <legend className="sr-only">{project ? "ข้อมูลโครงการ" : "โครงการใหม่"}</legend>
        {project && <input type="hidden" name="id" value={project.id} />}

        {showYearGroup && (
          <div className="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <Field id={`${idp}-fy`} label="ปีงบประมาณ (พ.ศ.)">
              <Input
                id={`${idp}-fy`}
                name="fiscal_year"
                defaultValue={project?.fiscalYear ?? start?.fiscalYear}
                required
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                className={fieldClass}
              />
            </Field>
            <Field id={`${idp}-group`} label="กลุ่มงาน">
              <select
                id={`${idp}-group`}
                name="group_key"
                defaultValue={project?.groupKey ?? start?.groupKey ?? ""}
                required
                className={selectClass}
              >
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
          </div>
        )}

        <Field id={`${idp}-name`} label="ชื่อโครงการ">
          <Input id={`${idp}-name`} name="name" defaultValue={project?.name} required maxLength={MAX_NAME} className={fieldClass} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${idp}-budget`} label="งบประมาณ (บาท)" hint="เว้นว่างถ้าไม่มีงบประมาณ">
            <Input
              id={`${idp}-budget`}
              name="budget"
              defaultValue={project?.budget ?? ""}
              inputMode="decimal"
              autoComplete="off"
              placeholder="เช่น 120000"
              aria-describedby={`${idp}-budget-hint`}
              className={fieldClass}
            />
          </Field>
          {officer && (
            <Field
              id={`${idp}-owner`}
              label="อีเมลเจ้าของโครงการ"
              hint={
                project
                  ? `เจ้าของตอนนี้คือ ${project.ownerName} เว้นว่างไว้ถ้าไม่เปลี่ยนเจ้าของ`
                  : "เว้นว่างถ้าเป็นโครงการของคุณเอง ถ้าใส่ ต้องเป็นอีเมลที่เคยเข้าสู่ระบบแล้ว"
              }
            >
              <Input
                id={`${idp}-owner`}
                name="owner_email"
                inputMode="email"
                autoComplete="off"
                spellCheck={false}
                placeholder="somying@lrp.ac.th"
                aria-describedby={`${idp}-owner-hint`}
                className={fieldClass}
              />
            </Field>
          )}
        </div>

        {textArea(["objective", "objective", "วัตถุประสงค์ของโครงการ", "โครงการนี้ต้องการให้เกิดอะไร"])}

        <div className="space-y-4 border-t border-border pt-6">
          <h3 className={sectionHeading}>ความเสี่ยง</h3>
          {RISK_FIELDS.map(textArea)}
          <Field id={`${idp}-type`} label="ประเภทความเสี่ยง">
            <select id={`${idp}-type`} name="risk_type" defaultValue={project?.riskType ?? ""} className={selectClass}>
              <option value="">ยังไม่ระบุ</option>
              {RISK_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label} ({t.key})
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="space-y-4 border-t border-border pt-6">
          <h3 className={sectionHeading}>การควบคุมภายใน (ข้อความนี้ลงในตาราง ปค.5)</h3>
          {CONTROL_FIELDS.map(textArea)}
        </div>
      </fieldset>

      <Result state={state} />
      {editable && (
        <Button type="submit" disabled={pending} className="h-11 w-full sm:w-auto">
          {pending ? "กำลังบันทึก..." : project ? "บันทึกโครงการ" : "เพิ่มโครงการ"}
        </Button>
      )}
    </form>
  );
}

/** The owner's own likelihood and impact (both required), saved on their own so a score never waits on the long form. */
export function ScoreForm({
  projectId,
  likelihood,
  impact,
  editable,
}: {
  projectId: string;
  likelihood: number | null;
  impact: number | null;
  editable: boolean;
}) {
  const { state, pending, onSubmit } = useControlAction(scoreProject);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="id" value={projectId} />
      <ScorePicker likelihoodName="likelihood" impactName="impact" initial={{ likelihood, impact }} disabled={!editable} />
      <Result state={state} />
      {editable && (
        <Button type="submit" disabled={pending} className="h-11 w-full sm:w-auto">
          {pending ? "กำลังบันทึก..." : "บันทึกคะแนน"}
        </Button>
      )}
    </form>
  );
}
