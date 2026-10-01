import fs from "node:fs";
import path from "node:path";

import { AlignmentType, BorderStyle, Document, ImageRun, LeaderType, Packer, Paragraph, type IParagraphOptions, Table, TableCell, TableRow, TabStopType, TextRun, WidthType } from "docx";

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

  const RIGHT = 16 * CM; // text width: 21 - 3 - 2 cm
  /** "label value ........": a right tab with a dot leader fills the rest of the line. */
  const repair = doc.variant === "repair";
  const labelled = (label: string, value: string, extra: Omit<IParagraphOptions, "children"> = {}, opts: { size?: number; boldValue?: boolean } = {}) =>
    new Paragraph({
      alignment: AlignmentType.LEFT,
      tabStops: [{ type: TabStopType.RIGHT, position: RIGHT, leader: LeaderType.DOT }],
      ...extra,
      children: [run(label, true, opts.size), run(` ${value}`, Boolean(opts.boldValue), opts.size), new TextRun({ text: "\t" })],
    });

  const indent = { firstLine: 2.5 * CM };
  const body = { indent, spacing: { after: 120 } };
  const signer = { indent: { left: 8 * CM }, alignment: AlignmentType.CENTER } as const;

  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
  const cell = (width: number, children: Paragraph[]) =>
    new TableCell({ width: { size: width, type: WidthType.DXA }, borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }, children });
  // Garuda 1.5 cm high at the left, the title centred; the side columns match so the title is centred on the page.
  const garudaH = 1.5 * CM;
  const header = new Table({
    width: { size: 16 * CM, type: WidthType.DXA },
    columnWidths: [3 * CM, 10 * CM, 3 * CM],
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
    rows: [
      new TableRow({
        children: [
          cell(3 * CM, [
            new Paragraph({
              children: [
                new ImageRun({
                  type: "png",
                  data: fs.readFileSync(path.join(/* turbopackIgnore: true */ process.cwd(), "src/lib/memo/assets/garuda.png")),
                  transformation: { width: Math.round((garudaH / 15) * 0.8917), height: Math.round(garudaH / 15) },
                  altText: { title: "ตราครุฑ", description: "ตราครุฑ", name: "garuda" },
                }),
              ],
            }),
          ]),
          cell(10 * CM, [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60 }, children: [run("บันทึกข้อความ", true, 58)] })]),
          cell(3 * CM, [new Paragraph({ children: [] })]),
        ],
      }),
    ],
  });

  const children: (Paragraph | Table)[] = [
    header,
    labelled("ส่วนราชการ", doc.agency, { spacing: { before: 120 } }, repair ? { size: 40, boldValue: true } : {}),
    new Paragraph({
      tabStops: [
        { type: TabStopType.LEFT, position: 7.8 * CM, leader: LeaderType.DOT },
        { type: TabStopType.LEFT, position: 8 * CM },
        { type: TabStopType.RIGHT, position: RIGHT, leader: LeaderType.DOT },
      ],
      children: [run("ที่", true), run(` ${doc.refNo}`), new TextRun({ text: "\t" }), new TextRun({ text: "\t" }), run("วันที่", true), run(` ${doc.date}`), new TextRun({ text: "\t" })],
    }),
    labelled("เรื่อง", doc.subject, {}, { boldValue: repair }),
    labelled("เรียน", doc.recipient, { spacing: { after: 160 } }, { boldValue: repair }),
    ...doc.paragraphs.map((p) => plain(p, body)),
    ...(doc.proposal ? [plain(doc.proposal, body)] : []),
    plain(doc.closing, { ...body, spacing: { after: 360 } }),
    ...(repair
      ? [
          new Paragraph({ ...signer, children: [run("(ลงชื่อ)...................... ผู้รายงาน")] }),
          new Paragraph({ ...signer, children: [run(`(${doc.signerName || "..........................................."})`)] }),
          new Paragraph({ ...signer, children: [run(`ตำแหน่ง ${doc.signerPosition || ".........................................."}`)] }),
        ]
      : [
          new Paragraph({ ...signer, children: [run("ลงชื่อ ................................................")] }),
          ...(doc.signerName ? [new Paragraph({ ...signer, children: [run(`(${doc.signerName})`)] })] : []),
          ...(doc.signerPosition ? [new Paragraph({ ...signer, children: [run(doc.signerPosition)] })] : []),
        ]),
  ];

  if (doc.decisionBlock && repair) {
    // Two columns: the unit head's opinion on the left, the director's order on the right.
    const line = { style: BorderStyle.SINGLE, size: 6, color: "000000" } as const;
    const box = (texts: { text: string; bold?: boolean; before?: number }[]) =>
      new TableCell({
        width: { size: 8 * CM, type: WidthType.DXA },
        borders: { top: line, bottom: line, left: line, right: line },
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        children: texts.map((t) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: t.before ?? 0 }, children: [run(t.text, t.bold)] })),
      });
    children.push(
      new Paragraph({ spacing: { before: 360 }, children: [] }),
      new Table({
        width: { size: 16 * CM, type: WidthType.DXA },
        columnWidths: [8 * CM, 8 * CM],
        rows: [
          new TableRow({
            children: [
              box([
                { text: "ความเห็นของหัวหน้างานอาคารสถานที่ / รองผู้อำนวยการกลุ่มบริหารทั่วไป", bold: true },
                { text: "ลงชื่อ ..............................", before: 480 },
                { text: "(..............................)" },
              ]),
              box([
                { text: "คำสั่งการ / การพิจารณาของผู้อำนวยการโรงเรียน", bold: true },
                { text: "☐ อนุมัติ      ☐ ไม่อนุมัติ", before: 80 },
                { text: "ลงชื่อ ..............................", before: 240 },
                { text: "(..............................)" },
              ]),
            ],
          }),
        ],
      }),
    );
  } else if (doc.decisionBlock) {
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
