"use client";

import { Download } from "lucide-react";
import { useActionState, useState } from "react";

import {
  importClassrooms,
  type SetupResult,
} from "@/app/(dashboard)/cleaning/manage/actions";
import { field, Result } from "@/components/cleaning/classroom-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_FILE = 1024 * 1024;

/** Upload the classroom spreadsheet for a term; any bad row means nothing is saved. */
export function ImportForm({ term }: { term: string | null }) {
  const [state, action, pending] = useActionState<SetupResult, FormData>(
    importClassrooms,
    null,
  );
  const [tooBig, setTooBig] = useState(false);
  return (
    <form
      action={action}
      // A file over the server's body limit would fail before the action can answer, so stop it here.
      onSubmit={(e) => {
        const file = new FormData(e.currentTarget).get("file");
        const big = file instanceof File && file.size > MAX_FILE;
        setTooBig(big);
        if (big) e.preventDefault();
      }}
      className="space-y-3"
    >
      <p className="text-sm text-muted-foreground">
        คอลัมน์: ห้อง, อาคาร, อีเมลครูที่ปรึกษา (ไม่บังคับ เว้นว่างได้
        ห้องที่มีอยู่แล้วจะคงครูเดิมไว้ ถ้าใส่อีเมลจะแทนที่ครูเดิมทั้งหมด), เขต —
        ห้องที่มีอยู่แล้วจะถูกแก้ตามไฟล์ ห้องที่ไม่มีในไฟล์คงไว้ตามเดิม
        ถ้าแถวใดผิด จะไม่บันทึกข้อมูลใดเลย
      </p>
      <a
        href="/cleaning/template"
        download
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        <Download className="size-4" aria-hidden />
        ดาวน์โหลดไฟล์แม่แบบ (.xlsx)
      </a>
      <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <Label htmlFor="import-term">ภาคเรียน</Label>
          <Input
            id="import-term"
            name="term"
            defaultValue={term ?? ""}
            required
            pattern="\d{4}/[1-3]"
            placeholder="เช่น 2569/1"
            className={field}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="import-file">
            ไฟล์ .xlsx หรือ .csv (UTF-8) ไม่เกิน 1 MB
          </Label>
          <Input
            id="import-file"
            name="file"
            type="file"
            required
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="h-11 py-2 text-base md:text-sm"
          />
        </div>
      </div>
      {tooBig ? (
        <p role="alert" className="text-sm text-destructive">
          ไฟล์ใหญ่เกิน 1 MB
        </p>
      ) : (
        <Result state={state} />
      )}
      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full sm:w-auto"
      >
        {pending ? "กำลังตรวจและนำเข้า..." : "นำเข้า"}
      </Button>
    </form>
  );
}
