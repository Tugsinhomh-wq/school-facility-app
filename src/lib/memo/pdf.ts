import fs from "node:fs";
import path from "node:path";

import PDFDocument from "pdfkit";

import { SCHOOL_NAME, type MemoDoc } from "@/lib/memo/model";
import { thaiWords } from "@/lib/memo/thai-text";

const FONT_DIR = path.join(process.cwd(), "src/lib/memo/fonts");
const cm = (n: number) => (n * 72) / 2.54;

const PAGE = { width: 595.28, height: 841.89 };
const M = { top: cm(2.5), bottom: cm(2), left: cm(3), right: cm(2) };
const SIZE = 15;
const LINE = SIZE * 1.35; // single spacing, as in a typed official letter

export function memoToPdf(doc: MemoDoc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: "A4", margins: { top: M.top, bottom: M.bottom, left: M.left, right: M.right }, font: path.join(FONT_DIR, "Sarabun-Regular.ttf"), info: { Title: doc.subject, Author: SCHOOL_NAME } });
    const chunks: Buffer[] = [];
    pdf.on("data", (c: Buffer) => chunks.push(c));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    const regular = path.join(FONT_DIR, "Sarabun-Regular.ttf");
    const bold = path.join(FONT_DIR, "Sarabun-Bold.ttf");
    if (!fs.existsSync(regular) || !fs.existsSync(bold)) return reject(new Error("Sarabun font files are missing"));

    const contentWidth = PAGE.width - M.left - M.right;
    const bottomLimit = PAGE.height - M.bottom;
    let y = M.top;

    const ensure = (height: number) => {
      if (y + height > bottomLimit) {
        pdf.addPage();
        y = M.top;
      }
    };

    /** Greedy wrap at Thai word boundaries; the first line may be indented (paragraph indent). */
    const wrap = (text: string, width: number, firstIndent = 0) => {
      const lines: string[] = [];
      let line = "";
      let limit = width - firstIndent;
      for (const word of thaiWords(text)) {
        if (word === " " && line === "") continue;
        if (pdf.widthOfString(line + word) > limit && line !== "") {
          lines.push(line.trimEnd());
          line = word === " " ? "" : word;
          limit = width;
        } else {
          line += word;
        }
      }
      if (line.trim()) lines.push(line.trimEnd());
      return lines;
    };

    const paragraph = (text: string, opts: { x?: number; width?: number; firstIndent?: number; after?: number; bold?: boolean } = {}) => {
      const x = opts.x ?? M.left;
      const width = opts.width ?? contentWidth;
      pdf.font(opts.bold ? bold : regular).fontSize(SIZE);
      wrap(text, width, opts.firstIndent ?? 0).forEach((l, i) => {
        ensure(LINE);
        pdf.text(l, x + (i === 0 ? (opts.firstIndent ?? 0) : 0), y, { lineBreak: false });
        y += LINE;
      });
      y += opts.after ?? 0;
    };

    /** Dotted leader from x1 to x2 on the baseline of the line starting at `top`. */
    const leader = (x1: number, x2: number, top: number) => {
      if (x2 - x1 < 6) return;
      const base = top + SIZE * 1.02;
      pdf.save().dash(0.9, { space: 2 }).lineWidth(0.8).moveTo(x1, base).lineTo(x2, base).stroke("#000000").undash().restore();
    };

    /** "label value ........" with the label bold; every line of a wrapped value runs out on a dotted line. */
    const labelled = (label: string, value: string, after = 0, opts: { size?: number; boldValue?: boolean } = {}) => {
      const size = opts.size ?? SIZE;
      const line = size * 1.45;
      pdf.font(bold).fontSize(size);
      const labelWidth = pdf.widthOfString(label + " ");
      ensure(line);
      pdf.text(label, M.left, y, { lineBreak: false });
      pdf.font(opts.boldValue ? bold : regular);
      const lines = wrap(value, contentWidth - labelWidth);
      (lines.length ? lines : [""]).forEach((l, i) => {
        ensure(line);
        const x = M.left + labelWidth;
        pdf.text(l, x, y, { lineBreak: false });
        leader(x + pdf.widthOfString(l) + 3, M.left + contentWidth, y + (size - SIZE));
        y += line;
        if (i === 0 && lines.length > 1) return;
      });
      y += after;
    };

    // Header: garuda (1.5 cm high) at the top left, the title centred on the same line.
    const garudaH = cm(2.2);
    pdf.image(path.join(FONT_DIR, "../assets/garuda.png"), M.left, cm(1.5), { height: garudaH });
    pdf.font(bold).fontSize(24);
    pdf.text("บันทึกข้อความ", M.left, cm(1.5) + (garudaH - 24 * 1.2) / 2, { width: contentWidth, align: "center", lineBreak: false });
    y = cm(1.5) + garudaH + 8;

    const repair = doc.variant === "repair";
    labelled("ส่วนราชการ", doc.agency);

    // "ที่ ... วันที่ ..." on one line, each followed by its dotted leader
    pdf.font(bold).fontSize(SIZE).text("ที่", M.left, y, { lineBreak: false });
    const thiWidth = pdf.widthOfString("ที่ ");
    pdf.font(regular).text(doc.refNo, M.left + thiWidth, y, { lineBreak: false });
    const dateX = M.left + cm(8);
    leader(M.left + thiWidth + pdf.widthOfString(doc.refNo) + 3, dateX - 6, y);
    pdf.font(bold).text("วันที่", dateX, y, { lineBreak: false });
    const dateLabel = pdf.widthOfString("วันที่ ");
    pdf.font(regular).text(doc.date, dateX + dateLabel, y, { lineBreak: false });
    leader(dateX + dateLabel + pdf.widthOfString(doc.date) + 3, M.left + contentWidth, y);
    y += LINE;

    labelled("เรื่อง", doc.subject);
    labelled("เรียน", doc.recipient, 6);

    const indent = cm(2.5);
    for (const p of doc.paragraphs) paragraph(p, { firstIndent: indent, after: 2 });
    if (doc.proposal) paragraph(doc.proposal, { firstIndent: indent, after: 2 });
    paragraph(doc.closing, { firstIndent: indent, after: 20 });

    // Signature block, centred in the right-hand column
    const sigX = M.left + cm(8);
    const sigWidth = contentWidth - cm(8);
    const centred = (text: string, isBold = false) => {
      pdf.font(isBold ? bold : regular).fontSize(SIZE);
      for (const line of wrap(text, sigWidth)) {
        ensure(LINE);
        pdf.text(line, sigX, y, { width: sigWidth, align: "center", lineBreak: false });
        y += LINE;
      }
    };
    const signature = (name: string, position: string) => {
      ensure(LINE * 4);
      centred("ลงชื่อ ................................................");
      if (name) centred(`(${name})`);
      if (position) centred(position);
    };
    if (repair) {
      ensure(LINE * 4);
      centred("(ลงชื่อ)...................... ผู้รายงาน");
      centred(`(${doc.signerName || "..........................................."})`);
      centred(`ตำแหน่ง ${doc.signerPosition || ".........................................."}`);
      if (doc.decisionBlock) {
        // Two short stacked notes with dotted lines to write on, then a signature each: no boxes.
        const dotted = (width: number, x = M.left) => {
          ensure(LINE);
          leader(x, x + width, y);
          y += LINE;
        };
        const sign = (position?: string) => {
          ensure(LINE * 4);
          y += LINE * 0.4;
          centred("ลงชื่อ ..............................");
          centred("(..............................)");
          if (position) centred(position);
        };
        y += LINE * 0.6;
        ensure(LINE * 13); // keep both notes together on one page
        pdf.font(bold).fontSize(SIZE);
        for (const line of wrap("ความเห็นของหัวหน้างานอาคารสถานที่ / รองผู้อำนวยการกลุ่มบริหารทั่วไป", contentWidth)) {
          pdf.text(line, M.left, y, { lineBreak: false });
          y += LINE;
        }
        dotted(contentWidth);
        sign();

        y += LINE * 0.6;
        pdf.font(bold).fontSize(SIZE);
        pdf.text("คำสั่งการ / การพิจารณาของผู้อำนวยการโรงเรียน", M.left, y, { lineBreak: false });
        y += LINE;
        // Check boxes drawn as shapes so no symbol font is needed.
        let bx = M.left + cm(0.5);
        pdf.font(regular);
        for (const label of ["อนุมัติ", "ไม่อนุมัติ"]) {
          pdf.rect(bx, y + 3, 9, 9).lineWidth(0.8).stroke("#000000");
          pdf.text(label, bx + 14, y, { lineBreak: false });
          bx += 14 + pdf.widthOfString(label) + 24;
        }
        y += LINE;
        dotted(contentWidth);
        sign("ผู้อำนวยการโรงเรียน");
      }
    } else {
      signature(doc.signerName, doc.signerPosition);
    }

    if (!repair && doc.decisionBlock) {
      y += 22;
      ensure(LINE * 7);
      pdf.font(bold).fontSize(SIZE).text("ความเห็นของผู้อำนวยการ", M.left, y, { lineBreak: false });
      y += LINE + 4;
      // Checkbox line, boxes drawn as shapes so no symbol font is needed.
      let x = M.left;
      pdf.font(regular);
      for (const label of ["อนุมัติ", "ไม่อนุมัติ", "อื่น ๆ ......................................"]) {
        pdf.rect(x, y + 3, 10, 10).lineWidth(0.8).stroke("#000000");
        pdf.text(label, x + 15, y, { lineBreak: false });
        x += 15 + pdf.widthOfString(label) + 24;
      }
      y += LINE + 16;
      signature("................................................", `ผู้อำนวยการ${SCHOOL_NAME}`);
    }

    pdf.end();
  });
}
