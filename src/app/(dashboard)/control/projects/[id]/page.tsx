import { ArrowLeft, ChevronDown, Lock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionsList } from "@/components/control/actions-list";
import { ConfirmedPill, RiskPill } from "@/components/control/project-row";
import { ProjectForm, ScoreForm } from "@/components/control/project-form";
import { ReviewForm, type MissionOption } from "@/components/control/review-form";
import { LoadError } from "@/components/ui/state-card";
import { canEditProject, canReview } from "@/lib/control/access";
import { CSA_STEPS, GROUPS } from "@/lib/control/forms";
import { controlHref } from "@/lib/control/params";
import { fiscalYear } from "@/lib/control/risk";
import type { ControlMission, ControlProject } from "@/lib/control/types";
import { getMission, getProject, listMissions } from "@/lib/data/control";
import { getSession, guardExecutive } from "@/lib/data/session";
import { bangkokYmd, formatDayLong } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "โครงการและความเสี่ยง | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

const section = "space-y-3 border-t border-border pt-6";
const heading = "text-sm font-medium text-muted-foreground";

/** The mission's field that holds each of the five CSA steps. */
const CSA_FIELD = { 1: "objective", 2: "procedures", 3: "practice", 4: "assessment", 5: "improvement" } as const satisfies Record<
  number,
  keyof ControlMission
>;

