import { ClipboardCheck, FileDown, Layers, Plus } from "lucide-react";
import Link from "next/link";

import { GroupNav, YearNav } from "@/components/control/filters";
import { ProjectRow } from "@/components/control/project-row";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, LoadError } from "@/components/ui/state-card";
import { canReview } from "@/lib/control/access";
import { GROUPS } from "@/lib/control/forms";
import { controlHref, resolveGroup, resolveYear, type Query } from "@/lib/control/params";
import { fiscalYear, needsPk5 } from "@/lib/control/risk";
import { listProjects } from "@/lib/data/control";
import { getSession, guardExecutive } from "@/lib/data/session";
import { bangkokYmd } from "@/lib/time";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "โครงการและความเสี่ยง | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

const toolLink =
  "inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

/** Internal control: the fiscal year's projects by group, with their risk scores. */
export default async function ControlPage({ searchParams }: { searchParams: Promise<Query> }) {
  await guardExecutive();
  const currentFy = fiscalYear(bangkokYmd(new Date()));
  const q = await searchParams;
  // A bad ?fy= or ?group= means the default, never an error page with a retry that cannot help.
  const fy = resolveYear(q.fy, currentFy);
  const group = resolveGroup(q.group);
  const groupLabel = GROUPS.find((g) => g.key === group)?.label;

  const session = await getSession();
  const officer = canReview(session?.viewer.role);
  const here = controlHref("/control", { fy, group }, currentFy);
  const addHref = controlHref("/control/projects/new", { fy, group }, currentFy);

  const { projects, failed } = await listProjects(fy);
  const shown = group ? projects.filter((p) => p.groupKey === group) : projects;
  const high = shown.filter((p) => needsPk5(p.score)).length;
  const unscored = shown.filter((p) => p.score === null).length;
  const sections = GROUPS.map((g) => ({ ...g, items: shown.filter((p) => p.groupKey === g.key) })).filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-medium tracking-tight">โครงการและความเสี่ยง</h1>
        <Link href={addHref} className={cn(buttonVariants(), "h-11 gap-1.5 px-4")}>
          <Plus className="size-4" aria-hidden />
          เพิ่มโครงการ
        </Link>
      </div>
      {!session && <p className="text-sm text-muted-foreground">โหมดสาธิต: ยังไม่ได้เชื่อมต่อฐานข้อมูล จึงยังไม่มีโครงการให้แสดง</p>}

      <YearNav path="/control" fy={fy} group={group} currentFy={currentFy} />
      <GroupNav path="/control" fy={fy} group={group} currentFy={currentFy} />

      {officer && (
        <div className="flex flex-wrap gap-2">
          <Link href={controlHref("/control/missions", { fy, group }, currentFy)} className={toolLink}>
            <Layers className="size-4" aria-hidden />
            ภารกิจและ CSA
          </Link>
          <Link href={controlHref("/control/export", { fy, group }, currentFy)} className={toolLink}>
            <FileDown className="size-4" aria-hidden />
            ส่งออกเอกสาร
          </Link>
          <Link href={controlHref("/control/assess", { fy, group }, currentFy)} className={toolLink}>
            <ClipboardCheck className="size-4" aria-hidden />
            ประเมิน ปค.4
          </Link>
        </div>
      )}

      {failed ? (
        <LoadError what="รายการโครงการ" retryHref={here} />
      ) : shown.length === 0 ? (
        <EmptyState
          title={group ? `ยังไม่มีโครงการของ${groupLabel}` : officer ? `ยังไม่มีโครงการในปีงบประมาณ ${fy}` : `คุณยังไม่มีโครงการในปีงบประมาณ ${fy}`}
          hint={officer ? "เพิ่มโครงการ หรือให้เจ้าของโครงการเพิ่มเอง" : "เพิ่มโครงการของคุณ แล้วให้คะแนนความเสี่ยงของโครงการนั้น"}
        >
          <Link href={addHref} className={cn(buttonVariants(), "mt-2 h-11 gap-1.5 px-4")}>
            <Plus className="size-4" aria-hidden />
            เพิ่มโครงการ
          </Link>
          {group && (
            <Link
              href={controlHref("/control", { fy }, currentFy)}
              className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              ดูทุกกลุ่มงาน
            </Link>
          )}
        </EmptyState>
      ) : (
        <>
          <p className="text-base tabular-nums">
            ปี {fy}
            {groupLabel && ` ${groupLabel}`} มี {shown.length} โครงการ · คะแนน 9 ขึ้นไป {high} · ยังไม่ให้คะแนน {unscored}
          </p>
          {sections.map((g) => (
            <section key={g.key} aria-labelledby={`g-${g.key}`} className="space-y-2">
              <h2 id={`g-${g.key}`} className="text-sm font-medium text-muted-foreground">
                {g.label}
                <span className="ml-2 font-normal tabular-nums">{g.items.length} โครงการ</span>
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {g.items.map((p) => (
                  <ProjectRow key={p.id} project={p} showOwner={officer} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
