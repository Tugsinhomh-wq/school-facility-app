import { getMemo } from "@/lib/data/memos";
import { memoToDocx } from "@/lib/memo/docx";
import { buildMemoDoc } from "@/lib/memo/model";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { memo } = await getMemo(id);
  if (!memo) return new Response("ไม่พบบันทึกข้อความ", { status: 404 });

  const doc = buildMemoDoc(memo, memo.author);
  const body = await memoToDocx(doc);
  const name = `บันทึกข้อความ-${memo.doc_ref_no}`.replace(/[\\/:*?"<>|]+/g, "-");
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="memo.docx"; filename*=UTF-8''${encodeURIComponent(name)}.docx`,
      "Cache-Control": "private, no-store",
    },
  });
}
