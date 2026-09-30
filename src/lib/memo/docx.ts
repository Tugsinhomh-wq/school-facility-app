import { AlignmentType, BorderStyle, Document, Packer, Paragraph, type IParagraphOptions, TabStopType, TextRun } from "docx";

import { SCHOOL_NAME, type MemoDoc } from "@/lib/memo/model";
import { withBreakHints } from "@/lib/memo/thai-text";

const CM = 567; // twips per centimetre
const SIZE = 32; // 16 pt, in half-points (TH Sarabun New's usual body size)

interface Options {
  /** Must be installed on the reader's machine; "TH Sarabun New" is the standard for government memos. */
  fontName?: string;
}

export async function memoToDocx(doc: MemoDoc, { fontName = "TH Sarabun New" }: Options = {}): Promise<Buffer> {
  const run = (text: string, bold = false, size = SIZE) =>
    new TextRun({
      text: withBreakHints(text),
      bold,
      boldComplexScript: bold,
      size,
      sizeComplexScript: size,
      font: { ascii: fontName, hAnsi: fontName, cs: fontName },
      language: { value: "th-TH", bidirectional: "th-TH" },
    });

  const plain = (text: string, extra: Omit<IParagraphOptions, "children"> = {}) =>
    new Paragraph({ alignment: AlignmentType.LEFT, ...extra, children: [run(text)] });

  const labelled = (label: string, value: string, extra: Omit<IParagraphOptions, "children"> = {}) =>
    new Paragraph({ alignment: AlignmentType.LEFT, ...extra, children: [run(label, true), run(` ${value}`)] });

  const indent = { firstLine: 2.5 * CM };
  const body = { indent, spacing: { after: 120 } };
  const signer = { indent: { left: 8 * CM }, alignment: AlignmentType.CENTER } as const;

  const children: Paragraph[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [run("บันทึกข้อความ", true, 58)] }),
    labelled("ส่วนราชการ", doc.agency),
    new Paragraph({
      tabStops: [{ type: TabStopType.LEFT, position: 8 * CM }],
      children: [run("ที่", true), run(` ${doc.refNo}`), new TextRun({ text: "\t" }), run("วันที่", true), run(` ${doc.date}`)],
    }),
    labelled("เรื่อง", doc.subject, { border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 4, color: "000000" } }, spacing: { after: 120 } }),
    labelled("เรียน", doc.recipient, { spacing: { after: 160 } }),
    ...doc.paragraphs.map((p) => plain(p, body)),
    ...(doc.proposal ? [plain(doc.proposal, body)] : []),
    plain(doc.closing, { ...body, spacing: { after: 360 } }),
    new Paragraph({ ...signer, children: [run("ลงชื่อ ................................................")] }),
    ...(doc.signerName ? [new Paragraph({ ...signer, children: [run(`(${doc.signerName})`)] })] : []),
    ...(doc.signerPosition ? [new Paragraph({ ...signer, children: [run(doc.signerPosition)] })] : []),
  ];

  if (doc.decisionBlock) {
    children.push(
      new Paragraph({ spacing: { before: 480, after: 80 }, children: [run("ความเห็นของผู้อำนวยการ", true)] }),
      plain("☐ อนุมัติ        ☐ ไม่อนุมัติ        ☐ อื่น ๆ ..........................................", { spacing: { after: 240 } }),
      new Paragraph({ ...signer, children: [run("ลงชื่อ ................................................")] }),
      new Paragraph({ ...signer, children: [run("(................................................)")] }),
      new Paragraph({ ...signer, children: [run(`ผู้อำนวยการ${SCHOOL_NAME}`)] }),
    );
  }

  const file = new Document({
    creator: SCHOOL_NAME,
    title: doc.subject,
    styles: { default: { document: { run: { font: { ascii: fontName, hAnsi: fontName, cs: fontName }, size: SIZE, sizeComplexScript: SIZE } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 2.5 * CM, bottom: 2 * CM, left: 3 * CM, right: 2 * CM },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(file);
}
