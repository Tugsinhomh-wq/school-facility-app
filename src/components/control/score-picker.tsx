"use client";

import { useState, type ReactNode } from "react";

import { RISK_TONE } from "@/components/control/risk-tone";
import { IMPACT, LIKELIHOOD } from "@/lib/control/forms";
import { LEVEL_LABEL, riskLevel, riskScore } from "@/lib/control/risk";
import { cn } from "@/lib/utils";

type Levels = { likelihood: number | null; impact: number | null };

/** One radio row: the number, its plain-language meaning, and a 44px target for the whole row. */
function Option({
  name,
  value,
  checked,
  onChange,
  disabled,
  required,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (v: string) => void;
  disabled?: boolean;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 items-start gap-3 px-3 py-2.5 has-checked:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-inset has-focus-visible:ring-ring/50",
        disabled ? "cursor-default" : "cursor-pointer hover:bg-muted/60",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        disabled={disabled}
        required={required}
        className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
      />
      <span className="min-w-0 text-base leading-snug md:text-sm">{children}</span>
    </label>
  );
}

function Axis({
  name,
  title,
  texts,
  value,
  onChange,
  disabled,
  ownerValue,
}: {
  name: string;
  title: string;
  texts: readonly string[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  /** The head's picker only: the owner's value, offered as "use that" (an empty choice). */
  ownerValue?: number | null;
}) {
  const head = ownerValue !== undefined;
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-2">
      <legend className="text-sm font-medium">{title}</legend>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {head && (
          <Option name={name} value="" checked={value === ""} onChange={onChange} disabled={disabled}>
            ใช้ค่าของเจ้าของ ({ownerValue === null ? "ยังไม่ให้" : ownerValue})
          </Option>
        )}
        {texts.map((text, k) => (
          <Option
            key={k}
            name={name}
            value={String(k + 1)}
            checked={value === String(k + 1)}
            onChange={onChange}
            disabled={disabled}
            required={!head && !disabled}
          >
            <span className="mr-2 font-semibold tabular-nums">{k + 1}</span>
            {text}
          </Option>
        ))}
      </div>
    </fieldset>
  );
}

const level = (s: string): number | null => (s === "" ? null : Number(s));

/**
 * Likelihood and impact, 1 to 5 each, with what every level means, and the score (L x I) and its
 * level shown as the choice is made. As the head's picker (`ownerLevels` given) an empty choice means
 * "use the owner's value on that axis", and the score shown is the one that will be used.
 */
export function ScorePicker({
  likelihoodName,
  impactName,
  initial,
  ownerLevels,
  disabled,
}: {
  likelihoodName: string;
  impactName: string;
  initial: Levels;
  ownerLevels?: Levels;
  disabled?: boolean;
}) {
  const [l, setL] = useState(initial.likelihood === null ? "" : String(initial.likelihood));
  const [i, setI] = useState(initial.impact === null ? "" : String(initial.impact));
  const useL = level(l) ?? ownerLevels?.likelihood ?? null;
  const useI = level(i) ?? ownerLevels?.impact ?? null;
  const score = riskScore(useL, useI);
  const lv = score === null ? null : riskLevel(score);
  const tone = lv && RISK_TONE[lv];

  return (
    <div className="space-y-4">
      <Axis
        name={likelihoodName}
        title="โอกาสเกิด (Likelihood)"
        texts={LIKELIHOOD}
        value={l}
        onChange={setL}
        disabled={disabled}
        ownerValue={ownerLevels?.likelihood}
      />
      <Axis
        name={impactName}
        title="ผลกระทบ (Impact)"
        texts={IMPACT}
        value={i}
        onChange={setI}
        disabled={disabled}
        ownerValue={ownerLevels?.impact}
      />
      <p role="status" className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 text-base md:text-sm">
        {score === null || !lv || !tone ? (
          <span className="text-muted-foreground">เลือกโอกาสเกิดและผลกระทบให้ครบ เพื่อดูคะแนน</span>
        ) : (
          <>
            <span>
              คะแนน = {useL} × {useI} = <span className="font-semibold tabular-nums">{score}</span>
            </span>
            <span aria-hidden>·</span>
            <span className={cn("inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 font-medium whitespace-nowrap", tone.className)}>
              <tone.icon className="size-4" aria-hidden />
              ระดับ{LEVEL_LABEL[lv]}
            </span>
          </>
        )}
      </p>
    </div>
  );
}
