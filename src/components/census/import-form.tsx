"use client";

import { startTransition, useActionState, useRef, useState, type FormEvent } from "react";

import { importRoster, type CensusResult } from "@/app/(dashboard)/census/actions";
import { Result } from "@/components/census/kit";
import { Field, fieldClass, selectClass } from "@/components/control/form-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MAX_FILE = 1024 * 1024;

/**
 * Upload the roster spreadsheet for a term; any bad row means nothing is saved. Submitted by hand:
 * a plain form `action` clears every field after the answer, and after a refused file the officer
 * would have to choose the term again.
 */
export function ImportForm({ terms, term, demo }: { terms: string[]; term: string; demo: boolean }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, dispatch, pending] = useActionState<CensusResult, FormData>(async (prev, formData) => {
    const r = await importRoster(prev, formData);
    // A saved roster needs no second upload; a refused one keeps the file for a retry. The term stays.
    if (r?.ok) {
      const input = ref.current?.querySelector<HTMLInputElement>("input[type=file]");
      if (input) input.value = "";
    }
    return r;
  }, null);
  const [tooBig, setTooBig] = useState(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    // A file over the server's body limit would fail before the action can answer, so stop it here.
    const file = data.get("file");
    const big = file instanceof File && file.size > MAX_FILE;
    setTooBig(big);
    if (!big) startTransition(() => dispatch(data));
  };

  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <Field id="import-term" label="ภาคเรียน">
          <select id="import-term" name="term" defaultValue={term} required className={selectClass}>
            {terms.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field id="import-file" label="ไฟล์ .xlsx หรือ .csv (UTF-8) ไม่เกิน 1 MB">
          <Input
            id="import-file"
            name="file"
            type="file"
            required
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className={`${fieldClass} py-2 md:text-sm`}
          />
        </Field>
      </div>
      {tooBig ? (
        <p role="alert" className="text-sm text-destructive">
          ไฟล์ใหญ่เกิน 1 MB
        </p>
      ) : (
        <Result state={state} />
      )}
      {demo && <p className="text-sm text-muted-foreground">โหมดสาธิต: ยังไม่ได้เชื่อมต่อฐานข้อมูล จึงนำเข้าไม่ได้</p>}
      <Button type="submit" disabled={pending || demo} className="h-11 w-full sm:w-auto">
        {pending ? "กำลังตรวจและนำเข้า..." : "นำเข้ารายชื่อ"}
      </Button>
    </form>
  );
}
