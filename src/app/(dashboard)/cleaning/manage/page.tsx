import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  AddClassroomForm,
  ClassroomForm,
} from "@/components/cleaning/classroom-form";
import { PEOPLE_LIST } from "@/components/cleaning/advisor-panel";
import { ImportForm } from "@/components/cleaning/import-form";
import { CheckWindowForm } from "@/components/cleaning/check-window-form";
import { chip } from "@/components/cleaning/officer-overview";
import { OffDaysForm } from "@/components/cleaning/off-days-form";
import { RolloverForm } from "@/components/cleaning/rollover-form";
import { groupRoomsByLevel } from "@/lib/advisors";
import { MANAGE_TABS, parseLevel, parseManageTab, type ManageTab } from "@/lib/cleaning-manage";
import { EmptyState, LoadError } from "@/components/ui/state-card";
import type { CheckWindow } from "@/lib/cleaning";
import { getCheckWindow } from "@/lib/data/cleaning-window";
import { getCleaningSetup } from "@/lib/data/cleaning-setup";
import { getSession, guardExecutive } from "@/lib/data/session";
import { bangkokYmd } from "@/lib/time";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ตั้งค่าห้องและเขต | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

type Query = { term?: string | string[]; tab?: string | string[]; level?: string | string[] };

const href = (q: { term: string | null; tab: ManageTab; level?: string }) => {
  const p = new URLSearchParams();
  if (q.term) p.set("term", q.term);
  if (q.tab !== "rooms") p.set("tab", q.tab);
  if (q.level) p.set("level", q.level);
  const s = p.toString();
  return s ? `/cleaning/manage?${s}` : "/cleaning/manage";
};

/** Facility officers: classrooms, advisors and zones per term, spreadsheet import, rollover, check window, off days. */
export default async function CleaningManagePage({ searchParams }: { searchParams: Promise<Query> }) {
  await guardExecutive();
  const setup = await getCleaningSetup();
  if (!setup) redirect("/cleaning");
  const q = await searchParams;
  // The check window is the administrator's to set: officers never get the form.
  const admin = (await getSession())?.viewer.role === "super_admin";
  const window = admin ? await getCheckWindow() : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-1">
        <Link
          href="/cleaning"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          เขตทำความสะอาด
        </Link>
        <h1 className="font-display text-3xl font-medium tracking-tight">ตั้งค่าห้องและเขต</h1>
      </div>
      {"failed" in setup ? (
        <LoadError what="ข้อมูลห้องเรียน" retryHref="/cleaning/manage" />
      ) : (
        <Setup
          {...setup}
          window={window}
          termParam={typeof q.term === "string" ? q.term : undefined}
          tab={parseManageTab(q.tab)}
          levelParam={q.level}
        />
      )}
    </div>
  );
}

