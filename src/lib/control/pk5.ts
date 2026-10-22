// What the two Word documents (and their print views) say: the ปค.5 rows, the CSA blocks and the
// wording around them. Pure (relative imports with .ts extensions), so `npm test` can load it;
// docx.ts turns this content into Word and the /control/print page into HTML, so both agree.
import { CSA_FIELD, CSA_STEPS } from "./forms.ts";
import { needsPk5 } from "./risk.ts";
import type { ControlMission, ControlProject } from "./types.ts";
import { formatDateShort, isYmd } from "../time.ts";

/** Written out here, not imported from the memo module: that one carries names of people. */
export const SCHOOL_NAME = "โรงเรียนละหานทรายรัชดาภิเษก";
export const PK5_TITLE = "รายงานการประเมินผลการควบคุมภายใน";
/** The CSA title is centred on two lines; joined with a space it is the file's title. */
export const CSA_TITLE_LINES: readonly string[] = ["แบบประเมินการควบคุมด้วยตนเอง", "(Control Self Assessment: CSA)"];
export const CSA_TITLE = CSA_TITLE_LINES.join(" ");

/**
 * The reporter signs by hand: no name is filled in, whoever the school's director or deputy is.
 * Dots stay together when a line breaks (see thaiWords), so a blank is never split.
 */
export const SIGNATURE_LINES: readonly string[] = [
  "ลงชื่อ ................ ผู้รายงาน",
  "ตำแหน่ง ................",
  "วันที่ ........ เดือน ........ พ.ศ. ........",
];

export type DocMeta = { fiscalYear: number; groupLabel: string };

/** Share of the table width of each ปค.5 column, in the order of PK5_COLUMNS (sums to 100); Word and the print view use the same. */
export const PK5_WIDTHS: readonly number[] = [14, 15, 14, 15, 11, 17, 14];

/** The fiscal year ends on 30 September. */
export const yearEndLine = (fiscalYear: number): string => `สำหรับระยะเวลาการดำเนินงานสิ้นสุด วันที่ 30 เดือน กันยายน พ.ศ. ${fiscalYear}`;

/** The lines above the ปค.5 table, top to bottom. */
export const pk5Heading = ({ fiscalYear, groupLabel }: DocMeta): string[] => [SCHOOL_NAME, PK5_TITLE, yearEndLine(fiscalYear), groupLabel];

/** The lines above each mission's CSA. */
export const csaHeading = ({ fiscalYear, groupLabel }: DocMeta): string[] => [
  SCHOOL_NAME,
  ...CSA_TITLE_LINES,
  groupLabel,
  `ปีงบประมาณ พ.ศ. ${fiscalYear}`,
];

export type Pk5Cells = [string, string, string, string, string, string, string];
export type Pk5Row = { projectId: string; score: number; cells: Pk5Cells };

/** An empty field is a dash, so a blank cell never looks like a lost value. */
export const text = (s: string): string => s.trim() || "-";

/** Cell 7 of one measure: who does it and by when. The date's spaces are non-breaking, so it never wraps mid-date. */
const whoAndWhen = (responsible: string, due: string | null): string =>
  `${text(responsible)} / กำหนดเสร็จ ${due !== null && isYmd(due) ? formatDateShort(due).replaceAll(" ", "\u00a0") : "-"}`;

/**
 * The projects that are reported: confirmed, scoring 9 or more, highest score first and then by name.
 * ปค.1 and ปค.5 both list exactly these. `score` is the one from the mapper, which already prefers the
 * head's likelihood and impact.
 */
export function pk5Projects(projects: ControlProject[]): (ControlProject & { score: number })[] {
  const listed: (ControlProject & { score: number })[] = [];
  for (const p of projects) if (p.confirmed && p.score !== null && needsPk5(p.score)) listed.push({ ...p, score: p.score });
  return listed.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "th") || a.id.localeCompare(b.id));
}

/** The ปค.5 rows. A project with empty columns or no measures still gets its row (dashes), because dropping it would hide a risk. */
export function pk5Rows(projects: ControlProject[]): Pk5Row[] {
  return pk5Projects(projects).map((p) => ({
    projectId: p.id,
    score: p.score,
    cells: [
      // The school's form shows the project name, then its objective, in the first column.
      text(p.objective) === "-" ? text(p.name) : `${text(p.name)}\nวัตถุประสงค์: ${text(p.objective)}`,
      text(p.riskIssue),
      text(p.existingControls),
      text(p.assessment),
      text(p.residualRisk),
      p.actions.length ? p.actions.map((a, i) => `${i + 1}. ${text(a.description)}`).join("\n") : "-",
      p.actions.length ? p.actions.map((a, i) => `${i + 1}. ${whoAndWhen(a.responsible, a.due)}`).join("\n") : "-",
    ],
  }));
}

export type CsaBlock = { missionName: string; steps: { n: number; label: string; text: string }[] };

/** One block per mission: its name and the five steps in order, "-" for a step left empty. */
export const csaBlocks = (missions: ControlMission[]): CsaBlock[] =>
  missions.map((m) => ({
    missionName: text(m.name),
    steps: CSA_STEPS.map((s) => ({ n: s.n, label: s.label, text: text(m[CSA_FIELD[s.n]]) })),
  }));
