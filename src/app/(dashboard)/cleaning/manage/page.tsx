import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  AddClassroomForm,
  RoomEditor,
} from "@/components/cleaning/classroom-form";
import { PEOPLE_LIST } from "@/components/cleaning/advisor-panel";
import { ImportForm } from "@/components/cleaning/import-form";
import { CheckWindowForm } from "@/components/cleaning/check-window-form";
import { chip } from "@/components/cleaning/officer-overview";
import { OffDaysForm } from "@/components/cleaning/off-days-form";
import { RolloverForm } from "@/components/cleaning/rollover-form";
import { groupRoomsByLevel } from "@/lib/advisors";
import { filterRooms, MANAGE_TABS, parseGap, parseLevel, parseManageTab, roomGaps, type GapFilter, type ManageTab } from "@/lib/cleaning-manage";
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

type Query = { term?: string | string[]; tab?: string | string[]; level?: string | string[]; q?: string | string[]; missing?: string | string[]; room?: string | string[] };

type Link = { term: string | null; tab: ManageTab; level?: string; q?: string; missing?: GapFilter; room?: string };

const href = (l: Link) => {
  const p = new URLSearchParams();
  if (l.term) p.set("term", l.term);
  if (l.tab !== "rooms") p.set("tab", l.tab);
  if (l.level) p.set("level", l.level);
  if (l.q) p.set("q", l.q);
  if (l.missing) p.set("missing", l.missing);
  if (l.room) p.set("room", l.room);
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
          qParam={typeof q.q === "string" ? q.q.slice(0, 40) : ""}
          gap={parseGap(q.missing)}
          roomParam={typeof q.room === "string" ? q.room : undefined}
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
  qParam,
  gap,
  roomParam,
}: Exclude<Awaited<ReturnType<typeof getCleaningSetup>>, null | { failed: true }> & {
  termParam?: string;
  window: CheckWindow | null;
  tab: ManageTab;
  levelParam?: string | string[];
  qParam: string;
  gap: GapFilter;
  roomParam?: string;
}) {
  // Default: the latest term, the one the confirm pages use.
  const term = terms.find((t) => t === termParam) ?? terms[0] ?? null;
  const inTerm = rooms.filter((r) => r.term === term);
  const groups = groupRoomsByLevel(inTerm);
  const level = parseLevel(levelParam, groups.map((g) => g.level));
  const byLevel = level ? (groups.find((g) => g.level === level)?.rooms ?? []) : inTerm;
  const shown = filterRooms(byLevel, qParam, gap);
  const gaps = roomGaps(inTerm);
  const selected = inTerm.find((r) => r.id === roomParam) ?? null;
  const keep = { term, tab, level, q: qParam, missing: gap } as const;
  const heading = "text-sm font-medium text-muted-foreground";
  // Rollover has nothing to copy without a term.
  const tabs = MANAGE_TABS.filter((t) => t.key !== "rollover" || terms.length > 0);

  return (
    <div className="space-y-5">
      <nav aria-label="หมวดการตั้งค่า" className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={href({ term, tab: t.key })}
            aria-current={t.key === tab ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center px-4 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              t.key === tab ? "font-semibold text-primary shadow-[inset_0_-3px_0_var(--primary)]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="min-w-0 space-y-6">
        {tab === "rooms" && (
          <section aria-labelledby="rooms-title" className="space-y-4">
            <h2 id="rooms-title" className="sr-only">ห้องเรียน</h2>
            <dl className="grid grid-cols-3 gap-3">
              {(
                [
                  ["ห้องที่ใช้งาน", gaps.total, null],
                  ["ยังไม่กำหนดเขต", gaps.noZone, "zone"],
                  ["ยังไม่มีครูที่ปรึกษา", gaps.noAdvisor, "advisor"],
                ] as [string, number, "zone" | "advisor" | null][]
              ).map(([label, n, g]) => (
                <div key={label} className="rounded-xl border border-border px-4 py-3">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="text-2xl font-semibold tabular-nums">
                    {g ? (
                      <Link href={href({ ...keep, missing: gap === g ? "" : g })} className="hover:underline">
                        {n}
                      </Link>
                    ) : (
                      n
                    )}
                  </dd>
                </div>
              ))}
            </dl>
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
            <div className="flex flex-wrap items-center gap-2">
              <form action="/cleaning/manage" className="flex min-w-48 flex-1 gap-2">
                {term && <input type="hidden" name="term" value={term} />}
                {level && <input type="hidden" name="level" value={level} />}
                {gap && <input type="hidden" name="missing" value={gap} />}
                <input
                  name="q"
                  defaultValue={qParam}
                  placeholder="ค้นหาห้อง เช่น ม.3/2"
                  aria-label="ค้นหาห้อง"
                  className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
                />
                <button type="submit" className="h-11 rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">
                  ค้นหา
                </button>
              </form>
              {groups.length > 1 && (
                <nav aria-label="เลือกระดับชั้น" className="flex flex-wrap gap-2">
                  <Link href={href({ ...keep, level: "" })} aria-current={level === "" ? "page" : undefined} className={chip(level === "")}>
                    ทั้งหมด
                  </Link>
                  {groups.map((g) => (
                    <Link key={g.level} href={href({ ...keep, level: g.level })} aria-current={level === g.level ? "page" : undefined} className={chip(level === g.level)}>
                      {g.level}<span className="ml-1.5 tabular-nums opacity-70">{g.rooms.length}</span>
                    </Link>
                  ))}
                </nav>
              )}
            </div>
            {gap && (
              <p className="text-sm text-muted-foreground">
                แสดงเฉพาะห้องที่{gap === "zone" ? "ยังไม่กำหนดเขต" : "ยังไม่มีครูที่ปรึกษา"} ·{" "}
                <Link href={href({ ...keep, missing: "" })} className="text-primary underline">
                  ล้างตัวกรอง
                </Link>
              </p>
            )}
            {term ? (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
                <div className="min-w-0 overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">ห้องเรียนภาคเรียน {term}</caption>
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-4 py-2.5 font-medium">ห้อง</th>
                                                <th scope="col" className="px-4 py-2.5 font-medium">เขต</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">ครูที่ปรึกษา</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {shown.map((r) => (
                        <tr key={r.id} className={cn(r.id === selected?.id && "bg-primary/10", !r.isActive && "opacity-60")}>
                          <td className="p-0">
                            <Link
                              href={href({ ...keep, room: r.id })}
                              aria-current={r.id === selected?.id ? "true" : undefined}
                              className="flex min-h-12 items-center px-4 font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                              {r.name}
                              {!r.isActive && <span className="ml-2 text-xs font-normal text-muted-foreground">(ปิดใช้งาน)</span>}
                              {buildings.find((b) => b.id === r.buildingId) && (
                                <span className="ml-2 text-xs font-normal text-muted-foreground">{buildings.find((b) => b.id === r.buildingId)?.name}</span>
                              )}
                            </Link>
                          </td>
                          <td className="px-4 py-2">{r.zone || <span className="text-muted-foreground">ยังไม่กำหนด</span>}</td>
                          <td className="px-4 py-2">
                            {r.advisors.length > 0 ? r.advisors.map((a) => a.name).join(", ") : <span className="text-muted-foreground">ยังไม่มี</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {shown.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">ไม่พบห้องที่ตรงกับตัวกรอง</p>}
                  <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                    แสดง {shown.length} จาก {inTerm.length} ห้อง · กดชื่อห้องเพื่อแก้ไข
                  </p>
                </div>
                <aside aria-label="แก้ไขห้อง" className="rounded-xl border border-border p-3 lg:sticky lg:top-4">
                  {selected ? (
                    <>
                      <h3 className="px-2 pt-1 pb-2 text-lg font-semibold">แก้ไข {selected.name}</h3>
                      <RoomEditor key={selected.id} room={selected} buildings={buildings} editAdvisors={selected.isActive && selected.term === liveTerm} />
                    </>
                  ) : (
                    <p className="p-3 text-sm text-muted-foreground">กดชื่อห้องในตารางเพื่อแก้ไขอาคาร เขต และครูที่ปรึกษา</p>
                  )}
                </aside>
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
