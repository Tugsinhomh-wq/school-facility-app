import { ArrowLeft, FileDown } from "lucide-react";
import { Sarabun } from "next/font/google";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PrintButton } from "@/components/control/print-button";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, LoadError } from "@/components/ui/state-card";
import { canReview } from "@/lib/control/access";
import { GROUPS, PK4_COLUMNS, PK5_COLUMNS, type GroupKey } from "@/lib/control/forms";
import { controlHref, docHref, parseExportQuery, parseYearQuery, type DocKind, type Query } from "@/lib/control/params";
import {
  PK1_ADDRESSEE,
  PK1_EMPTY,
  PK1_SIGNATURE_LINES,
  pk1Heading,
  pk1Improvements,
  pk1ImproveLabel,
  pk1Paragraphs,
  pk1RiskLabel,
  pk1Sections,
  type Pk1Section,
} from "@/lib/control/pk1";
import { PK4_SIGNATURE_LINES, PK4_WIDTHS, pk4Heading, pk4Rows } from "@/lib/control/pk4";
import { PK5_WIDTHS, SIGNATURE_LINES, csaBlocks, csaHeading, pk5Heading, pk5Rows, type DocMeta, type Pk5Row } from "@/lib/control/pk5";
import { fiscalYear } from "@/lib/control/risk";
import type { ControlAssessment, ControlMission } from "@/lib/control/types";
import { getAssessment, listMissions, listProjects } from "@/lib/data/control";
import { getSession, guardExecutive } from "@/lib/data/session";
import { bangkokYmd } from "@/lib/time";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "แบบพิมพ์ | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

// Same family as the Word file's TH Sarabun New, so the preview reads like the document.
const sarabun = Sarabun({ subsets: ["thai", "latin"], weight: ["400", "700"] });

const backLink =
  "inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 print:hidden";
const cellClass = "border border-black px-2 py-1 align-top break-words whitespace-pre-line";
const asDoc = (v: string | string[] | undefined): DocKind | null => {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "pk1" || s === "pk4" || s === "pk5" || s === "csa" ? s : null;
};
const DOC_NAME: Record<DocKind, string> = { pk1: "ปค.1", pk4: "ปค.4", pk5: "ปค.5", csa: "CSA" };

