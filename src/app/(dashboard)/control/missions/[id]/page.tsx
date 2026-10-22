import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DeleteMission, MissionForm } from "@/components/control/mission-form";
import { ProjectRow } from "@/components/control/project-row";
import { LoadError } from "@/components/ui/state-card";
import { canReview } from "@/lib/control/access";
import { GROUPS } from "@/lib/control/forms";
import { controlHref } from "@/lib/control/params";
import { fiscalYear } from "@/lib/control/risk";
import { getMission, listProjects } from "@/lib/data/control";
import { getSession, guardExecutive } from "@/lib/data/session";
import { bangkokYmd } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ภารกิจและ CSA | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

const section = "space-y-3 border-t border-border pt-6";
const heading = "text-sm font-medium text-muted-foreground";

/** One mission: its name and five CSA steps, the projects linked to it, and removing it. Officers only. */
export default async function MissionPage({ params }: { params: Promise<{ id: string }> }) {
  await guardExecutive();
  const { id } = await params;
  const session = await getSession();
  if (session && !canReview(session.viewer.role)) redirect("/control");

  const currentFy = fiscalYear(bangkokYmd(new Date()));
  const found = await getMission(id);
  const retryHref = `/control/missions/${encodeURIComponent(id)}`;
  const back = (href: string) => (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden />
      ภารกิจและ CSA
    </Link>
  );

  if (found.failed) {
    return (
      <div className="mx-auto max-w-[640px] space-y-6">
        {back("/control/missions")}
        <LoadError what="ภารกิจ" retryHref={retryHref} />
      </div>
    );
  }
  const { mission } = found;
  // No session is demo mode (no database), where there is no mission either.
  if (!mission) notFound();

  // The projects of the mission's year that point at it. Linking is done on the project's page.
  const projectList = await listProjects(mission.fiscalYear);
  const linked = projectList.failed ? null : projectList.projects.filter((p) => p.missionId === mission.id);
  const groupLabel = GROUPS.find((g) => g.key === mission.groupKey)?.label ?? mission.groupKey;

  return (
    <div className="mx-auto max-w-[640px] space-y-6">
      {back(controlHref("/control/missions", { fy: mission.fiscalYear }, currentFy))}

      <header className="space-y-2">
        <h1 className="font-display text-2xl font-medium tracking-tight break-words sm:text-3xl">{mission.name || "(ไม่มีชื่อ)"}</h1>
        <p className="text-sm text-muted-foreground">
          ปีงบประมาณ {mission.fiscalYear} · {groupLabel}
        </p>
      </header>

      <section aria-labelledby="csa-title" className={section}>
        <h2 id="csa-title" className={heading}>
          ชื่อภารกิจและ CSA 5 ขั้นตอน
        </h2>
        <p className="text-sm text-muted-foreground">กรอกเท่าที่พร้อมได้ ขั้นตอนที่เว้นว่างไว้จะกรอกทีหลังก็ได้ บันทึกครั้งเดียวทั้งหมด</p>
        <MissionForm mission={mission} />
      </section>

      <section aria-labelledby="projects-title" className={section}>
        <h2 id="projects-title" className={heading}>
          โครงการที่ผูกกับภารกิจนี้
          {linked && <span className="ml-2 font-normal tabular-nums">{linked.length} โครงการ</span>}
        </h2>
        {linked === null ? (
          <LoadError what="โครงการที่ผูก" retryHref={retryHref} />
        ) : linked.length > 0 ? (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {linked.map((p) => (
              <ProjectRow key={p.id} project={p} showOwner />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            ยังไม่มีโครงการผูกกับภารกิจนี้ เลือกภารกิจนี้ได้ที่หน้าโครงการ ในส่วน &ldquo;สำหรับหัวหน้า&rdquo;
          </p>
        )}
      </section>

      <section aria-labelledby="delete-title" className={section}>
        <h2 id="delete-title" className={heading}>
          ลบภารกิจ
        </h2>
        <DeleteMission missionId={mission.id} name={mission.name} linked={linked ? linked.length : null} />
      </section>
    </div>
  );
}
