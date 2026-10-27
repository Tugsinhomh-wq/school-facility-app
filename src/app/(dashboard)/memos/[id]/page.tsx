import { ArrowLeft, Download, FileText } from "lucide-react";
import { Sarabun } from "next/font/google";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ApprovalPill } from "@/components/tickets/status-mark";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/ui/state-card";
import { DeleteMemoButton, DeleteMemoPanel, DeleteMemos } from "@/components/memos/delete-memo";
import { MemoEditor } from "@/components/memos/memo-editor";
import { getMemo } from "@/lib/data/memos";

import { guardExecutive } from "@/lib/data/session";

export const dynamic = "force-dynamic";

// Same family as the exported PDF, so the preview matches the file.
const sarabun = Sarabun({ subsets: ["thai", "latin"], weight: ["400", "700"] });

export default async function MemoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await guardExecutive();
  const { id } = await params;
  const { memo, failed, viewer } = await getMemo(id);
  // Row Level Security only returns memos the viewer wrote, or any memo for staff.
  if (failed) return <LoadError what="บันทึกข้อความ" retryHref={`/memos/${id}`} />;
  if (!memo) notFound();

  // Only the system administrator deletes memos; the action checks the role again.
  const canDelete = viewer?.role === "super_admin";

  return (
    <DeleteMemos back>
      <Link
        href="/memos"
        className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft className="size-4" aria-hidden />
        บันทึกข้อความ
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{memo.doc_ref_no}</p>
          <h1 className="font-display mt-1 text-2xl font-medium leading-snug sm:text-3xl">
            ร่างบันทึกข้อความ
          </h1>
          <ApprovalPill status={memo.final_status} className="mt-2" />
        </div>
        <div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="h-11 px-4"
              nativeButton={false}
              render={<a href={`/memos/${memo.id}/docx`} download />}
            >
              <FileText aria-hidden /> Export Word
            </Button>
            <Button
              variant="outline"
              className="h-11 px-4"
              nativeButton={false}
              render={<a href={`/memos/${memo.id}/pdf`} download />}
            >
              <Download aria-hidden /> Export PDF
            </Button>
            {canDelete && <DeleteMemoButton id={memo.id} refNo={memo.doc_ref_no} />}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground sm:text-right">
            ไฟล์ใช้ข้อความที่บันทึกล่าสุด กดบันทึกร่างก่อนส่งออก
          </p>
        </div>
      </div>
      {canDelete && (
        <DeleteMemoPanel id={memo.id} refNo={memo.doc_ref_no} subject={memo.subject} className="mb-6" />
      )}
      <MemoEditor memo={memo} fontClass={sarabun.className} />
    </DeleteMemos>
  );
}
