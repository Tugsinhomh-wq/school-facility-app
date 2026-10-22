import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ImportForm } from "@/components/census/import-form";
import { EmptyState, LoadError } from "@/components/ui/state-card";
import { censusHref, resolveTerm } from "@/lib/census-view";
import { listCensusTerms } from "@/lib/data/census";
import { getSession, guardExecutive, isFacilityOfficer } from "@/lib/data/session";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "นำเข้ารายชื่อนักเรียน | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

/** Facility officers: upload the roster spreadsheet of a term. No session at all is demo mode (form shown, submit off). */
export default async function CensusImportPage({ searchParams }: { searchParams: Promise<{ term?: string | string[] }> }) {
  await guardExecutive();
  const session = await getSession();
  if (session && !isFacilityOfficer(session.viewer.role)) redirect("/census");
  const { term: termParam } = await searchParams;

  const { terms, failed } = await listCensusTerms();
  const term = resolveTerm(termParam, terms);

  return (
    <div className="mx-auto max-w-[640px] space-y-6">
      <Link
        href={censusHref("/census", term)}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        สำมะโนผู้เรียน
      </Link>
      <h1 className="font-display text-3xl font-medium tracking-tight">นำเข้ารายชื่อนักเรียน</h1>

      {failed ? (
        <LoadError what="ภาคเรียน" retryHref={censusHref("/census/import", term)} />
      ) : !term ? (
        <EmptyState title="ยังไม่มีภาคเรียน" hint="เพิ่มห้องเรียนของภาคเรียนก่อน แล้วจึงนำเข้ารายชื่อได้">
          <Link href="/cleaning/manage" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
            ไปตั้งค่าห้องและเขต
          </Link>
        </EmptyState>
      ) : (
        <>
          <ol className="list-decimal space-y-2 pl-5 text-sm marker:text-muted-foreground">
            <li>
              {session ? (
                // A plain link to the route: its Content-Disposition makes the browser save the file. No `download` attribute, or an error answer (403) would be saved as a broken file. A route handler is not a page, so <Link> does not apply.
                // eslint-disable-next-line @next/next/no-html-link-for-pages
                <a
                  href="/census/template"
                  className="inline-flex min-h-11 items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
                >
                  <Download className="size-4" aria-hidden />
                  ดาวน์โหลดแม่แบบ (.xlsx)
                </a>
              ) : (
                "ดาวน์โหลดแม่แบบ (.xlsx)"
              )}
            </li>
            <li>กรอกห้อง เลขประจำตัว 5 หลัก และชื่อ-สกุล หนึ่งแถวต่อนักเรียน ชื่อห้องต้องตรงกับห้องของภาคเรียนที่เลือก</li>
            <li>ตั้งคอลัมน์เลขประจำตัวเป็นข้อความ (Text) เพื่อไม่ให้เลข 0 นำหน้าหาย</li>
            <li>เลือกภาคเรียน แล้วอัปโหลดไฟล์ที่กรอกแล้ว</li>
          </ol>
          <p className="text-sm text-muted-foreground">
            นำเข้าซ้ำได้ ระบบรวมกับรายชื่อเดิม: ถ้าเลขประจำตัวมีอยู่แล้วในภาคเรียนนั้น นักเรียนจะย้ายไปห้องตามไฟล์และแก้ชื่อตามไฟล์
            นักเรียนที่ไม่อยู่ในไฟล์ยังอยู่เหมือนเดิม ไม่ถูกลบ ถ้าแถวใดผิด จะไม่บันทึกข้อมูลใดเลย
          </p>
          <ImportForm terms={terms} term={term} demo={!session} />
        </>
      )}
    </div>
  );
}
