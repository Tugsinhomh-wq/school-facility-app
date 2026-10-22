import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { ProjectForm } from "@/components/control/project-form";
import { canReview } from "@/lib/control/access";
import { controlHref, resolveGroup, resolveYear, type Query } from "@/lib/control/params";
import { fiscalYear } from "@/lib/control/risk";
import { getSession, guardExecutive } from "@/lib/data/session";
import { bangkokYmd } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "เพิ่มโครงการ | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

/** A new project; ?fy= and ?group= (from the overview's filters) fill the first two fields. */
export default async function NewProjectPage({ searchParams }: { searchParams: Promise<Query> }) {
  await guardExecutive();
  const currentFy = fiscalYear(bangkokYmd(new Date()));
  const q = await searchParams;
  const fy = resolveYear(q.fy, currentFy);
  const group = resolveGroup(q.group);
  const session = await getSession();

  return (
    <div className="mx-auto max-w-[640px] space-y-6">
      <Link
        href={controlHref("/control", { fy, group }, currentFy)}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        โครงการและความเสี่ยง
      </Link>
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-medium tracking-tight">เพิ่มโครงการ</h1>
        <p className="text-sm text-muted-foreground">บันทึกโครงการก่อน แล้วให้คะแนนความเสี่ยงและเพิ่มมาตรการในหน้าถัดไป</p>
      </div>
      <ProjectForm officer={canReview(session?.viewer.role)} start={{ fiscalYear: fy, groupKey: group }} />
    </div>
  );
}
