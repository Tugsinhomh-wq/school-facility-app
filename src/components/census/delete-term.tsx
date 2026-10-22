"use client";

import { ChevronDown } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";

import { deleteTermRoster, type CensusResult } from "@/app/(dashboard)/census/actions";
import { Result } from "@/components/census/kit";
import { Field, fieldClass } from "@/components/control/form-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { termConfirmed } from "@/lib/census-view";

/**
 * Delete every student of the term, behind a fold and a typed confirmation: opening the section is
 * the first step, typing the term is the second, and the button stays shut until it matches. The
 * server checks the same again. Shown to officers only.
 */
export function DeleteTermRoster({ term }: { term: string }) {
  const [typed, setTyped] = useState("");
  const [state, dispatch, pending] = useActionState<CensusResult, FormData>(async (prev, formData) => {
    const r = await deleteTermRoster(prev, formData);
    if (r?.ok) setTyped("");
    return r;
  }, null);
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => resultRef.current?.focus(), [state]);
  // By hand, so a refused delete keeps what was typed (a plain form action would clear it).
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  };

  return (
    <details className="group rounded-xl border border-border">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 font-medium text-destructive outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <span className="flex-1">ลบรายชื่อทั้งภาค</span>
        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <form onSubmit={onSubmit} className="space-y-3 border-t border-border px-4 py-4">
        <input type="hidden" name="term" value={term} />
        <p className="text-sm">
          ลบรายชื่อนักเรียนของทุกห้องในภาคเรียน {term} รวมนักเรียนของห้องที่ปิดใช้งานในภาคนี้ด้วย (ห้องเหล่านั้นไม่อยู่ในจำนวนห้องที่แสดง)
          ลบแล้วเอากลับคืนในระบบไม่ได้ ไฟล์สำรองข้อมูลยังเก็บสำเนาที่เข้ารหัสไว้อีกไม่เกิน 60 วัน
        </p>
        <Field id="delete-term-confirm" label={`พิมพ์ ${term} เพื่อยืนยัน`}>
          <Input
            id="delete-term-confirm"
            name="confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={term}
            className={fieldClass}
          />
        </Field>
        <Result state={state} ref={resultRef} />
        <Button type="submit" variant="destructive" disabled={pending || !termConfirmed(typed, term)} className="h-11 w-full sm:w-auto">
          {pending ? "กำลังลบ..." : `ลบรายชื่อทั้งภาค ${term}`}
        </Button>
      </form>
    </details>
  );
}
