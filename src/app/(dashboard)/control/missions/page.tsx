import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GroupNav, YearNav } from "@/components/control/filters";
import { NewMissionForm } from "@/components/control/mission-form";
import { EmptyState, LoadError } from "@/components/ui/state-card";
import { canReview } from "@/lib/control/access";
import { CSA_FIELD, CSA_STEPS, GROUPS } from "@/lib/control/forms";
import { controlHref, resolveGroup, resolveYear, type Query } from "@/lib/control/params";
import { fiscalYear } from "@/lib/control/risk";
import type { ControlMission } from "@/lib/control/types";
import { listMissions, listProjects } from "@/lib/data/control";
import { getSession, guardExecutive } from "@/lib/data/session";
import { bangkokYmd } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ภารกิจและ CSA | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

const heading = "text-sm font-medium text-muted-foreground";

const filledSteps = (m: ControlMission) => CSA_STEPS.filter((s) => m[CSA_FIELD[s.n]].trim() !== "").length;

/** One mission in the list: a plain row with a chevron, like the projects. */
function MissionRow({ mission, projects }: { mission: ControlMission; projects: number }) {
  const filled = filledSteps(mission);
  return (
    <li>
      <Link
        href={`/control/missions/${mission.id}`}
        className="flex min-h-16 items-center gap-4 px-4 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-5"
      >
        <span className="min-w-0 flex-1 leading-snug">
          <span className="block font-semibold break-words">{mission.name || "(ไม่มีชื่อ)"}</span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            {projects} โครงการที่ผูก · {filled === CSA_STEPS.length ? "CSA ครบทุกขั้นตอน" : `CSA กรอกแล้ว ${filled} จาก ${CSA_STEPS.length} ขั้นตอน`}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

/** Missions of the fiscal year by group, each with its five-step CSA, and a form to add one. Officers only. */
export default async function MissionsPage({ searchParams }: { searchParams: Promise<Query> }) {
  await guardExecutive();
  const session = await getSession();
  // Missions are the officers' tool. No session at all is demo mode (no database), which has nothing to show.
  if (session && !canReview(session.viewer.role)) redirect("/control");

  const currentFy = fiscalYear(bangkokYmd(new Date()));
  const q = await searchParams;
  // A bad ?fy= or ?group= means the default, never an error page with a retry that cannot help.
  const fy = resolveYear(q.fy, currentFy);
  const group = resolveGroup(q.group);
  const groupLabel = GROUPS.find((g) => g.key === group)?.label;
  const here = controlHref("/control/missions", { fy, group }, currentFy);

  const [missionList, projectList] = await Promise.all([listMissions(fy), listProjects(fy)]);
  const failed = missionList.failed || projectList.failed;
  const linked = new Map<string, number>();
  for (const p of projectList.projects) if (p.missionId) linked.set(p.missionId, (linked.get(p.missionId) ?? 0) + 1);

  const shown = group ? missionList.missions.filter((m) => m.groupKey === group) : missionList.missions;
  const sections = GROUPS.map((g) => ({ ...g, items: shown.filter((m) => m.groupKey === g.key) })).filter((g) => g.items.length > 0);

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
        <h1 className="font-display text-3xl font-medium tracking-tight">ภารกิจและ CSA</h1>
        <p className="text-sm text-muted-foreground">
          แต่ละภารกิจมีแบบประเมินการควบคุมด้วยตนเอง (CSA) 5 ขั้นตอน และผูกกับโครงการได้หลายโครงการ
        </p>
      </div>
      {!session && <p className="text-sm text-muted-foreground">โหมดสาธิต: ยังไม่ได้เชื่อมต่อฐานข้อมูล จึงยังไม่มีภารกิจให้แสดง</p>}

      <YearNav path="/control/missions" fy={fy} group={group} currentFy={currentFy} />
      <GroupNav path="/control/missions" fy={fy} group={group} currentFy={currentFy} />

      {failed ? (
        <LoadError what="รายการภารกิจ" retryHref={here} />
      ) : shown.length === 0 ? (
        <EmptyState
          title={group ? `ยังไม่มีภารกิจของ${groupLabel}` : `ยังไม่มีภารกิจในปีงบประมาณ ${fy}`}
          hint="เพิ่มภารกิจได้ที่ฟอร์มด้านล่าง แล้วกรอก CSA ในหน้าของภารกิจ"
        >
          {group && (
            <Link
              href={controlHref("/control/missions", { fy }, currentFy)}
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
            {groupLabel && ` ${groupLabel}`} มี {shown.length} ภารกิจ
          </p>
          {sections.map((g) => (
            <section key={g.key} aria-labelledby={`g-${g.key}`} className="space-y-2">
              <h2 id={`g-${g.key}`} className={heading}>
                {g.label}
                <span className="ml-2 font-normal tabular-nums">{g.items.length} ภารกิจ</span>
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {g.items.map((m) => (
                  <MissionRow key={m.id} mission={m} projects={linked.get(m.id) ?? 0} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      <section aria-labelledby="new-title" className="max-w-[640px] space-y-3 border-t border-border pt-6">
        <h2 id="new-title" className={heading}>
          เพิ่มภารกิจ
        </h2>
        {/* Keyed so that moving to another year or group chip starts the form again from that choice. */}
        <NewMissionForm key={`${fy}-${group ?? ""}`} fiscalYear={fy} groupKey={group} />
      </section>
    </div>
  );
}
