"use client";

import { useActionState } from "react";

import { rolloverTerm, type SetupResult } from "@/app/(dashboard)/cleaning/manage/actions";
import { field, Result, selectClass } from "@/components/cleaning/classroom-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Copy a term's active classrooms and advisors into a new term (rooms already there are skipped). */
export function RolloverForm({ terms }: { terms: string[] }) {
  const [state, action, pending] = useActionState<SetupResult, FormData>(rolloverTerm, null);
  return (
    <form action={action} className="space-y-3 rounded-xl border border-border bg-card/85 p-4">
      <p className="text-sm text-muted-foreground">
        คัดลอกห้องที่ใช้งาน เขต และครูที่ปรึกษาไปภาคเรียนใหม่ แล้วค่อยแก้เฉพาะที่เปลี่ยน
        ภาคเรียนล่าสุดที่มีห้องจะเป็นภาคเรียนปัจจุบันทันที กดซ้ำได้ ห้องที่คัดลอกแล้วจะไม่ซ้ำ
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="from-term">จากภาคเรียน</Label>
          <select id="from-term" name="from_term" defaultValue={terms[0]} className={selectClass}>
            {terms.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to-term">ไปภาคเรียน</Label>
          <Input id="to-term" name="to_term" required pattern="\d{4}/[1-3]" placeholder="เช่น 2569/2" className={field} />
        </div>
      </div>
      <Result state={state} />
      <Button type="submit" disabled={pending} className="h-11 w-full sm:w-auto">
        {pending ? "กำลังคัดลอก..." : "คัดลอกไปภาคเรียนใหม่"}
      </Button>
    </form>
  );
}
