import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { chip } from "@/components/cleaning/officer-overview";
import { AssessForm } from "@/components/control/assess-form";
import { YearNav } from "@/components/control/filters";
import { LoadError } from "@/components/ui/state-card";
import { canReview } from "@/lib/control/access";
import { GROUPS } from "@/lib/control/forms";
import { controlHref, resolveGroup, resolveYear, type Query } from "@/lib/control/params";
import { fiscalYear } from "@/lib/control/risk";
import { getAssessment } from "@/lib/data/control";
import { getSession, guardExecutive } from "@/lib/data/session";
import { bangkokYmd } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ประเมิน ปค.4 | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

const heading = "text-sm font-medium text-muted-foreground";

/** The ปค.4 assessment of one group and fiscal year: a result and a typed comment per principle. Officers only. */
export default async function AssessPage({ searchParams }: { searchParams: Promise<Query> }) {
  await guardExecutive();
  const session = await getSession();
  // The assessment is the officers' to write. No session at all is demo mode (no database).
  if (session && !canReview(session.viewer.role)) redirect("/control");

  const currentFy = fiscalYear(bangkokYmd(new Date()));
  const q = await searchParams;
  // A bad ?fy= or ?group= means the default (no group chosen yet), never an error page.
  const fy = resolveYear(q.fy, currentFy);
  const group = resolveGroup(q.group);
  const groupLabel = GROUPS.find((g) => g.key === group)?.label;
  const here = controlHref("/control/assess", { fy, group }, currentFy);

  const result = group ? await getAssessment(fy, group) : null;

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
        <h1 className="font-display text-3xl font-medium tracking-tight">ประเมิน ปค.4</h1>
        <p className="text-sm text-muted-foreground">
          ประเมินองค์ประกอบของการควบคุมภายใน 17 ข้อทีละกลุ่มงาน ผลที่บันทึกจะไปอยู่ในเอกสาร ปค.4 ของกลุ่มนั้น
        </p>
      </div>
      {!session && <p className="text-sm text-muted-foreground">โหมดสาธิต: ยังไม่ได้เชื่อมต่อฐานข้อมูล จึงบันทึกผลไม่ได้</p>}

      <YearNav path="/control/assess" fy={fy} group={group} currentFy={currentFy} />

      <nav aria-label="เลือกกลุ่มงาน" className="space-y-2">
        <h2 className={heading}>กลุ่มงาน</h2>
        <div className="-mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:w-auto sm:flex-wrap sm:px-0">
          {GROUPS.map((g) => (
            <Link
              key={g.key}
              href={controlHref("/control/assess", { fy, group: g.key }, currentFy)}
              aria-current={group === g.key ? "page" : undefined}
              className={chip(group === g.key)}
            >
              {g.label}
            </Link>
          ))}
        </div>
      </nav>

      {!result ? (
        <p className="text-base">เลือกกลุ่มงานก่อน จึงจะประเมินได้</p>
      ) : result.failed ? (
        <LoadError what="ผลการประเมิน" retryHref={here} />
      ) : (
        <section aria-labelledby="assess-title" className="space-y-4">
          <h2 id="assess-title" className={heading}>
            {groupLabel} ปีงบประมาณ {fy}
          </h2>
          {/* Keyed on year + group, so moving to another one starts its own form instead of keeping typed text. */}
          <AssessForm key={`${fy}-${group}`} assessment={result.assessment} demo={!session} />
        </section>
      )}
    </div>
  );
}
