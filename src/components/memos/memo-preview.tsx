import type { ReactNode } from "react";

import type { MemoDoc } from "@/lib/memo/model";
import { SCHOOL_NAME } from "@/lib/memo/model";

/**
 * On-screen A4 page. Sizes are in container-width units so the layout matches
 * the PDF at any width: 210 mm page, 3 cm left margin, 2 cm right, garuda 1.5 cm from the top.
 */

/** "label value ........" with a dotted line running to the right margin. */
function Field({ label, children, after, big, strong }: { label: string; children: ReactNode; after?: string; big?: boolean; strong?: boolean }) {
  return (
    <p className="flex items-end" style={{ marginBottom: after, fontSize: big ? "3cqw" : undefined }}>
      <b className="shrink-0">{label}&nbsp;</b>
      <span className={`min-w-0 flex-1 border-b border-dotted border-black ${big || strong ? "font-bold" : ""}`}>{children}</span>
    </p>
  );
}

export function MemoPreview({ doc, fontClass }: { doc: MemoDoc; fontClass: string }) {
  const repair = doc.variant === "repair";
  return (
    <div className="[container-type:inline-size]">
      <div
        className={`${fontClass} aspect-[210/297] w-full bg-white text-black shadow-lg ring-1 ring-black/10`}
        style={{ padding: "7.1cqw 9.5cqw 9.5cqw 14.3cqw", fontSize: "2.4cqw", lineHeight: 1.45 }}
      >
        <div className="relative flex items-center justify-center" style={{ height: "7.14cqw", marginBottom: "2cqw" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/garuda.png" alt="ตราครุฑ" className="absolute left-0 top-0 w-auto" style={{ height: "7.14cqw" }} />
          <p className="font-bold" style={{ fontSize: "5.4cqw", lineHeight: 1.2 }}>
            บันทึกข้อความ
          </p>
        </div>
        <Field label="ส่วนราชการ" big={repair}>{doc.agency}</Field>
        <div className="flex items-end">
          <b className="shrink-0">ที่&nbsp;</b>
          <span className="min-w-0 flex-[0_0_32%] border-b border-dotted border-black">{doc.refNo}</span>
          <b className="shrink-0" style={{ marginLeft: "2cqw" }}>วันที่&nbsp;</b>
          <span className="min-w-0 flex-1 border-b border-dotted border-black">{doc.date}</span>
        </div>
        <Field label="เรื่อง" strong={repair}>{doc.subject}</Field>
        <Field label="เรียน" after="1.4cqw" strong={repair}>{doc.recipient}</Field>

        {[...doc.paragraphs, ...(doc.proposal ? [doc.proposal] : []), doc.closing].map((p, i, all) => (
          <p key={i} style={{ textIndent: "11.9cqw", marginBottom: i === all.length - 1 ? "4cqw" : "0.8cqw" }}>{p}</p>
        ))}

        {repair ? (
          <>
            <div className="text-center" style={{ marginLeft: "38%" }}>
              <p>(ลงชื่อ)...................... ผู้รายงาน</p>
              <p>({doc.signerName || "..........................................."})</p>
              <p>ตำแหน่ง {doc.signerPosition || ".........................................."}</p>
            </div>
            {doc.decisionBlock && (
              <div className="grid grid-cols-2 border border-black" style={{ marginTop: "3cqw" }}>
                <div className="border-r border-black text-center" style={{ padding: "1.4cqw" }}>
                  <p className="font-bold">ความเห็นของหัวหน้างานอาคารสถานที่ / รองผู้อำนวยการกลุ่มบริหารทั่วไป</p>
                  <p style={{ marginTop: "5cqw" }}>ลงชื่อ ..............................</p>
                  <p>(..............................)</p>
                </div>
                <div className="text-center" style={{ padding: "1.4cqw" }}>
                  <p className="font-bold">คำสั่งการ / การพิจารณาของผู้อำนวยการโรงเรียน</p>
                  <p>☐ อนุมัติ &nbsp; ☐ ไม่อนุมัติ</p>
                  <p style={{ marginTop: "2cqw" }}>ลงชื่อ ..............................</p>
                  <p>(..............................)</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