/** The signature lines (the person signs by hand); the block sits at the right like the Word file's. */
function Signature({ lines }: { lines: readonly string[] }) {
  return (
    <div className="mt-8 ml-auto w-fit space-y-0.5 text-center break-inside-avoid">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

/** ปค.5 as the Word file has it: the heading, the seven-column table, the blank signature lines. */
function Pk5Sheet({ rows, meta }: { rows: Pk5Row[]; meta: DocMeta }) {
  const [school, title, period, group] = pk5Heading(meta);
  return (
    <>
      <header className="space-y-0.5 text-center">
        <p className="font-bold">{school}</p>
        <p className="font-bold">{title}</p>
        <p>{period}</p>
        <p className="font-bold">{group}</p>
      </header>
      <table className="mt-4 w-full table-fixed border-collapse text-[11pt] leading-snug">
        <colgroup>
          {PK5_WIDTHS.map((w, i) => (
            <col key={i} style={{ width: `${w}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {PK5_COLUMNS.map((c) => (
              <th key={c} scope="col" className="border border-black bg-neutral-200 px-2 py-1 text-center font-bold [print-color-adjust:exact]">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.projectId}>
              {r.cells.map((c, i) => (
                <td key={i} className={cellClass}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <Signature lines={SIGNATURE_LINES} />
    </>
  );
}

/** ปค.1 as the Word file has it: title lines, addressee, the three paragraphs, every group's items, the signature. */
function Pk1Sheet({ sections, fy }: { sections: Pk1Section[]; fy: number }) {
  const [title1, title2, period] = pk1Heading(fy);
  return (
    <>
      {/* The form tag sits at the right in normal weight; the title and the year line stay centred. */}
      <p className="text-right">{title1}</p>
      <header className="space-y-0.5 text-center">
        <p className="font-bold">{title2}</p>
        <p>{period}</p>
      </header>
      <p className="mt-4">{PK1_ADDRESSEE}</p>
      {pk1Paragraphs(fy).map((t) => (
        <p key={t} className="mt-2 indent-12 text-justify">
          {t}
        </p>
      ))}
      {sections.map((s) => (
        <section key={s.groupLabel} className="mt-4 space-y-1">
          <h2 className="font-bold break-after-avoid">{s.groupLabel}</h2>
          {s.items.length === 0 && <p className="pl-8">{PK1_EMPTY}</p>}
          {s.items.map((item) => (
            <div key={item.n} className="space-y-0.5">
              <p className="pl-8 -indent-8 font-bold break-after-avoid whitespace-pre-line">
                {item.n}. {item.title}
              </p>
              <p className="pl-16 -indent-8 break-after-avoid whitespace-pre-line">{pk1RiskLabel(item.n)}</p>
              <p className="pl-16 whitespace-pre-line">{item.risk}</p>
              <p className="pl-16 -indent-8 break-after-avoid whitespace-pre-line">{pk1ImproveLabel(item.n)}</p>
              {pk1Improvements(item).map((t, i) => (
                <p key={i} className="pl-16 whitespace-pre-line">
                  {t}
                </p>
              ))}
            </div>
          ))}
        </section>
      ))}
      <Signature lines={PK1_SIGNATURE_LINES} />
    </>
  );
}

/** ปค.4 as the Word file has it: the heading, the two-column table with a band per component, the signature. */
function Pk4Sheet({ assessment, meta }: { assessment: ControlAssessment; meta: DocMeta }) {
  const [school, title, period, group] = pk4Heading(meta);
  return (
    <>
      <header className="space-y-0.5 text-center">
        <p className="font-bold">{school}</p>
        <p className="font-bold">{title}</p>
        <p>{period}</p>
        <p className="font-bold">{group}</p>
      </header>
      <table className="mt-4 w-full table-fixed border-collapse text-[12pt] leading-snug">
        <colgroup>
          {PK4_WIDTHS.map((w, i) => (
            <col key={i} style={{ width: `${w}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {PK4_COLUMNS.map((c) => (
              <th key={c} scope="col" className="border border-black bg-neutral-200 px-2 py-1 text-center font-bold [print-color-adjust:exact]">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pk4Rows(assessment).map((r) =>
            r.kind === "component" ? (
              <tr key={`c${r.n}`}>
                <th colSpan={2} scope="colgroup" className="border border-black bg-neutral-200 px-2 py-1 text-left font-bold [print-color-adjust:exact]">
                  {r.left}
                </th>
              </tr>
            ) : (
              <tr key={`${r.kind}${r.n}`}>
                <td className={cellClass}>{r.left}</td>
                {/* A summary's first line is its label, bold like the Word file's. */}
                <td className={cellClass}>
                  {r.kind === "summary" ? (
                    <>
                      <span className="font-bold">{r.right.split("\n", 1)[0]}</span>
                      {r.right.slice(r.right.indexOf("\n"))}
                    </>
                  ) : (
                    r.right
                  )}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      <Signature lines={PK4_SIGNATURE_LINES} />
    </>
  );
}

/** CSA as the Word file has it: one page per mission. */
function CsaSheet({ missions, meta }: { missions: ControlMission[]; meta: DocMeta }) {
  const [school, title1, title2, group, year] = csaHeading(meta);
  const heading = (
    <header className="space-y-0.5 text-center">
      <p className="font-bold">{school}</p>
      <p className="font-bold">{title1}</p>
      <p className="font-bold">{title2}</p>
      <p className="font-bold">{group}</p>
      <p>{year}</p>
    </header>
  );
  const blocks = csaBlocks(missions);
  if (blocks.length === 0) return heading;
  return (
    <>
      {blocks.map((b, i) => (
        <section key={i} className={cn("space-y-3", i > 0 && "mt-10 break-before-page print:mt-0")}>
          {heading}
          <p className="pt-2">
            <span className="font-bold">ภารกิจ </span>
            {b.missionName}
          </p>
          {b.steps.map((s) => (
            <div key={s.n} className="space-y-1">
              <h2 className="font-bold">
                {s.n}. {s.label}
              </h2>
              <p className="pl-6 whitespace-pre-line">{s.text}</p>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

/** The print view of ปค.5 or CSA of one group: ?doc=pk5|csa&fy=&group=. Officers only. */
export default async function PrintPage({ searchParams }: { searchParams: Promise<Query> }) {
  await guardExecutive();
  const session = await getSession();
  if (session && !canReview(session.viewer.role)) redirect("/control");

  const currentFy = fiscalYear(bangkokYmd(new Date()));
  const q = await searchParams;
  const doc = asDoc(q.doc);
  // ปค.1 is school-wide (a year only, any ?group= is ignored); the others need one group.
  const target = doc === "pk1" ? parseYearQuery(q, currentFy) : parseExportQuery(q, currentFy);
  if (!doc || !target.ok) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <EmptyState
          title="เปิดแบบพิมพ์ไม่ได้"
          hint={!target.ok ? target.message : "เลือกเอกสารที่ต้องการ แล้วกดดูแบบพิมพ์อีกครั้ง"}
        >
          <Link
            href="/control/export"
            className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            ไปเลือกเอกสาร
          </Link>
        </EmptyState>
      </div>
    );
  }

  const { fy, group }: { fy: number; group?: GroupKey } = target.value;
  const groupLabel = GROUPS.find((g) => g.key === group)?.label ?? group ?? "";
  const meta = { fiscalYear: fy, groupLabel };
  const name = DOC_NAME[doc];
  const here = docHref("/control/print", fy, group, doc);

  // Each document reads only what it prints. ปค.1 and ปค.5 both come from the year's projects.
  const projectData = doc === "pk5" || doc === "pk1" ? await listProjects(fy) : null;
  const missionData = doc === "csa" ? await listMissions(fy) : null;
  const assessData = doc === "pk4" && group ? await getAssessment(fy, group) : null;
  const failed = projectData?.failed || missionData?.failed || assessData?.failed;
  const projects = projectData?.projects ?? [];
  const rows = doc === "pk5" ? pk5Rows(projects.filter((p) => p.groupKey === group)) : [];
  const sections = doc === "pk1" ? pk1Sections(projects) : [];
  const missions = missionData?.missions.filter((m) => m.groupKey === group) ?? [];
  const empty =
    doc === "pk5" ? rows.length === 0 : doc === "pk1" ? sections.every((s) => s.items.length === 0) : doc === "pk4" ? !assessData?.assessment.updatedAt : missions.length === 0;
  const emptyText: Record<DocKind, string> = {
    pk5: `ยังไม่มีโครงการของ${groupLabel}ที่เข้า ปค.5 (ต้องให้คะแนน 9 ขึ้นไปและหัวหน้ายืนยันแล้ว) จึงมีแต่หัวเรื่องและช่องลงนาม`,
    csa: `ยังไม่มีภารกิจของ${groupLabel}ในปีงบประมาณ ${fy} จึงมีแต่หัวเรื่อง`,
    pk1: `ยังไม่มีโครงการที่เข้า ปค.5 ในปีงบประมาณ ${fy} ทุกกลุ่มงานจึงเป็น "${PK1_EMPTY}"`,
    pk4: `ยังไม่ได้กรอกผลประเมิน ปค.4 ของ${groupLabel}ในปีงบประมาณ ${fy} ช่องความเห็นจึงเป็นเครื่องหมาย - ทุกข้อ`,
  };

  return (
    <div className="space-y-4">
      {/* The paper size of the printout: ปค.5 is wide, the others are pages of text. */}
      <style>{`@page { size: A4 ${doc === "pk5" ? "landscape" : "portrait"}; margin: 12mm; }`}</style>
      <div className="space-y-3 print:hidden">
        <Link href={controlHref("/control/export", { fy, group }, currentFy)} className={backLink}>
          <ArrowLeft className="size-4" aria-hidden />
          ส่งออกเอกสาร
        </Link>
        <h1 className="font-display text-3xl font-medium tracking-tight">แบบพิมพ์ {name}</h1>
        <div className="flex flex-wrap gap-2">
          <PrintButton />
          <a
            href={docHref(`/control/export/${doc}`, fy, group)}
            className={cn(buttonVariants({ variant: "outline" }), "h-11 gap-1.5 px-4")}
          >
            <FileDown aria-hidden />
            ดาวน์โหลด Word (.docx)
          </a>
        </div>
        {!session && <p className="text-sm text-muted-foreground">โหมดสาธิต: ยังไม่ได้เชื่อมต่อฐานข้อมูล จึงยังไม่มีข้อมูลให้แสดง</p>}
        {!failed && empty && <p className="text-sm text-muted-foreground">{emptyText[doc]}</p>}
      </div>

      {failed ? (
        <LoadError what={`ข้อมูล ${name}`} retryHref={here} />
      ) : (
        <article
          className={cn(
            sarabun.className,
            "mx-auto bg-white p-6 text-[12pt] leading-snug text-black",
            "rounded-xl border border-border print:max-w-none print:rounded-none print:border-0 print:p-0",
            doc === "pk5" ? "max-w-[1123px]" : "max-w-[794px]",
          )}
        >
          {doc === "pk5" && <Pk5Sheet rows={rows} meta={meta} />}
          {doc === "csa" && <CsaSheet missions={missions} meta={meta} />}
          {doc === "pk1" && <Pk1Sheet sections={sections} fy={fy} />}
          {doc === "pk4" && assessData && <Pk4Sheet assessment={assessData.assessment} meta={meta} />}
        </article>
      )}
    </div>
  );
}
