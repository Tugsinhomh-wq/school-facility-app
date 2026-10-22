// What the ปค.1 certificate says: the fixed opening, then for each group the ปค.5 projects with their
// remaining risk and improvement. Pure (relative imports with .ts extensions), so `npm test` can load it;
// docx.ts turns this content into Word and the /control/print page into HTML, so both agree.
import { GROUPS } from "./forms.ts";
import { SCHOOL_NAME, pk5Projects, text as orDash, yearEndLine } from "./pk5.ts";
import type { ControlProject } from "./types.ts";

// The wording below follows the school's own file; change it here only.
export const PK1_TITLE_LINES: readonly string[] = ["แบบ ปค.1", "หนังสือรับรองการประเมินผลการควบคุมภายใน"];
export const PK1_TITLE = PK1_TITLE_LINES.join(" ");
export const PK1_ADDRESSEE = "เรียน ผู้อำนวยการสำนักงานเขตพื้นที่การศึกษามัธยมศึกษาบุรีรัมย์";
export const PK1_EMPTY = "ไม่มีรายการที่ต้องรายงาน";

/** The three fixed paragraphs under the addressee. */
export const pk1Paragraphs = (fiscalYear: number): string[] => [
  `${SCHOOL_NAME} ได้ประเมินผลการควบคุมภายในของหน่วยงานสำหรับปีสิ้นสุดวันที่ 30 เดือน กันยายน พ.ศ. ${fiscalYear} ด้วยวิธีการที่โรงเรียนกำหนด ซึ่งเป็นไปตามหลักเกณฑ์กระทรวงการคลังว่าด้วยมาตรฐานและหลักเกณฑ์ปฏิบัติการควบคุมภายในสำหรับหน่วยงานของรัฐ พ.ศ. 2561 โดยมีวัตถุประสงค์เพื่อให้ความมั่นใจอย่างสมเหตุสมผลว่า ภารกิจของหน่วยงานจะบรรลุวัตถุประสงค์ของการควบคุมภายในด้านการดำเนินงานที่มีประสิทธิผล ประสิทธิภาพ ด้านการรายงานที่เกี่ยวกับการเงินและไม่ใช่การเงินที่เชื่อถือได้ ทันเวลา และโปร่งใส รวมทั้งด้านการปฏิบัติตามกฎหมาย ระเบียบ และข้อบังคับที่เกี่ยวข้องกับการดำเนินงาน`,
  `จากผลการประเมินดังกล่าว ${SCHOOL_NAME} เห็นว่า การควบคุมภายในของหน่วยงานมีความเพียงพอและปฏิบัติตามอย่างต่อเนื่อง เป็นไปตามหลักเกณฑ์กระทรวงการคลังว่าด้วยมาตรฐานและหลักเกณฑ์ปฏิบัติการควบคุมภายในสำหรับหน่วยงานของรัฐ พ.ศ. 2561 แต่ยังมีบางเรื่องที่ต้องปรับปรุงการควบคุมภายในให้มีประสิทธิภาพยิ่งขึ้น ภายใต้การกำกับดูแลของผู้อำนวยการสำนักงานเขตพื้นที่การศึกษามัธยมศึกษาบุรีรัมย์`,
  "อย่างไรก็ดี มีความเสี่ยงและได้กำหนดปรับปรุงการควบคุมภายใน ในปีงบประมาณถัดไป สรุปได้ ดังนี้",
];

/** The lines above the addressee, centred. */
export const pk1Heading = (fiscalYear: number): string[] => [...PK1_TITLE_LINES, yearEndLine(fiscalYear)];

/** The director signs by hand: no name is filled in, whoever the director is. */
export const DIRECTOR_SIGNATURE_LINES: readonly string[] = [
  "ลายมือชื่อ ................ ผู้รายงาน",
  `ตำแหน่ง ผู้อำนวยการ${SCHOOL_NAME}`,
  "วันที่ ........ เดือน ........ พ.ศ. ........",
];

/** The labels of the two lines under an item, "{n}.1" and "{n}.2". */
export const pk1RiskLabel = (n: number): string => `${n}.1 ความเสี่ยงที่มีอยู่ที่ต้องกำหนดปรับปรุงการควบคุมภายใน`;
export const pk1ImproveLabel = (n: number): string => `${n}.2 การปรับปรุงการควบคุมภายใน`;

export type Pk1Item = { n: number; title: string; risk: string; improvements: string[] };
export type Pk1Section = { groupLabel: string; items: Pk1Item[] };

/** All six groups in order, each with its ปค.5 projects (the same selection and order as ปค.5), numbered from 1. */
export const pk1Sections = (projects: ControlProject[]): Pk1Section[] => {
  const listed = pk5Projects(projects);
  return GROUPS.map((g) => ({
    groupLabel: g.label,
    items: listed
      .filter((p) => p.groupKey === g.key)
      .map((p, i) => ({
        n: i + 1,
        title: `งาน/กิจกรรม ${orDash(p.name)}${p.objective.trim() ? ` วัตถุประสงค์ ${p.objective.trim()}` : ""}`,
        risk: orDash(p.residualRisk),
        improvements: p.actions.length ? p.actions.map((a) => orDash(a.description)) : ["-"],
      })),
  }));
};

/** The improvements as printed: numbered "1) ..." only when there is more than one. */
export const pk1Improvements = (item: Pk1Item): string[] =>
  item.improvements.length > 1 ? item.improvements.map((s, i) => `${i + 1}) ${s}`) : item.improvements;
