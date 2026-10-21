"use client";

import { AlertCircle, Check } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import { saveMemo, type SaveResult } from "@/app/(dashboard)/memos/actions";
import { MemoPreview } from "@/components/memos/memo-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildMemoDoc } from "@/lib/memo/model";
import { cn } from "@/lib/utils";
import type { MemoRecord } from "@/lib/data/memos";

export function MemoEditor({ memo, fontClass }: { memo: MemoRecord; fontClass: string }) {
  const [fields, setFields] = useState({
    doc_ref_no: memo.doc_ref_no,
    subject: memo.subject,
    recipient: memo.recipient,
    body_content: memo.body_content,
    proposal: memo.proposal ?? "",
  });
  const [state, action, pending] = useActionState<SaveResult, FormData>(saveMemo, null);
  const set = (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  const doc = useMemo(
    () => buildMemoDoc({ ...memo, ...fields, proposal: fields.proposal || null }, memo.author),
    [memo, fields],
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <form action={action} className="space-y-4 rounded-xl border border-border p-5">
        <input type="hidden" name="id" value={memo.id} />
        <div className="space-y-1.5">
          <Label htmlFor="doc_ref_no">เลขที่หนังสือ (ที่)</Label>
          <Input id="doc_ref_no" name="doc_ref_no" className="h-11" value={fields.doc_ref_no} onChange={set("doc_ref_no")} />
          <p className="text-sm text-muted-foreground">เลขขึ้นต้น MEMO- เป็นเลขภายในของระบบ ในเอกสารจะเว้นเป็น “บท ........ / ปี” ขอเลขจากห้องบริหารทั่วไปแล้วกรอกที่นี่ เช่น บท 123/2569</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="subject">เรื่อง</Label>
          <Input id="subject" name="subject" className="h-11" value={fields.subject} onChange={set("subject")} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="recipient">เรียน</Label>
          <Input id="recipient" name="recipient" className="h-11" value={fields.recipient} onChange={set("recipient")} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="body_content">ข้อความ</Label>
          <Textarea id="body_content" name="body_content" rows={9} value={fields.body_content} onChange={set("body_content")} required />
          <p className="text-sm text-muted-foreground">ขึ้นบรรทัดใหม่เพื่อแยกย่อหน้า</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="proposal">ข้อเสนอเพื่อพิจารณา</Label>
          <Textarea id="proposal" name="proposal" rows={4} value={fields.proposal} onChange={set("proposal")} />
        </div>

        {state && (
          <p role={state.ok ? "status" : "alert"} className={cn("flex items-start gap-1.5 text-sm", state.ok ? "text-emerald-800" : "text-destructive")}>
            {state.ok ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> : <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}
            {state.message}
          </p>
        )}
        <Button type="submit" disabled={pending} className="h-11 w-full">
          {pending ? "กำลังบันทึก..." : "บันทึกร่าง"}
        </Button>
      </form>

      <section aria-labelledby="memo-preview" className="min-w-0">
        <h2 id="memo-preview" className="mb-2 text-lg font-semibold">
          ตัวอย่างเอกสาร
        </h2>
        <div className="rounded-xl bg-muted p-3 sm:p-5">
          <MemoPreview doc={doc} fontClass={fontClass} />
        </div>
      </section>
    </div>
  );
}
