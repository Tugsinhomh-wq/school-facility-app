// Word files of the two internal-control documents, built with docx-js like the memos (src/lib/memo/docx.ts).
// Pure apart from docx itself and relative imports with .ts extensions, so `npm test` can open the result.
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

import { PK4_COLUMNS, PK5_COLUMNS } from "./forms.ts";
import {
  DIRECTOR_SIGNATURE_LINES,
  PK1_ADDRESSEE,
  PK1_EMPTY,
  PK1_TITLE,
  pk1Heading,
  pk1Improvements,
  pk1ImproveLabel,
  pk1Paragraphs,
  pk1RiskLabel,
  type Pk1Section,
} from "./pk1.ts";
import { PK4_TITLE, PK4_WIDTHS, pk4Heading, pk4Rows } from "./pk4.ts";
import { CSA_TITLE, PK5_TITLE, PK5_WIDTHS, SCHOOL_NAME, SIGNATURE_LINES, csaBlocks, csaHeading, pk5Heading, type DocMeta, type Pk5Row } from "./pk5.ts";
import type { ControlAssessment, ControlMission } from "./types.ts";
import { withBreakHints } from "../memo/thai-text.ts";

/** "TH Sarabun New" must be installed on the reader's machine, as for the memos. */
const FONT = "TH Sarabun New";
const SIZE = 32; // 16 pt, in half-points
const CM = 567; // twips per centimetre
const A4 = { width: 11906, height: 16838 };
const PORTRAIT_MARGIN = { top: 2 * CM, bottom: 2 * CM, left: 2.5 * CM, right: 2 * CM };

/** Anything XML 1.0 cannot carry (control characters, lone surrogates) would make Word call the file corrupt. */
const NOT_XML = /[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu;

/** A user's text, split into lines (a table cell or a step holds several), each safe for Word. */
const linesOf = (text: string): string[] => text.replace(NOT_XML, "").replaceAll("\t", " ").split(/\r\n|\r|\n/);

const run = (text: string, bold = false) =>
  new TextRun({
    text: withBreakHints(text),
    bold,
    boldComplexScript: bold,
    size: SIZE,
    sizeComplexScript: SIZE,
    font: { ascii: FONT, hAnsi: FONT, cs: FONT },
    language: { value: "th-TH", bidirectional: "th-TH" },
  });

const lineBorder = { style: BorderStyle.SINGLE, size: 4, color: "000000" } as const;
const allBorders = { top: lineBorder, bottom: lineBorder, left: lineBorder, right: lineBorder };

/** The lines above a document, centred; `boldAt` lists which of them are bold. */
const headingParagraphs = (lines: string[], boldAt: number[], pageBreakBefore = false) =>
  lines.map(
    (line, i) =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        pageBreakBefore: pageBreakBefore && i === 0,
        keepNext: true,
        children: [run(line, boldAt.includes(i))],
      }),
  );

/** `shade` fills the cell (a header always is); `boldFirst` makes the first line bold; `span` is the number of columns it covers. */
const cell = (width: number, lines: string[], header: boolean, opts: { span?: number; shade?: boolean; boldFirst?: boolean } = {}) =>
  new TableCell({
    width: { size: width, type: WidthType.DXA },
    columnSpan: opts.span,
    borders: allBorders,
    margins: { top: 40, bottom: 40, left: 90, right: 90 },
    verticalAlign: header ? VerticalAlign.CENTER : VerticalAlign.TOP,
    shading: header || opts.shade ? { type: ShadingType.CLEAR, fill: header ? "E7E6E6" : "F2F2F2", color: "auto" } : undefined,
    children: lines.map(
      (line, i) => new Paragraph({ alignment: header ? AlignmentType.CENTER : AlignmentType.LEFT, children: [run(line, header || (opts.boldFirst === true && i === 0))] }),
    ),
  });

/** The signature lines at the end of a document, centred in the right-hand part of the page. */
const signatureBlock = (lines: readonly string[], left: number) =>
  lines.map(
    (line, i) =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        indent: { left },
        spacing: { before: i === 0 ? 480 : 0 },
        keepNext: i < lines.length - 1,
        keepLines: true,
        children: [run(line)],
      }),
  );

/** Column widths in twips from shares summing to 100; the last takes the rounding. */
const columnWidths = (total: number, shares: readonly number[]): number[] => {
  const widths = shares.map((s) => Math.floor((total * s) / 100));
  widths[widths.length - 1] += total - widths.reduce((a, b) => a + b, 0);
  return widths;
};

function pack(sections: ConstructorParameters<typeof Document>[0]["sections"], title: string): Promise<Buffer> {
  return Packer.toBuffer(
    new Document({
      creator: SCHOOL_NAME,
      title,
      styles: { default: { document: { run: { font: { ascii: FONT, hAnsi: FONT, cs: FONT }, size: SIZE, sizeComplexScript: SIZE } } } },
      sections,
    }),
  );
}

/**
 * ปค.5 on A4 landscape: the heading, the seven-column table (its header row repeats on every page) and
 * the reporter's signature lines, left blank. No rows still gives the heading, the header row and the signature.
 */
