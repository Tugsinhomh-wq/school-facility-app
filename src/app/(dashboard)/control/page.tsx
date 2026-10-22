import { ChevronLeft, ChevronRight, FileDown, Layers, Plus } from "lucide-react";
import Link from "next/link";

import { chip } from "@/components/cleaning/officer-overview";
import { ProjectRow } from "@/components/control/project-row";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, LoadError } from "@/components/ui/state-card";
import { canReview } from "@/lib/control/access";
import { GROUPS } from "@/lib/control/forms";
import { FISCAL_YEAR_MAX, FISCAL_YEAR_MIN } from "@/lib/control/parse";
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

const stepLink =
  "inline-flex min-h-11 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm tabular-nums outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";
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

      <nav aria-label="เลือกปีงบประมาณ" className="flex flex-wrap items-center gap-2">
        {fy > FISCAL_YEAR_MIN && (
          <Link href={controlHref("/control", { fy: fy - 1, group }, currentFy)} className={stepLink}>
            <ChevronLeft className="size-4" aria-hidden />
            <span className="sr-only">ปีงบประมาณ </span>
            {fy - 1}
          </Link>
        )}
        <span className="px-1 text-lg font-medium tabular-nums">
          ปีงบประมาณ {fy}
          {fy === currentFy && <span className="ml-2 text-sm font-normal text-muted-foreground">ปีปัจจุบัน</span>}
        </span>
        {fy < FISCAL_YEAR_MAX && (
          <Link href={controlHref("/control", { fy: fy + 1, group }, currentFy)} className={stepLink}>
            <span className="sr-only">ปีงบประมาณ </span>
            {fy + 1}
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        )}
        {fy !== currentFy && (
          <Link
            href={controlHref("/control", { fy: currentFy, group }, currentFy)}
            className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            ไปปีปัจจุบัน
          </Link>
        )}
      </nav>

      <nav
        aria-label="กรองกลุ่มงาน"
        className="-mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:w-auto sm:flex-wrap sm:px-0"
      >
        <Link href={controlHref("/control", { fy }, currentFy)} aria-current={!group ? "page" : undefined} className={chip(!group)}>
          ทุกกลุ่มงาน
        </Link>
        {GROUPS.map((g) => (
          <Link
            key={g.key}
            href={controlHref("/control", { fy, group: g.key }, currentFy)}
            aria-current={group === g.key ? "page" : undefined}
            className={chip(group === g.key)}
          >
            {g.label}
          </Link>
        ))}
      </nav>

      {officer && (
        <div className="flex flex-wrap gap-2">
          <Link href="/control/missions" className={toolLink}>
            <Layers className="size-4" aria-hidden />
            ภารกิจและ CSA
          </Link>
          <Link href="/control/export" className={toolLink}>
            <FileDown className="size-4" aria-hidden />
            ส่งออกเอกสาร
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