/** Why the fields are closed, in words. */
function lockReason(project: ControlProject, userId: string, measuresOpen: boolean): string {
  if (project.confirmed && userId === project.ownerId)
    return `หัวหน้ายืนยันโครงการนี้แล้ว จึงแก้ข้อมูลและคะแนนไม่ได้${measuresOpen ? " (ยังอัปเดตมาตรการปรับปรุงได้)" : ""} ถ้าต้องแก้ ขอให้เจ้าหน้าที่ยกเลิกการยืนยันก่อน`;
  return "คุณดูโครงการนี้ได้อย่างเดียว เฉพาะเจ้าของโครงการหรือเจ้าหน้าที่เท่านั้นที่แก้ไขได้";
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await guardExecutive();
  const { id } = await params;
  const currentFy = fiscalYear(bangkokYmd(new Date()));
  const [session, found] = await Promise.all([getSession(), getProject(id)]);
  const retryHref = `/control/projects/${encodeURIComponent(id)}`;
  const back = (href: string) => (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden />
      โครงการและความเสี่ยง
    </Link>
  );

  if (found.failed) {
    return (
      <div className="mx-auto max-w-[640px] space-y-6">
        {back("/control")}
        <LoadError what="โครงการ" retryHref={retryHref} />
      </div>
    );
  }
  const { project } = found;
  // Not found and not yours look the same on purpose (Row Level Security hides other people's projects).
  if (!project || !session) notFound();

  const viewer = { userId: session.userId, role: session.viewer.role };
  const officer = canReview(viewer.role);
  const editable = canEditProject({ ownerId: project.ownerId, confirmed: project.confirmed }, viewer);
  // The owner keeps the measures up to date after the head has confirmed (the server agrees).
  const measuresEditable = canEditProject({ ownerId: project.ownerId, confirmed: false }, viewer);

  const [missionList, linked] = await Promise.all([
    officer ? listMissions(project.fiscalYear) : null,
    project.missionId ? getMission(project.missionId) : null,
  ]);
  const mission = linked?.mission ?? null;

  // The picker offers the missions of this project's year and group. The mission it is linked to now
  // is always an option too, flagged when it is from elsewhere, so saving never unlinks it by accident.
  const options: MissionOption[] = (missionList?.missions ?? [])
    .filter((m) => m.groupKey === project.groupKey)
    .map((m) => ({ id: m.id, name: m.name }));
  if (mission && !options.some((o) => o.id === mission.id)) options.push({ id: mission.id, name: mission.name, note: "(คนละปีหรือกลุ่มงาน)" });

  const groupLabel = GROUPS.find((g) => g.key === project.groupKey)?.label ?? project.groupKey;
  const headTouched = project.headLikelihood !== null || project.headImpact !== null;
  const headParts = [
    project.headLikelihood !== null && `โอกาสเกิดเป็น ${project.headLikelihood}`,
    project.headImpact !== null && `ผลกระทบเป็น ${project.headImpact}`,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-[640px] space-y-6">
      {back(controlHref("/control", { fy: project.fiscalYear }, currentFy))}

      <header className="space-y-2">
        <h1 className="font-display text-2xl font-medium tracking-tight break-words sm:text-3xl">{project.name}</h1>
        <p className="text-sm text-muted-foreground">
          ปีงบประมาณ {project.fiscalYear} · {groupLabel} · เจ้าของ {project.ownerName}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <RiskPill score={project.score} />
          {project.confirmed && <ConfirmedPill />}
        </div>
      </header>

      {!editable && (
        <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/50 p-3 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          {lockReason(project, viewer.userId, measuresEditable)}
        </p>
      )}

      <section aria-labelledby="info-title" className={section}>
        <h2 id="info-title" className={heading}>
          ข้อมูลโครงการ
        </h2>
        <ProjectForm officer={officer} project={project} editable={editable} />
      </section>

      <section aria-labelledby="score-title" className={section}>
        <h2 id="score-title" className={heading}>
          คะแนนความเสี่ยง
        </h2>
        {headTouched && (
          <p className="text-sm text-muted-foreground">
            หัวหน้าปรับ{headParts.join(" และ")}
            {project.score !== null && ` คะแนนที่ใช้ในเอกสารจึงเป็น ${project.score}`}
          </p>
        )}
        <ScoreForm projectId={project.id} likelihood={project.likelihood} impact={project.impact} editable={editable} />
      </section>

      <section aria-labelledby="actions-title" className={section}>
        <h2 id="actions-title" className={heading}>
          มาตรการปรับปรุง
          <span className="ml-2 font-normal tabular-nums">{project.actions.length} รายการ</span>
        </h2>
        <ActionsList projectId={project.id} actions={project.actions} editable={measuresEditable} />
      </section>

      {linked?.failed ? (
        <section aria-labelledby="csa-title" className={section}>
          <h2 id="csa-title" className={heading}>
            ภารกิจที่เกี่ยวข้อง
          </h2>
          <LoadError what="ภารกิจ" retryHref={retryHref} />
        </section>
      ) : (
        mission && (
          <section aria-labelledby="csa-title" className={section}>
            <h2 id="csa-title" className={heading}>
              ภารกิจที่เกี่ยวข้อง (CSA ใช้อ้างอิง)
            </h2>
            <details className="group rounded-xl border border-border">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1 font-medium break-words">{mission.name || "(ไม่มีชื่อ)"}</span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <dl className="space-y-4 border-t border-border px-4 py-4">
                {CSA_STEPS.map((s) => (
                  <div key={s.n}>
                    <dt className="text-sm font-medium text-muted-foreground">
                      {s.n}. {s.label}
                    </dt>
                    <dd className="mt-1 break-words whitespace-pre-line">{mission[CSA_FIELD[s.n]] || "ยังไม่ได้กรอก"}</dd>
                  </div>
                ))}
              </dl>
            </details>
            {officer && (
              <Link
                href={`/control/missions/${mission.id}`}
                className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                เปิดภารกิจนี้เพื่อแก้ CSA
              </Link>
            )}
          </section>
        )
      )}

      {officer && (
        <section aria-labelledby="review-title" className={section}>
          <h2 id="review-title" className={heading}>
            สำหรับหัวหน้า
          </h2>
          {project.confirmedAt && (
            <p className="text-sm text-muted-foreground">
              ยืนยันเมื่อ {formatDayLong(bangkokYmd(new Date(project.confirmedAt)))}
            </p>
          )}
          <ReviewForm
            projectId={project.id}
            ownerLevels={{ likelihood: project.likelihood, impact: project.impact }}
            headLevels={{ likelihood: project.headLikelihood, impact: project.headImpact }}
            missionId={project.missionId}
            missions={options}
            missionsFailed={missionList?.failed}
            confirmed={project.confirmed}
            retryHref={retryHref}
          />
        </section>
      )}
    </div>
  );
}
