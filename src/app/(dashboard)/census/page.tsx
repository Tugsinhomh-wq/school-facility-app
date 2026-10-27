import { ChevronRight, FileDown, Upload } from "lucide-react";
import Link from "next/link";

import { chip } from "@/components/cleaning/officer-overview";
import { DeleteTermRoster } from "@/components/census/delete-term";
import { PrivacyNotice } from "@/components/census/kit";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, LoadError } from "@/components/ui/state-card";
import { censusHref, resolveTerm } from "@/lib/census-view";
import { listCensusRooms, listCensusTerms } from "@/lib/data/census";
import { getSession, guardExecutive, isFacilityOfficer } from "@/lib/data/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "สำมะโนผู้เรียน | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

const toolLink =
  "inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

/** The student roster by room for a term: officers see every room, a homeroom advisor only theirs (the loader and RLS decide). */
export default async function CensusPage({ searchParams }: { searchParams: Promise<{ term?: string | string[] }> }) {
  await guardExecutive();
  const session = await getSession();
  const officer = isFacilityOfficer(session?.viewer.role);
  const { term: termParam } = await searchParams;

  // A bad ?term= means the newest term, never an error page with a retry that cannot help.
  const found = await listCensusTerms();
  const term = resolveTerm(termParam, found.terms);
  const loaded = term ? await listCensusRooms(term) : { rooms: [], failed: undefined };
  const failed = found.failed || loaded.failed;
  const { rooms } = loaded;
  const here = censusHref("/census", term);
  const students = rooms.reduce((sum, r) => sum + r.students, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-medium tracking-tight">สำมะโนผู้เรียน</h1>
        <PrivacyNotice />
      </div>
      {!session && <p className="text-sm text-muted-foreground">โหมดสาธิต: ยังไม่ได้เชื่อมต่อฐานข้อมูล ข้อมูลที่เห็นเป็นตัวอย่าง</p>}

      {failed ? (
        <LoadError what="รายชื่อนักเรียน" retryHref={here} />
      ) : (
        <>
          {found.terms.length > 1 && (
            <nav aria-label="เลือกภาคเรียน" className="flex flex-wrap gap-2">
              {found.terms.map((t) => (
                <Link key={t} href={censusHref("/census", t)} aria-current={t === term ? "page" : undefined} className={chip(t === term)}>
                  {t}
                  {t === found.terms[0] && " (ปัจจุบัน)"}
                </Link>
              ))}
            </nav>
          )}

          {officer && (
            <div className="flex flex-wrap gap-2">
              {term && (
                <Link href={censusHref("/census/import", term)} className={cn(buttonVariants(), "h-11 gap-1.5 px-4")}>
                  <Upload aria-hidden />
                  นำเข้ารายชื่อ
                </Link>
              )}
              {/* A plain link to the route: its Content-Disposition makes the browser save the file. No `download` attribute, or an error answer (403) would be saved as a broken file. A route handler is not a page, so <Link> does not apply. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/census/template" className={toolLink}>
                <FileDown className="size-4" aria-hidden />
                ดาวน์โหลดแม่แบบ
              </a>
            </div>
          )}

          {term && rooms.length > 0 ? (
            <section aria-labelledby="rooms-title" className="space-y-2">
              <h2 id="rooms-title" className="text-sm font-medium text-muted-foreground">
                ห้องเรียน ภาคเรียน {term}
                <span className="ml-2 font-normal tabular-nums">
                  {rooms.length} ห้อง · {students} คน
                </span>
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {rooms.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={censusHref(`/census/${r.id}`, term)}
                      className="flex min-h-16 items-center gap-4 px-4 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-5"
                    >
                      <span className="min-w-0 flex-1 leading-snug">
                        <span className="block font-semibold break-words">{r.name}</span>
                        <span className="mt-0.5 block text-sm break-words text-muted-foreground">{r.zone || "ยังไม่กำหนดเขต"}</span>
                      </span>
                      <span className="shrink-0 text-sm tabular-nums">{r.students} คน</span>
                      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : officer ? (
            <EmptyState title="ยังไม่มีห้องเรียนในภาคเรียนนี้" hint="เพิ่มห้องเรียนของภาคเรียนก่อน แล้วจึงนำเข้ารายชื่อได้">
              <Link href="/cleaning/manage" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
                ไปตั้งค่าห้องและเขต
              </Link>
            </EmptyState>
          ) : (
            <EmptyState title="ยังไม่มีรายชื่อนักเรียนของห้องที่คุณเป็นครูที่ปรึกษา" />
          )}

          {officer && term && (
            <section aria-labelledby="delete-title" className="space-y-3 border-t border-border pt-6">
              <h2 id="delete-title" className="text-sm font-medium text-muted-foreground">
                เมื่อจบภาคเรียน
              </h2>
              <DeleteTermRoster key={term} term={term} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