function Setup({
  terms,
  rooms,
  buildings,
  offDays,
  liveTerm,
  people,
  window,
  termParam,
  tab,
  levelParam,
}: Exclude<Awaited<ReturnType<typeof getCleaningSetup>>, null | { failed: true }> & {
  termParam?: string;
  window: CheckWindow | null;
  tab: ManageTab;
  levelParam?: string | string[];
}) {
  // Default: the latest term, the one the confirm pages use.
  const term = terms.find((t) => t === termParam) ?? terms[0] ?? null;
  const inTerm = rooms.filter((r) => r.term === term);
  const groups = groupRoomsByLevel(inTerm);
  const level = parseLevel(levelParam, groups.map((g) => g.level));
  const shown = level ? (groups.find((g) => g.level === level)?.rooms ?? []) : inTerm;
  const heading = "text-sm font-medium text-muted-foreground";
  // Rollover has nothing to copy without a term.
  const tabs = MANAGE_TABS.filter((t) => t.key !== "rollover" || terms.length > 0);

  return (
    <div className="grid gap-6 md:grid-cols-[13rem_1fr] md:items-start">
      <nav aria-label="หมวดการตั้งค่า" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:sticky md:top-4 md:mx-0 md:flex-col md:gap-1 md:overflow-visible md:px-0 md:pb-0">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={href({ term, tab: t.key })}
            aria-current={t.key === tab ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              t.key === tab ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="min-w-0 space-y-6">
        {tab === "rooms" && (
          <section aria-labelledby="rooms-title" className="space-y-3">
            <h2 id="rooms-title" className={heading}>
              ห้องเรียน{term && ` ภาคเรียน ${term}`}
              {term && <span className="ml-2 text-sm font-normal text-muted-foreground">{inTerm.length} ห้อง</span>}
            </h2>
            {terms.length > 1 && (
              <nav aria-label="เลือกภาคเรียน" className="flex flex-wrap gap-2">
                {terms.map((t) => (
                  <Link key={t} href={href({ term: t, tab })} aria-current={t === term ? "page" : undefined} className={chip(t === term)}>
                    {t}
                    {t === terms[0] && " (ปัจจุบัน)"}
                  </Link>
                ))}
              </nav>
            )}
            {groups.length > 1 && (
              <nav aria-label="เลือกระดับชั้น" className="flex flex-wrap gap-2">
                <Link href={href({ term, tab })} aria-current={level === "" ? "page" : undefined} className={chip(level === "")}>
                  ทั้งหมด
                </Link>
                {groups.map((g) => (
                  <Link key={g.level} href={href({ term, tab, level: g.level })} aria-current={level === g.level ? "page" : undefined} className={chip(level === g.level)}>
                    {g.level} <span className="tabular-nums opacity-70">{g.rooms.length}</span>
                  </Link>
                ))}
              </nav>
            )}
            {term ? (
              <div className="divide-y divide-border rounded-xl border border-border">
                {shown.map((r) => (
                  <ClassroomForm key={r.id} room={r} buildings={buildings} editAdvisors={r.isActive && r.term === liveTerm} />
                ))}
              </div>
            ) : (
              <EmptyState title="ยังไม่มีห้องเรียน" hint="ไปที่แท็บ “เพิ่มและนำเข้า” เพื่อนำเข้าจากไฟล์ Excel หรือเพิ่มทีละห้อง" />
            )}
            <datalist id={PEOPLE_LIST}>
              {people.map((p) => (
                <option key={p.email} value={p.email} label={p.name} />
              ))}
            </datalist>
          </section>
        )}

        {tab === "add" && (
          <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
            <section aria-label="เพิ่มห้องเรียน" className="space-y-3">
              <datalist id={PEOPLE_LIST}>
                {people.map((p) => (
                  <option key={p.email} value={p.email} label={p.name} />
                ))}
              </datalist>
              <AddClassroomForm key={term} term={term} buildings={buildings} />
            </section>
            <section aria-labelledby="import-title" className="space-y-3">
              <h2 id="import-title" className={heading}>
                นำเข้าจาก Excel
              </h2>
              <ImportForm key={term} term={term} />
            </section>
          </div>
        )}

        {tab === "rollover" && terms.length > 0 && (
          <section aria-labelledby="rollover-title" className="max-w-xl space-y-3">
            <h2 id="rollover-title" className={heading}>
              ขึ้นภาคเรียนใหม่
            </h2>
            <RolloverForm terms={terms} />
          </section>
        )}

        {tab === "dates" && (
          <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
            {window && (
              <section aria-labelledby="window-title" className="space-y-3">
                <h2 id="window-title" className={heading}>
                  ช่วงวันที่เช็ก
                </h2>
                <CheckWindowForm window={window} today={bangkokYmd(new Date())} />
              </section>
            )}
            <section aria-labelledby="off-title" className="space-y-3">
              <h2 id="off-title" className={heading}>
                วันหยุดและวันปิดเรียน
              </h2>
              <OffDaysForm offDays={offDays} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
