import type { ReactNode } from "react";

import type { MemoDoc, MemoPhotoGroup } from "@/lib/memo/model";
import { BUILDING_HEAD, DIRECTOR, SCHOOL_NAME } from "@/lib/memo/model";

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

/** The attachment page behind a repair memo: photos in two columns, shrunk to fit a 7.6 x 8.5 cm box, as in the exports. */
function PhotoPage({ groups, fontClass }: { groups: MemoPhotoGroup[]; fontClass: string }) {
  const CM = 100 / 21; // one centimetre of the page, in cqw
  return (
    <div
      className={`${fontClass} w-full bg-white text-black shadow-lg ring-1 ring-black/10`}
      style={{ marginTop: "2cqw", minHeight: "141.4cqw", padding: "4.8cqw 9.5cqw 9.5cqw 14.3cqw", fontSize: "2.06cqw", lineHeight: 1.35 }}
    >
      <p className="text-center font-bold" style={{ fontSize: "3.05cqw", marginBottom: "3cqw" }}>
        เอกสารแนบ: ภาพประกอบการแจ้งซ่อม
      </p>
      {groups.map((g, gi) => (
        <div key={gi} className="grid" style={{ gridTemplateColumns: `${7.6 * CM}cqw ${7.6 * CM}cqw`, columnGap: `${0.8 * CM}cqw`, rowGap: "2cqw", marginBottom: "2cqw" }}>
          {g.urls.map((url, i) => (
            <figure key={i}>
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={g.heading || "รูปประกอบการแจ้งซ่อม"} className="block object-contain object-top" style={{ maxWidth: `${7.6 * CM}cqw`, maxHeight: `${8.5 * CM}cqw` }} />
              ) : (
                <div className="flex items-center justify-center border border-dashed border-black text-center" style={{ height: `${3 * CM}cqw` }}>
                  ไม่สามารถโหลดรูปนี้ได้
                </div>
              )}
              {g.heading && <figcaption style={{ marginTop: "0.8cqw" }}>{g.heading}</figcaption>}
            </figure>
          ))}
        </div>
      ))}
    </div>
  );
}

export function MemoPreview({ doc, fontClass, photos = [] }: { doc: MemoDoc; fontClass: string; photos?: MemoPhotoGroup[] }) {
  const repair = doc.variant === "repair";
  return (
    <div className="[container-type:inline-size]">
      <div
        className={`${fontClass} aspect-[210/297] w-full bg-white text-black shadow-lg ring-1 ring-black/10`}
        style={{ padding: "4.8cqw 9.5cqw 9.5cqw 14.3cqw", fontSize: "2.4cqw", lineHeight: 1.4 }}
      >
        <div className="relative flex items-center justify-center" style={{ height: "10.5cqw", marginBottom: "1.5cqw" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/garuda.png" alt="ตราครุฑ" className="absolute left-0 top-0 w-auto" style={{ height: "10.5cqw" }} />
          <p className="font-bold" style={{ fontSize: "3.4cqw", lineHeight: 1.2 }}>
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
          <p key={i} style={{ textIndent: "8.33cqw", marginBottom: i === all.length - 1 ? "4cqw" : "0.3cqw" }}>{p}</p>
        ))}

        {repair ? (
          <>
            <div className="text-center" style={{ marginLeft: "38%" }}>
              <p>ลงชื่อ ...................... ผู้รายงาน</p>
              <p>({doc.signerName || "..........................................."})</p>
              <p>ตำแหน่ง {doc.signerPosition || ".........................................."}</p>
            </div>
            {doc.decisionBlock && (
              <div style={{ marginTop: "3cqw" }}>
                <p className="font-bold">ความเห็นของ{BUILDING_HEAD.position}</p>
                <p className="border-b border-dotted border-black" style={{ height: "3.4cqw" }} />
                <div className="text-center" style={{ marginLeft: "38%", marginTop: "3cqw", marginBottom: "3cqw" }}>
                  <p>ลงชื่อ ..............................</p>
                  <p>({BUILDING_HEAD.name})</p>
                  <p>{BUILDING_HEAD.position}</p>
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
      {photos.length > 0 && <PhotoPage groups={photos} fontClass={fontClass} />}
    </div>
  );
}