export function pk5ToDocx(rows: Pk5Row[], meta: DocMeta): Promise<Buffer> {
  const margin = { top: 2 * CM, bottom: 2 * CM, left: 1.5 * CM, right: 1.5 * CM };
  // Landscape: the long edge is the width. docx swaps the two for us when the orientation is landscape.
  const total = A4.height - margin.left - margin.right;
  const widths = columnWidths(total, PK5_WIDTHS);

  const table = new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: { ...allBorders, insideHorizontal: lineBorder, insideVertical: lineBorder },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: PK5_COLUMNS.map((c, i) => cell(widths[i], [c], true)) }),
      ...rows.map((r) => new TableRow({ children: r.cells.map((c, i) => cell(widths[i], linesOf(c), false)) })),
    ],
  });

  return pack(
    [
      {
        properties: { page: { size: { ...A4, orientation: PageOrientation.LANDSCAPE }, margin } },
        children: [...headingParagraphs(pk5Heading(meta), [0, 1, 3]), new Paragraph({ spacing: { after: 120 }, children: [] }), table, ...signatureBlock(SIGNATURE_LINES, 15 * CM)],
      },
    ],
    PK5_TITLE,
  );
}

/**
 * CSA on A4 portrait: for each mission its heading, the mission's name and the five steps, each mission on its
 * own page. No missions still gives one heading, so the file opens.
 */
export function csaToDocx(missions: ControlMission[], meta: DocMeta): Promise<Buffer> {
  const heading = csaHeading(meta);
  const children: Paragraph[] = [];
  const blocks = csaBlocks(missions);
  if (blocks.length === 0) children.push(...headingParagraphs(heading, [0, 1, 2, 3]));
  blocks.forEach((block, i) => {
    children.push(
      ...headingParagraphs(heading, [0, 1, 2, 3], i > 0),
      new Paragraph({ spacing: { before: 240 }, keepNext: true, children: [run("ภารกิจ ", true), run(block.missionName)] }),
    );
    for (const step of block.steps) {
      children.push(new Paragraph({ spacing: { before: 200 }, keepNext: true, children: [run(`${step.n}. ${step.label}`, true)] }));
      for (const line of linesOf(step.text)) children.push(new Paragraph({ indent: { left: 0.75 * CM }, children: [run(line)] }));
    }
  });

  return pack(
    [{ properties: { page: { size: A4, margin: PORTRAIT_MARGIN } }, children }],
    CSA_TITLE,
  );
}

/** A paragraph per line of `text`; with `hanging`, the first line starts that far left of the rest. */
const block = (text: string, left: number, o: { bold?: boolean; keepNext?: boolean; hanging?: number } = {}) =>
  linesOf(text).map(
    (line, i) => new Paragraph({ indent: { left, hanging: i === 0 ? o.hanging : undefined }, keepNext: o.keepNext, children: [run(line, o.bold)] }),
  );

/**
 * ปค.1 on A4 portrait: title, year, addressee and the three fixed paragraphs, then every group with its
 * items (title, remaining risk, improvement) or "none to report", then the director's signature lines.
 */
export function pk1ToDocx(sections: Pk1Section[], meta: { fiscalYear: number }): Promise<Buffer> {
  const sub = 1.2 * CM;
  const children: Paragraph[] = [
    ...headingParagraphs(pk1Heading(meta.fiscalYear), [0, 1]),
    new Paragraph({ spacing: { before: 240 }, keepNext: true, children: [run(PK1_ADDRESSEE)] }),
    ...pk1Paragraphs(meta.fiscalYear).map(
      (t) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 1.25 * CM }, spacing: { before: 120 }, children: [run(t)] }),
    ),
  ];
  for (const s of sections) {
    children.push(new Paragraph({ spacing: { before: 240 }, keepNext: true, children: [run(s.groupLabel, true)] }));
    if (s.items.length === 0) children.push(...block(PK1_EMPTY, sub));
    for (const item of s.items) {
      children.push(
        ...block(`${item.n}. ${item.title}`, sub, { bold: true, keepNext: true, hanging: sub }),
        ...block(pk1RiskLabel(item.n), 2 * sub, { keepNext: true, hanging: sub }),
        ...block(item.risk, 2 * sub),
        ...block(pk1ImproveLabel(item.n), 2 * sub, { keepNext: true, hanging: sub }),
        ...pk1Improvements(item).flatMap((t) => block(t, 2 * sub)),
      );
    }
  }
  children.push(...signatureBlock(DIRECTOR_SIGNATURE_LINES, 7.5 * CM));

  return pack([{ properties: { page: { size: A4, margin: PORTRAIT_MARGIN } }, children }], PK1_TITLE);
}

/**
 * ปค.4 on A4 portrait: the heading, a two-column table (its header row repeats on every page; no row is
 * kept whole, because LibreOffice drops rows that are both) with a shaded band per component, then the
 * director's signature lines. An empty assessment still gives every row, with dashes.
 */
export function pk4ToDocx(a: ControlAssessment, meta: DocMeta): Promise<Buffer> {
  const total = A4.width - PORTRAIT_MARGIN.left - PORTRAIT_MARGIN.right;
  const widths = columnWidths(total, PK4_WIDTHS);
  const rows = pk4Rows(a).map((r) =>
    r.kind === "component"
      ? new TableRow({ children: [cell(total, [r.left], false, { span: 2, shade: true, boldFirst: true })] })
      : new TableRow({ children: [cell(widths[0], linesOf(r.left), false), cell(widths[1], linesOf(r.right), false, { boldFirst: r.kind === "summary" })] }),
  );
  const table = new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: { ...allBorders, insideHorizontal: lineBorder, insideVertical: lineBorder },
    rows: [new TableRow({ tableHeader: true, children: PK4_COLUMNS.map((c, i) => cell(widths[i], [c], true)) }), ...rows],
  });

  return pack(
    [
      {
        properties: { page: { size: A4, margin: PORTRAIT_MARGIN } },
        children: [...headingParagraphs(pk4Heading(meta), [0, 1, 3]), new Paragraph({ spacing: { after: 120 }, children: [] }), table, ...signatureBlock(DIRECTOR_SIGNATURE_LINES, 7.5 * CM)],
      },
    ],
    PK4_TITLE,
  );
}
