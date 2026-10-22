import { ArrowLeft, FileDown } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { chip } from "@/components/cleaning/officer-overview";
import { YearNav } from "@/components/control/filters";
import { buttonVariants } from "@/components/ui/button";
import { LoadError } from "@/components/ui/state-card";
import { canReview } from "@/lib/control/access";
import { GROUPS, type GroupKey } from "@/lib/control/forms";
import { controlHref, docHref, resolveGroup, resolveYear, type Query } from "@/lib/control/params";
import { pk5Rows } from "@/lib/control/pk5";
import { fiscalYear, needsPk5 } from "@/lib/control/risk";
import { listMissions, listProjects } from "@/lib/data/control";
import { getSession, guardExecutive } from "@/lib/data/session";
import { bangkokYmd } from "@/lib/time";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ส่งออกเอกสาร | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

const heading = "text-sm font-medium text-muted-foreground";
const toolLink =
  "inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

/** One document of the chooser: what is in it, then the two ways to get it. */
function DocRow({ title, detail, note, doc, fy, group }: { title: string; detail: string; note?: string; doc: "pk5" | "csa"; fy: number; group: GroupKey }) {
  return (
    <li className="space-y-3 px-4 py-4 sm:px-5">
      <div className="space-y-0.5 leading-snug">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm tabular-nums">{detail}</p>
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {/* A plain link to the route: the browser saves the file, no JavaScript needed. */}
        <a href={docHref(`/control/export/${doc}`, fy, group)} download className={cn(buttonVariants(), "h-11 gap-1.5 px-4")}>
          <FileDown aria-hidden />
          ดาวน์โหลด Word (.docx)
        </a>
        <Link href={docHref("/control/print", fy, group, doc)} className={toolLink}>
          ดูแบบพิมพ์
        </Link>
      </div>
    </li>
  );
}

/** Choose the fiscal year and one group, then download ปค.5 or CSA as Word, or open the print view. Officers only. */
export default async function ExportPage({ searchParams }: { searchParams: Promise<Query> }) {
  await guardExecutive();
  const session = await getSession();
  // The documents are the officers' tool. No session at all is demo mode (no database), which has nothing to export.
  if (session && !canReview(session.viewer.role)) redirect("/control");

  const currentFy = fiscalYear(bangkokYmd(new Date()));
  const q = await searchParams;
  // A bad ?fy= or ?group= means the default (no group chosen yet), never an error page.
  const fy = resolveYear(q.fy, currentFy);
  const group = resolveGroup(q.group);
  const groupLabel = GROUPS.find((g) => g.key === group)?.label;
  const here = controlHref("/control/export", { fy, group }, currentFy);

  const [projectList, missionList] = group ? await Promise.all([listProjects(fy), listMissions(fy)]) : [null, null];
  const failed = projectList?.failed || missionList?.failed;
  const projects = projectList?.projects.filter((p) => p.groupKey === group) ?? [];
  const missions = missionList?.missions.filter((m) => m.groupKey === group) ?? [];
  const inPk5 = pk5Rows(projects).length;
  // High-scoring projects the head has not confirmed yet are the usual reason a ปค.5 looks short.
  const waiting = projects.filter((p) => !p.confirmed && needsPk5(p.score)).length;

  const pk5Note = [
    inPk5 === 0 ? "ต้องให้คะแนน 9 ขึ้นไปและหัวหน้ายืนยันแล้ว ไฟล์จะมีแต่หัวเรื่องและช่องลงนาม" : "เฉพาะโครงการที่คะแนน 9 ขึ้นไปและหัวหน้ายืนยันแล้ว",
    waiting > 0 && `อีก ${waiting} โครงการคะแนน 9 ขึ้นไปที่รอหัวหน้ายืนยัน จึงยังไม่อยู่ในเอกสาร`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={controlHref("/control", { fy, group }, currentFy)}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        โครงการและความเสี่ยง
      </Link>
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-medium tracking-tight">ส่งออกเอกสาร</h1>
        <p className="text-sm text-muted-foreground">
          ปค.5 และ CSA ออกเป็นไฟล์ Word ทีละกลุ่มงาน เพราะแต่ละกลุ่มลงนามรายงานของตัวเอง
        </p>
      </div>
      {!session && <p className="text-sm text-muted-foreground">โหมดสาธิต: ยังไม่ได้เชื่อมต่อฐานข้อมูล จึงยังไม่มีเอกสารให้ส่งออก</p>}

      <YearNav path="/control/export" fy={fy} group={group} currentFy={currentFy} />

      <nav aria-label="เลือกกลุ่มงาน" className="space-y-2">
        <h2 className={heading}>กลุ่มงาน</h2>
        <div className="-mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:w-auto sm:flex-wrap sm:px-0">
          {GROUPS.map((g) => (
            <Link
              key={g.key}
              href={controlHref("/control/export", { fy, group: g.key }, currentFy)}
              aria-current={group === g.key ? "page" : undefined}
              className={chip(group === g.key)}
            >
              {g.label}
            </Link>
          ))}
        </div>
      </nav>

      {!group ? (
        <p className="text-base">เลือกกลุ่มงานก่อน จึงจะดาวน์โหลดเอกสารได้</p>
      ) : failed ? (
        <LoadError what="ข้อมูลสำหรับเอกสาร" retryHref={here} />
      ) : (
        <section aria-labelledby="docs-title" className="space-y-2">
          <h2 id="docs-title" className={heading}>
            เอกสารของ{groupLabel} ปีงบประมาณ {fy}
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            <DocRow
              doc="pk5"
              fy={fy}
              group={group}
              title="ปค.5 รายงานการประเมินผลการควบคุมภายใน"
              detail={inPk5 > 0 ? `${inPk5} โครงการในตาราง` : "ยังไม่มีโครงการในตาราง"}
              note={pk5Note}
            />
            <DocRow
              doc="csa"
              fy={fy}
              group={group}
              title="CSA แบบประเมินการควบคุมด้วยตนเอง"
              detail={missions.length > 0 ? `${missions.length} ภารกิจ ภารกิจละหนึ่งหน้า` : "ยังไม่มีภารกิจ"}
              note={missions.length === 0 ? "เพิ่มภารกิจในหน้าภารกิจและ CSA ไฟล์จะมีแต่หัวเรื่อง" : undefined}
            />
          </ul>
        </section>
      )}
    </div>
  );
}
