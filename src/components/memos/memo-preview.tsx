import type { MemoDoc } from "@/lib/memo/model";
import { SCHOOL_NAME } from "@/lib/memo/model";

/**
 * On-screen A4 page. Sizes are in container-width units so the layout matches
 * the PDF at any width: 210 mm page, 3 cm left margin, 2 cm right, 2.5 cm top.
 */
export function MemoPreview({ doc, fontClass }: { doc: MemoDoc; fontClass: string }) {
  return (
    <div className="[container-type:inline-size]">
      <div
        className={`${fontClass} aspect-[210/297] w-full bg-white text-black shadow-lg ring-1 ring-black/10`}
        style={{ padding: "11.9cqw 9.5cqw 9.5cqw 14.3cqw", fontSize: "2.4cqw", lineHeight: 1.45 }}
      >
        <p className="text-center font-bold" style={{ fontSize: "5.4cqw", lineHeight: 1.4, marginBottom: "1cqw" }}>
          บันทึกข้อความ
        </p>
        <p><b>ส่วนราชการ</b> {doc.agency}</p>
        <p className="flex">
          <span className="basis-[38%]"><b>ที่</b> {doc.refNo}</span>
          <span><b>วันที่</b> {doc.date}</span>
        </p>
        <p className="border-b border-black" style={{ paddingBottom: "0.6cqw", marginBottom: "0.6cqw" }}><b>เรื่อง</b> {doc.subject}</p>
        <p style={{ marginBottom: "1.4cqw" }}><b>เรียน</b> {doc.recipient}</p>

        {[...doc.paragraphs, ...(doc.proposal ? [doc.proposal] : []), doc.closing].map((p, i, all) => (
          <p key={i} style={{ textIndent: "11.9cqw", marginBottom: i === all.length - 1 ? "4cqw" : "0.8cqw" }}>{p}</p>
        ))}

        <div className="text-center" style={{ marginLeft: "38%" }}>
          <p>ลงชื่อ ................................</p>
          {doc.signerName && <p>({doc.signerName})</p>}
          {doc.signerPosition && <p>{doc.signerPosition}</p>}
        </div>

        {doc.decisionBlock && (
          <div style={{ marginTop: "3.5cqw" }}>
            <p><b>ความเห็นของผู้อำนวยการ</b></p>
            <p className="flex gap-[3cqw]" style={{ marginBottom: "2cqw" }}>
              {["อนุมัติ", "ไม่อนุมัติ", "อื่น ๆ ..................."].map((l) => (
                <span key={l} className="flex items-center gap-[0.8cqw]">
                  <span className="inline-block border border-black" style={{ width: "1.9cqw", height: "1.9cqw" }} />
                  {l}
                </span>
              ))}
            </p>
            <div className="text-center" style={{ marginLeft: "38%" }}>
              <p>ลงชื่อ ................................</p>
              <p>(................................)</p>
              <p>ผู้อำนวยการ{SCHOOL_NAME}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
