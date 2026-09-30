import { FileText, ScrollText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BentoCard } from "@/components/ui/bento-grid";
import { Button } from "@/components/ui/button";
import { formatBaht, STATUS_LABEL } from "@/lib/ticket-meta";
import type { RepairTicket } from "@/types/database";

export function DocumentHub({ documents }: { documents: RepairTicket[] }) {
  return (
    <BentoCard className="md:col-span-3 lg:col-span-6">
      <div className="flex items-center gap-2">
        <ScrollText className="size-5 text-muted-foreground" aria-hidden />
        <h2 className="text-lg font-semibold">บันทึกข้อความ</h2>
      </div>
      <p className="text-sm text-muted-foreground">งานซ่อมที่มีเลขที่หนังสือแล้ว เตรียมเสนอผู้อำนวยการ</p>
      <ul className="mt-4 flex-1 space-y-2">
        {documents.length === 0 && <li className="text-sm text-muted-foreground">ยังไม่มีบันทึกข้อความ เมื่อสร้างเลขที่หนังสือจากงานซ่อม จะแสดงที่นี่</li>}
        {documents.map((t) => (
          <li key={t.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/60 p-3">
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{t.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {t.document_ref_no} · {formatBaht(Number(t.estimated_cost))}
              </p>
            </div>
            <Badge variant="outline">{STATUS_LABEL[t.status]}</Badge>
          </li>
        ))}
      </ul>
      {/* Destination page is not built yet; kept disabled rather than linking to a 404. */}
      <Button variant="outline" className="mt-4 self-start" disabled>
        ร่างบันทึกข้อความ (PDF / Word)
      </Button>
    </BentoCard>
  );
}
