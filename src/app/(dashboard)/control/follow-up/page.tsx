import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { chip } from "@/components/cleaning/officer-overview";
import { FollowUpList } from "@/components/control/follow-up-list";
import { EmptyState, LoadError } from "@/components/ui/state-card";
import { canEditProject, canReview } from "@/lib/control/access";
import { followUpCounts, resolveBucket, SOON_DAYS, type Bucket } from "@/lib/control/follow-up";
import { GROUPS, type GroupKey } from "@/lib/control/forms";
import { resolveGroup, type Query } from "@/lib/control/params";
import { fiscalYear } from "@/lib/control/risk";
import { listFollowUp } from "@/lib/data/control";
import { getSession, guardExecutive } from "@/lib/data/session";
import { bangkokYmd } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ติดตามมาตรการควบคุมภายใน | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: "เกินกำหนด",
  soon: "ใกล้ถึงกำหนด",
  later: "ยังไม่ถึง",
  nodate: "ไม่ได้กำหนดวัน",
  done: "เสร็จแล้ว",
};

/** This page with ?bucket= and ?group=; the default view and "every group" are left out so the URL stays short. */
function href(bucket: Bucket | "all" | undefined, group: GroupKey | undefined) {
  const q = new URLSearchParams();
  if (bucket) q.set("bucket", bucket);
  if (group) q.set("group", group);
  const s = q.toString();
  return s ? `/control/follow-up?${s}` : "/control/follow-up";
}

/** Improvement measures of the current and the previous fiscal year, the late and the near ones first. */
export default async function FollowUpPage({ searchParams }: { searchParams: Promise<Query> }) {
  await guardExecutive();
  const q = await searchParams;
  // A bad ?bucket= or ?group= means the default view, never an error page with a retry that cannot help.
  const asked = resolveBucket(q.bucket);
  const session = await getSession();
  const viewer = session && { userId: session.userId, role: session.viewer.role };
  const officer = canReview(viewer?.role);
  const group = officer ? resolveGroup(q.group) : undefined;
  const groupLabel = GROUPS.find((g) => g.key === group)?.label;
  const fy = fiscalYear(bangkokYmd(new Date()));

  const { items: all, failed } = await listFollowUp();
  const items = group ? all.filter((i) => i.groupKey === group) : all;
  const counts = followUpCounts(items);
  const view = asked ?? (counts.alert > 0 ? "alert" : "all");
  const shown = items.filter((i) => (view === "all" ? true : view === "alert" ? i.bucket === "overdue" || i.bucket === "soon" : i.bucket === view));
  // The owner of a measure keeps it up to date even after the head confirmed the project (the server agrees).
  const rows = shown.map((item) => ({ item, editable: !!viewer && canEditProject({ ownerId: item.ownerId, confirmed: false }, viewer) }));
  const here = href(asked, group);

  const chips: { key: string; label: string; n: number; to: string; on: boolean }[] = [
    ...(counts.alert > 0 ? [{ key: "alert", label: "ต้องติดตาม", n: counts.alert, to: href(undefined, group), on: view === "alert" }] : []),
    { key: "all", label: "ทั้งหมด", n: items.length, to: href("all", group), on: view === "all" },
    ...(Object.keys(BUCKET_LABEL) as Bucket[]).map((b) => ({
      key: b,
      label: BUCKET_LABEL[b],
      n: items.filter((i) => i.bucket === b).length,
      to: href(b, group),
      on: view === b,
    })),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/control" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        โครงการและความเสี่ยง
      </Link>
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-medium tracking-tight">ติดตามมาตรการควบคุมภายใน</h1>
        <p className="text-muted-foreground">
          มาตรการปรับปรุงของโครงการปีงบประมาณ {fy} และ {fy - 1} (ใกล้ถึงกำหนด = ภายใน {SOON_DAYS} วัน)
        </p>
      </div>
      {!session && <p className="text-sm text-muted-foreground">โหมดสาธิต: ยังไม่ได้เชื่อมต่อฐานข้อมูล จึงยังไม่มีมาตรการให้แสดง</p>}

      {failed ? (
        <LoadError what="รายการมาตรการ" retryHref={here} />
      ) : (
        <>
          {officer && (
            <nav aria-label="กรองกลุ่มงาน" className="-mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:w-auto sm:flex-wrap sm:px-0">
              <Link href={href(asked, undefined)} aria-current={!group ? "page" : undefined} className={chip(!group)}>
                ทุกกลุ่มงาน
              </Link>
              {GROUPS.map((g) => (
                <Link key={g.key} href={href(asked, g.key)} aria-current={group === g.key ? "page" : undefined} className={chip(group === g.key)}>
                  {g.label}
                </Link>
              ))}
            </nav>
          )}
          {items.length === 0 ? (
            <EmptyState
              title={group ? `ยังไม่มีมาตรการของ${groupLabel}` : "ยังไม่มีมาตรการปรับปรุง"}
              hint={officer ? "มาตรการเพิ่มได้ในหน้าของแต่ละโครงการ" : "เพิ่มมาตรการได้ในหน้าโครงการของคุณ"}
            >
              <Link
                href={group ? "/control/follow-up" : "/control"}
                className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {group ? "ดูทุกกลุ่มงาน" : "ไปที่โครงการและความเสี่ยง"}
              </Link>
            </EmptyState>
          ) : (
            <>
              <p className="text-base tabular-nums">
                เกินกำหนด {counts.overdue} · ใกล้ถึง {counts.soon}
              </p>
              <nav aria-label="กรองตามกำหนด" className="-mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:w-auto sm:flex-wrap sm:px-0">
                {chips.map((c) => (
                  <Link key={c.key} href={c.to} aria-current={c.on ? "page" : undefined} className={chip(c.on)}>
                    {c.label}
                    <span className="ml-1.5 tabular-nums">{c.n}</span>
                  </Link>
                ))}
              </nav>
              {rows.length === 0 ? (
                <EmptyState title="ไม่มีมาตรการในหมวดนี้" />
              ) : (
                <FollowUpList key={`${view}|${group ?? ""}`} rows={rows} showOwner={officer} />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
