// What the ปค.4 report says: the heading, and the rows of its two-column table (components, principles
// with the typed comment and result, summaries). Pure (relative imports with .ts extensions), so
// `npm test` can load it; docx.ts turns this content into Word and the /control/print page into HTML,
// so both agree. All the text is typed by staff; nothing here writes an opinion.
import { ASSESS_RESULTS, PK4_COMPONENTS, PRINCIPLE_COUNT, SUMMARY_LABEL } from "./forms.ts";
import { SCHOOL_NAME, text as orDash, yearEndLine, type DocMeta } from "./pk5.ts";
import type { ControlAssessment } from "./types.ts";

export const PK4_TITLE = "รายงานการประเมินองค์ประกอบของการควบคุมภายใน";

/** Share of the table width of each ปค.4 column, in the order of PK4_COLUMNS (sums to 100); Word and the print view use the same. */
export const PK4_WIDTHS: readonly number[] = [42, 58];

/** The director signs by hand, as in ปค.1 but with the school's wording for this form ("ลงชื่อ"); no name is filled in. */
export const PK4_SIGNATURE_LINES: readonly string[] = [
  "ลงชื่อ ................ ผู้รายงาน",
  "(................................)",
  `ตำแหน่ง ผู้อำนวยการ${SCHOOL_NAME}`,
  "วันที่ ........ เดือน ........ พ.ศ. ........",
];

/** The lines above the ปค.4 table, top to bottom. */
export const pk4Heading = ({ fiscalYear, groupLabel }: DocMeta): string[] => [SCHOOL_NAME, PK4_TITLE, yearEndLine(fiscalYear), groupLabel];

/**
 * One table row. "component" spans both columns (its text is `left`), "principle" has the principle on the
 * left and the comment on the right, "summary" has an empty left and SUMMARY_LABEL, a line break and the
 * typed summary on the right. `n` is the number of the component or principle.
 */
export type Pk4Row = { kind: "component" | "principle" | "summary"; n: number; left: string; right: string };

/**
 * Each component ("{n}. {label}"), its principles, then its summary. A typed comment starts with its
 * principle's number, like the school's file ("3) ..."), and ends with its result in brackets, e.g.
 * "3) ... (บางส่วน)". A result alone is just "(บางส่วน)" and no comment is "-": no number on those.
 */
export function pk4Rows(a: ControlAssessment): Pk4Row[] {
  const rows: Pk4Row[] = [];
  for (const c of PK4_COMPONENTS) {
    rows.push({ kind: "component", n: c.n, left: `${c.n}. ${c.label}`, right: "" });
    for (const p of c.principles) {
      const text = a.principles[p.n]?.text.trim() ?? "";
      const label = ASSESS_RESULTS.find((r) => r.key === a.principles[p.n]?.result)?.label;
      const comment = text ? `${p.n}) ${text}` : "";
      const right = label ? `${comment} (${label})`.trim() : orDash(comment);
      rows.push({ kind: "principle", n: p.n, left: `${p.n}) ${p.text}`, right });
    }
    rows.push({ kind: "summary", n: c.n, left: "", right: `${SUMMARY_LABEL}\n${orDash(a.summaries[c.n] ?? "")}` });
  }
  return rows;
}

/** How many of the 17 principles are at each result; `unanswered` has none chosen. */
export function pk4Counts(a: ControlAssessment): { full: number; partial: number; none: number; unanswered: number; total: number } {
  const counts = { full: 0, partial: 0, none: 0, unanswered: 0, total: PRINCIPLE_COUNT };
  for (let n = 1; n <= PRINCIPLE_COUNT; n++) counts[a.principles[n]?.result ?? "unanswered"]++;
  return counts;
}
