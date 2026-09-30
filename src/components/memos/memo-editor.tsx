"use client";

import { Download, FileText } from "lucide-react";
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
      <form action={action} className="space-y-4 rounded-xl border border-border bg-card/85 p-5 backdrop-blur-sm">
        <input type="hidden" name="id" value={memo.id} />
        <div className="space-y-1.5">
          <Label htmlFor="doc_ref_no">เลขที่หนังสือ (ที่)</Label>
          <Input id="doc_ref_no" name="doc_ref_no" value={fields.doc_ref_no} onChange={set("doc_ref_no")} />
          <p className="text-xs text-muted-foreground">เลขชั่วคราวขึ้นต้น MEMO- เปลี่ยนเป็นเลขจริงจากงานสารบรรณได้</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="subject">เรื่อง</Label>
          <Input id="subject" name="subject" value={fields.subject} onChange={set("subject")} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="recipient">เรียน</Label>
          <Input id="recipient" name="recipient" value={fields.recipient} onChange={set("recipient")} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="body_content">ข้อความ</Label>
          <Textarea id="body_content" name="body_content" rows={9} value={fields.body_content} onChange={set("body_content")} required />
          <p className="text-xs text-muted-foreground">ขึ้นบรรทัดใหม่เพื่อแยกย่อหน้า</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="proposal">ข้อเสนอเพื่อพิจารณา</Label>
          <Textarea id="proposal" name="proposal" rows={4} value={fields.proposal} onChange={set("proposal")} />
        </div>

        {state && (
          <p role={state.ok ? "status" : "alert"} className={cn("text-sm", state.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
            {state.message}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "กำลังบันทึก..." : "บันทึกร่าง"}
        </Button>

        <div className="border-t border-border pt-4">
          <p className="mb-2 text-sm text-muted-foreground">ไฟล์จะใช้ข้อความที่บันทึกล่าสุด กดบันทึกร่างก่อนดาวน์โหลด</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" nativeButton={false} render={<a href={`/memos/${memo.id}/pdf`} download />}>
              <Download aria-hidden /> PDF
            </Button>
            <Button variant="outline" nativeButton={false} render={<a href={`/memos/${memo.id}/docx`} download />}>
              <FileText aria-hidden /> Word
            </Button>
          </div>
        </div>
      </form>

      <MemoPreview doc={doc} fontClass={fontClass} />
    </div>
  );
}
