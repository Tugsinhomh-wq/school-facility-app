import { FileText, ScrollText } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { BentoCard } from "@/components/ui/bento-grid";
import { Button } from "@/components/ui/button";
import { APPROVAL_LABEL } from "@/lib/ticket-meta";
import type { Memorandum } from "@/types/database";

export function DocumentHub({ documents, canDraft, className = "md:col-span-3 lg:col-span-4" }: { documents: Memorandum[]; canDraft: boolean; className?: string }) {
  return (
    <BentoCard className={className}>
      <div className="flex items-center gap-2">
        <ScrollText className="size-5 text-muted-foreground" aria-hidden />
        <h2 className="text-lg font-semibold">บันทึกข้อความ</h2>
      </div>
      <p className="text-sm text-muted-foreground">บันทึกที่ผูกกับงานซ่อม เตรียมเสนอผู้อำนวยการ</p>
      <ul className="mt-4 flex-1 space-y-2">
        {documents.length === 0 && <li className="text-sm text-muted-foreground">ยังไม่มีบันทึกข้อความ บันทึกที่สร้างจากงานซ่อมจะแสดงที่นี่</li>}
        {documents.map((t) => (
          <li key={t.id}>
            <Link href={`/memos/${t.id}`} className="flex items-center gap-3 rounded-lg border border-border bg-background/60 p-3 hover:bg-muted/40">
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{t.subject}</p>
              <p className="truncate text-xs text-muted-foreground">
                เลขที่ {t.doc_ref_no}
              </p>
            </div>
            <Badge variant="outline">{APPROVAL_LABEL[t.final_status]}</Badge>
            </Link>
          </li>
        ))}
      </ul>
      {canDraft && (
        <Button variant="outline" className="mt-4 self-start" nativeButton={false} render={<Link href="/memos" />}>
          ร่างบันทึกข้อความ (PDF / Word)
        </Button>
      )}
    </BentoCard>
  );
}
