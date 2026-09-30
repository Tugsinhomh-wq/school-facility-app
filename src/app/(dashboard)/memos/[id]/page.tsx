import { ArrowLeft, Download, FileText } from "lucide-react";
import { Sarabun } from "next/font/google";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { MemoEditor } from "@/components/memos/memo-editor";
import { getMemo } from "@/lib/data/memos";

export const dynamic = "force-dynamic";

// Same family as the exported PDF, so the preview matches the file.
const sarabun = Sarabun({ subsets: ["thai", "latin"], weight: ["400", "700"] });

export default async function MemoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { memo } = await getMemo(id);
  // Row Level Security only returns memos the viewer wrote, or any memo for staff.
  if (!memo) notFound();

  return (
    <>
      <Link href="/memos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        บันทึกข้อความ
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl font-bold tracking-tight">ร่างบันทึกข้อความ</h1>
        <div>
          <div className="flex gap-2">
            <Button nativeButton={false} render={<a href={`/memos/${memo.id}/docx`} download />}>
              <FileText aria-hidden /> Export Word
            </Button>
            <Button variant="outline" nativeButton={false} render={<a href={`/memos/${memo.id}/pdf`} download />}>
              <Download aria-hidden /> Export PDF
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground sm:text-right">ไฟล์ใช้ข้อความที่บันทึกล่าสุด กดบันทึกร่างก่อนส่งออก</p>
        </div>
      </div>
      <MemoEditor memo={memo} fontClass={sarabun.className} />
    </>
  );
}
