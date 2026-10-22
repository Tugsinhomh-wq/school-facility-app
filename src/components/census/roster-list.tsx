"use client";

import Link from "next/link";
import { useState } from "react";

import { deleteStudent, type CensusResult } from "@/app/(dashboard)/census/actions";
import { Result } from "@/components/census/kit";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/state-card";
import type { CensusStudent } from "@/lib/data/census";
import { censusHref } from "@/lib/census-view";

/**
 * A room's students by code. Officers get a "ลบ" per row, behind a second click that names the code
 * (not the name). The answer lives here, not in the row, because the row is gone once the page refreshes.
 */
export function RosterList({ students, officer, term }: { students: CensusStudent[]; officer: boolean; term: string }) {
  const [armed, setArmed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CensusResult>(null);

  async function remove(id: string) {
    setBusy(true);
    try {
      setResult(await deleteStudent(id));
    } catch {
      setResult({ ok: false, message: "ลบไม่สำเร็จ ลองใหม่อีกครั้ง" });
    }
    setArmed(null);
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <Result state={result} />
      {students.length === 0 ? (
        <EmptyState
          title="ยังไม่มีรายชื่อนักเรียนในห้องนี้"
          hint={officer ? "นำเข้ารายชื่อจากไฟล์ Excel" : "ให้เจ้าหน้าที่งานอาคารสถานที่นำเข้ารายชื่อ"}
        >
          {officer && (
            <Link
              href={censusHref("/census/import", term)}
              className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              ไปหน้านำเข้ารายชื่อ
            </Link>
          )}
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-28" />
              <col />
              {officer && <col className="w-16" />}
            </colgroup>
            <thead>
              <tr className="bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                <th scope="col" className="px-4 py-2 font-medium">
                  เลขประจำตัว
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  ชื่อ-สกุล
                </th>
                {officer && (
                  <th scope="col" className="sr-only">
                    จัดการ
                  </th>
                )}
              </tr>
            </thead>
            {students.map((s) => (
              <tbody key={s.id} className="border-t border-border">
                <tr>
                  <td className="px-4 py-3 align-middle font-medium tabular-nums">{s.code}</td>
                  <td className="py-3 pr-4 align-middle break-words">{s.name}</td>
                  {officer && (
                    <td className="pr-1 text-right align-middle">
                      <button
                        type="button"
                        onClick={() => setArmed(armed === s.id ? null : s.id)}
                        aria-expanded={armed === s.id}
                        aria-label={`ลบเลขประจำตัว ${s.code}`}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2 text-sm font-medium text-destructive outline-none hover:bg-destructive/10 focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        ลบ
                      </button>
                    </td>
                  )}
                </tr>
                {officer && armed === s.id && (
                  <tr>
                    <td colSpan={3} className="space-y-2 px-4 pb-3">
                      <p className="text-sm">ลบเลขประจำตัว {s.code} ออกจากทะเบียน ลบแล้วเอากลับคืนไม่ได้</p>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="destructive" disabled={busy} onClick={() => remove(s.id)} className="h-11 px-4">
                          {busy ? "กำลังลบ..." : `ยืนยันลบ ${s.code}`}
                        </Button>
                        <Button type="button" variant="outline" disabled={busy} onClick={() => setArmed(null)} className="h-11 px-4">
                          ยกเลิก
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </div>
  );
}
