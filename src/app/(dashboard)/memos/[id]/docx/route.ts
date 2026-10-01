import { getMemo } from "@/lib/data/memos";
import { memoToDocx } from "@/lib/memo/docx";
import { memoToDocxPython } from "@/lib/memo/docx-python";
import { buildMemoDoc } from "@/lib/memo/model";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { memo } = await getMemo(id);
  if (!memo) return new Response("ไม่พบบันทึกข้อความ", { status: 404 });

  const doc = buildMemoDoc(memo, memo.author);

  // Preferred: python-docx + pythainlp (thai-docx skill). Fallback: the Node builder with
  // ICU word breaks, for hosts without Python.
  let engine = "python-docx";
  let body: Buffer;
  try {
    body = await memoToDocxPython(doc);
  } catch (error) {
    console.warn(
      "Word export fell back to docx-js:",
      error instanceof Error ? error.message : error,
    );
    engine = "docx-js";
    body = await memoToDocx(doc);
  }

  const name = `บันทึกข้อความ-${memo.doc_ref_no}`.replace(
    /[\\/:*?"<>|]+/g,
    "-",
  );
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="memo.docx"; filename*=UTF-8''${encodeURIComponent(name)}.docx`,
      "Cache-Control": "private, no-store",
      "X-Docx-Engine": engine,
    },
  });
}
