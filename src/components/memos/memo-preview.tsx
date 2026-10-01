import type { ReactNode } from "react";

import type { MemoDoc } from "@/lib/memo/model";
import { DEPUTY, DIRECTOR, SCHOOL_NAME } from "@/lib/memo/model";

/**
 * On-screen A4 page. Sizes are in container-width units so the layout matches
 * the PDF at any width: 210 mm page, 3 cm left margin, 2 cm right, garuda 1.5 cm from the top.
 */

/** "label value ........" with a dotted line running to the right margin. */
function Field({ label, children, after, big, strong }: { label: string; children: ReactNode; after?: string; big?: boolean; strong?: boolean }) {
  return (
    <p style={{ marginBottom: after, fontSize: big ? "3cqw" : undefined }}>
      <b>{label}&nbsp;</b>
      <span className={big || strong ? "font-bold" : ""}>{children}</span>
    </p>
  );
}

export function MemoPreview({ doc, fontClass }: { doc: MemoDoc; fontClass: string }) {
  const repair = doc.variant === "repair";
  return (
    <div className="[container-type:inline-size]">
      <div
        className={`${fontClass} aspect-[210/297] w-full bg-white text-black shadow-lg ring-1 ring-black/10`}
        style={{ padding: "7.1cqw 9.5cqw 9.5cqw 14.3cqw", fontSize: "2.4cqw", lineHeight: 1.4 }}
      >
        <div className="relative flex items-center justify-center" style={{ height: "10.5cqw", marginBottom: "1.5cqw" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/garuda.png" alt="ตราครุฑ" className="absolute left-0 top-0 w-auto" style={{ height: "10.5cqw" }} />
          <p className="font-bold" style={{ fontSize: "4.5cqw", lineHeight: 1.2 }}>
            บันทึกข้อความ
          </p>
        </div>
        <Field label="ส่วนราชการ" >{doc.agency}</Field>
        <div className="flex items-end">
          <b className="shrink-0">ที่&nbsp;</b>
          <span className="shrink-0" style={{ width: "21.5cqw" }}>{doc.refNo}</span>
          <b className="shrink-0">วันที่&nbsp;</b>
          <span className="min-w-0 flex-1">{doc.date}</span>
        </div>
        <Field label="เรื่อง" >{doc.subject}</Field>
        <Field label="เรียน" after="1.4cqw" >{doc.recipient}</Field>

        {[...doc.paragraphs, ...(doc.proposal ? [doc.proposal] : []), doc.closing].map((p, i, all) => (
          <p key={i} style={{ textIndent: "11.9cqw", marginBottom: i === all.length - 1 ? "4cqw" : "0.3cqw" }}>{p}</p>
        ))}

        {repair ? (
          <>
            <div className="text-center" style={{ marginLeft: "38%" }}>
              <p>(ลงชื่อ)...................... ผู้รายงาน</p>
              <p>({doc.signerName || "..........................................."})</p>
              <p>ตำแหน่ง {doc.signerPosition || ".........................................."}</p>
            </div>
            {doc.decisionBlock && (
              <div style={{ marginTop: "3cqw" }}>
                <p className="font-bold">ความเห็นของ{DEPUTY.position}</p>
                <p className="border-b border-dotted border-black" style={{ height: "3.4cqw" }} />
                <div className="text-center" style={{ marginLeft: "38%", marginTop: "3cqw", marginBottom: "3cqw" }}>
                  <p>ลงชื่อ ..............................</p>
                  <p>({DEPUTY.name})</p>
                  <p>{DEPUTY.position}</p>
                </div>
                <p className="font-bold">คำสั่งการ / การพิจารณาของผู้อำนวยการโรงเรียน</p>
                <p style={{ paddingLeft: "3cqw" }}>☐ อนุมัติ &nbsp;&nbsp; ☐ ไม่อนุมัติ</p>
                <p className="border-b border-dotted border-black" style={{ height: "3.4cqw" }} />
                <div className="text-center" style={{ marginLeft: "38%", marginTop: "3cqw" }}>
                  <p>ลงชื่อ ..............................</p>
                  <p>({DIRECTOR.name})</p>
                  <p>{DIRECTOR.position}</p>
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
