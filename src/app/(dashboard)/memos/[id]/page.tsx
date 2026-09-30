import { ArrowLeft } from "lucide-react";
import { Sarabun } from "next/font/google";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { MemoEditor } from "@/components/memos/memo-editor";
import { getMemo, isStaff } from "@/lib/data/memos";

export const dynamic = "force-dynamic";

// Same family as the exported PDF, so the preview matches the file.
const sarabun = Sarabun({ subsets: ["thai", "latin"], weight: ["400", "700"] });

export default async function MemoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { memo, viewer } = await getMemo(id);
  if (!memo || (viewer && !isStaff(viewer))) notFound();

  return (
    <PageShell viewer={viewer}>
      <Link href="/memos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        บันทึกข้อความ
      </Link>
      <h1 className="font-display mb-6 text-3xl font-bold tracking-tight">ร่างบันทึกข้อความ</h1>
      <MemoEditor memo={memo} fontClass={sarabun.className} />
    </PageShell>
  );
}
