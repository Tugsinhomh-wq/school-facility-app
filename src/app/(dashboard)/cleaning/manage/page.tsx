import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AddClassroomForm, ClassroomForm } from "@/components/cleaning/classroom-form";
import { ImportForm } from "@/components/cleaning/import-form";
import { chip } from "@/components/cleaning/officer-overview";
import { OffDaysForm } from "@/components/cleaning/off-days-form";
import { RolloverForm } from "@/components/cleaning/rollover-form";
import { EmptyState, LoadError } from "@/components/ui/state-card";
import { getCleaningSetup } from "@/lib/data/cleaning-setup";
import { guardExecutive } from "@/lib/data/session";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ตั้งค่าห้องและเขต | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

/** Facility officers: classrooms, advisors and zones per term, spreadsheet import, rollover, off days. */
export default async function CleaningManagePage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string | string[] }>;
}) {
  await guardExecutive();
  const setup = await getCleaningSetup();
  if (!setup) redirect("/cleaning");
  const { term: termParam } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/cleaning"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        เขตทำความสะอาด
      </Link>
      <h1 className="font-display text-3xl font-bold tracking-tight">ตั้งค่าห้องและเขต</h1>
      {"failed" in setup ? (
        <LoadError what="ข้อมูลห้องเรียน" retryHref="/cleaning/manage" />
      ) : (
        <Setup {...setup} termParam={typeof termParam === "string" ? termParam : undefined} />
      )}
    </div>
  );
}

function Setup({
  terms,
  rooms,
  buildings,
  offDays,
  termParam,
}: Exclude<Awaited<ReturnType<typeof getCleaningSetup>>, null | { failed: true }> & { termParam?: string }) {
  // Default: the latest term, the one the confirm pages use.
  const term = terms.find((t) => t === termParam) ?? terms[0] ?? null;
  const shown = rooms.filter((r) => r.term === term);
  const heading = "text-lg font-semibold";

  return (
    <div className="space-y-8">
      <section aria-labelledby="rooms-title" className="space-y-3">
        <h2 id="rooms-title" className={heading}>
          ห้องเรียน{term && ` ภาคเรียน ${term}`}
          {term && <span className="ml-2 text-sm font-normal text-muted-foreground">{shown.length} ห้อง</span>}
        </h2>
        {terms.length > 1 && (
          <nav aria-label="เลือกภาคเรียน" className="flex flex-wrap gap-2">
            {terms.map((t) => (
              <Link
                key={t}
                href={`/cleaning/manage?term=${encodeURIComponent(t)}`}
                aria-current={t === term ? "page" : undefined}
                className={chip(t === term)}
              >
                {t}
                {t === terms[0] && " (ปัจจุบัน)"}
              </Link>
            ))}
          </nav>
        )}
        {term ? (
          <div className="space-y-2">
            {shown.map((r) => (
              <ClassroomForm key={r.id} room={r} buildings={buildings} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="ยังไม่มีห้องเรียน"
            hint="นำเข้าจากไฟล์ Excel ด้านล่าง หรือเพิ่มทีละห้อง"
          />
        )}
        <AddClassroomForm key={term} term={term} buildings={buildings} />
      </section>

      <section aria-labelledby="import-title" className="space-y-3">
        <h2 id="import-title" className={heading}>นำเข้าจาก Excel</h2>
        <ImportForm key={term} term={term} />
      </section>

      {terms.length > 0 && (
        <section aria-labelledby="rollover-title" className="space-y-3">
          <h2 id="rollover-title" className={heading}>ขึ้นภาคเรียนใหม่</h2>
          <RolloverForm terms={terms} />
        </section>
      )}

      <section aria-labelledby="off-title" className="space-y-3">
        <h2 id="off-title" className={heading}>วันหยุดและวันปิดเรียน</h2>
        <OffDaysForm offDays={offDays} />
      </section>
    </div>
  );
}
