"use client";

import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { LoadError } from "@/components/ui/state-card";
import type { SummaryData } from "@/lib/data/summary";
import { MONTHS_SHORT } from "@/lib/summary-period";
import { formatInstantHm } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface PeriodInfo {
  kind: "month" | "term";
  key: string;
  label: string;
  prevKey: string;
  nextKey: string;
  hasNext: boolean;
  bucket: "day" | "month";
}

const REFRESH_MS = 20_000;
const URGENCY: Record<string, string> = {
  low: "ไม่เร่งด่วน",
  medium: "ปานกลาง",
  high: "เร่งด่วน",
  emergency: "ฉุกเฉิน",
};
const nf = new Intl.NumberFormat("en-US");
const num = (n: number | null | undefined, digits = 0) =>
  n == null ? "–" : nf.format(Number(n.toFixed(digits)));

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-border pt-6">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Delta({ now, prev }: { now: number; prev: number }) {
  if (now === prev) return <>เท่ากับช่วงก่อนหน้า</>;
  return (
    <>
      {now > prev ? "เพิ่ม" : "ลด"} {Math.abs(now - prev)} จากช่วงก่อนหน้า
    </>
  );
}

const focusRing = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/** A figure with its label above and a note below: the small cards of the page. */
function Stat({ label, value, sub }: { label: string; value: string; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-display text-3xl leading-tight font-semibold tabular-nums">{value}</dd>
      {sub && <dd className="mt-1 text-sm text-muted-foreground">{sub}</dd>}
    </div>
  );
}

/** Detail that stays out of the way until opened. */
function Disclosure({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-border bg-card">
      <summary className={cn("flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-xl px-4 [&::-webkit-details-marker]:hidden", focusRing)}>
        <span className="font-medium">{title}</span>
        {hint && <span className="hidden text-sm text-muted-foreground sm:inline">{hint}</span>}
        <ChevronDown className="ml-auto size-5 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-6 border-t border-border px-4 py-5">{children}</div>
    </details>
  );
}

/** Horizontal bars, one per row, scaled to the largest value. */
function HBars({
  rows,
  unit,
  empty,
}: {
  rows: { label: string; value: number; extra?: string }[];
  unit: string;
  empty: string;
}) {
  if (!rows.length)
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {num(r.value, 1)} {unit}
              {r.extra && <span className="ml-1.5 text-xs">({r.extra})</span>}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max((r.value / max) * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Vertical bars over time: a main series with an optional darker overlay (e.g. completed of all reported). */
function Columns({
  items,
  label,
  overlayLabel,
}: {
  items: { key: string; label: string; value: number; overlay?: number }[];
  label: string;
  overlayLabel?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const dense = items.length > 12;
  return (
    <div>
      <div
        className="flex h-36 items-end gap-[3px]"
        role="img"
        aria-label={`กราฟแท่ง ${label}`}
      >
        {items.map((i) => (
          <div
            key={i.key}
            className="relative flex h-full min-w-0 flex-1 items-end"
            title={`${i.label}: ${i.value}${overlayLabel && i.overlay != null ? ` · ${overlayLabel} ${i.overlay}` : ""}`}
          >
            <div
              className="w-full rounded-t bg-primary/25"
              style={{
                height: `${i.value ? Math.max((i.value / max) * 100, 4) : 0}%`,
              }}
            >
              {i.overlay ? (
                <div
                  className="absolute inset-x-0 bottom-0 rounded-t bg-primary"
                  style={{ height: `${Math.max((i.overlay / max) * 100, 4)}%` }}
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[3px] text-xs text-muted-foreground">
        {items.map((i, idx) => (
          <span key={i.key} className="min-w-0 flex-1 text-center tabular-nums">
            {dense && idx % 5 !== 0 ? "" : i.label}
          </span>
        ))}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary/25" aria-hidden />
          {label}
        </span>
        {overlayLabel && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary" aria-hidden />
            {overlayLabel}
          </span>
        )}
      </p>
    </div>
  );
}

const bucketLabel = (bucket: string, kind: "day" | "month") => {
  const [, m, d] = bucket.split("-").map(Number);
  return kind === "day" ? String(d) : MONTHS_SHORT[m - 1];
};

export function SummaryView({
  initial,
  period,
}: {
  initial: SummaryData | null;
  period: PeriodInfo;
}) {
  const [data, setData] = useState<SummaryData | null>(initial);
  const [stale, setStale] = useState(false);
  const seq = useRef(0);

  // Live refresh: poll while the tab is visible; the period in the URL decides what is asked.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      const id = ++seq.current;
      try {
        const res = await fetch(
          `/summary/data?p=${period.kind}&k=${period.key}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as SummaryData;
        if (alive && id === seq.current) {
          setData(json);
          setStale(false);
        }
      } catch {
        if (alive) setStale(true);
      }
    };
    const timer = setInterval(load, REFRESH_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [period.kind, period.key]);

  const href = (kind: string, key?: string) =>
    `/summary?p=${kind}${key ? `&k=${key}` : ""}`;

  const ticketsOpen = data
    ? data.today.open_pending + data.today.open_in_progress
    : 0;

  const pend = data?.today.open_pending ?? 0;
  const prog = data?.today.open_in_progress ?? 0;
  const emergency = data?.today.open_emergency ?? 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">สรุปภาพรวม</h1>
          <p className="mt-1 text-muted-foreground">งานแจ้งซ่อมและการใช้ห้องประชุม แสดงเฉพาะตัวเลขรวม</p>
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          <span className={cn("size-2 rounded-full", stale ? "bg-amber-500" : "bg-emerald-600")} aria-hidden />
          {stale ? "เชื่อมต่อไม่ได้ กำลังลองใหม่" : data ? `อัปเดตสด ล่าสุด ${formatInstantHm(data.generated_at)} น.` : ""}
        </p>
      </header>

      {!data ? (
        <LoadError what="ข้อมูลสรุป" retryHref={href(period.kind, period.key)} />
      ) : (
        <>
          {/* Now: the open repairs and any emergency */}
          <section aria-labelledby="h-now" className="space-y-4">
            <h2 id="h-now" className="sr-only">
              ตอนนี้
            </h2>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
                <p className="text-sm text-muted-foreground">งานซ่อมค้าง</p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="font-display text-7xl leading-none font-semibold tabular-nums">{num(ticketsOpen)}</span>
                  <span className="text-lg text-muted-foreground">งาน</span>
                </p>
                <div
                  className="mt-5 flex h-2 overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={`รอรับเรื่อง ${pend} กำลังซ่อม ${prog}`}
                >
                  <span className="bg-primary/35" style={{ width: `${ticketsOpen ? (pend / ticketsOpen) * 100 : 0}%` }} />
                  <span className="bg-primary" style={{ width: `${ticketsOpen ? (prog / ticketsOpen) * 100 : 0}%` }} />
                </div>
                <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-primary/35" aria-hidden />
                    รอรับเรื่อง {num(pend)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-primary" aria-hidden />
                    กำลังซ่อม {num(prog)}
                  </span>
                </p>
              </div>

              <div
                role="status"
                className={cn(
                  "flex flex-col justify-center rounded-xl border p-5 sm:p-6",
                  emergency > 0 ? "border-destructive/30 bg-destructive/10" : "border-border bg-card",
                )}
              >
                {emergency > 0 ? (
                  <>
                    <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                      <AlertTriangle className="size-5" aria-hidden />
                      งานฉุกเฉินค้าง
                    </p>
                    <p className="mt-1 flex items-baseline gap-2 text-destructive">
                      <span className="font-display text-6xl leading-none font-semibold tabular-nums">{num(emergency)}</span>
                      <span className="text-lg">งาน</span>
                    </p>
                    <p className="mt-3 text-sm">ควรติดตามเป็นพิเศษ ดูในรายการงานค้างนานที่สุดด้านล่าง</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">งานฉุกเฉิน</p>
                    <p className="mt-1 font-display text-2xl font-semibold">ไม่มีงานค้าง</p>
                  </>
                )}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="วันนี้ แจ้งใหม่" value={num(data.today.new_today)} />
              <Stat label="วันนี้ ปิดงาน" value={num(data.today.done_today)} />
              <Stat label="ห้องประชุมใช้อยู่" value={`${data.today.rooms_busy_now}/${data.today.rooms_total}`} sub={`ประชุมวันนี้ ${data.today.meetings_today} รายการ`} />
              <Stat label="คำขอรออนุมัติ" value={num(data.today.reservations_pending)} />
            </dl>
          </section>

          {/* The oldest open jobs: what to chase */}
          <Section title="งานค้างนานที่สุด" hint="5 งานแรกที่ยังไม่เสร็จ">
            {data.today.oldest_open.length ? (
              <ul className="divide-y divide-border rounded-xl border border-border bg-card px-4">
                {data.today.oldest_open.map((o, i) => {
                  const hot = o.urgency === "emergency" || o.urgency === "high";
                  return (
                    <li key={i} className="flex min-h-14 items-center justify-between gap-3 py-2">
                      <span className="min-w-0 truncate">
                        {o.building}
                        {o.place ? ` · ${o.place}` : ""}
                      </span>
                      <span className={cn("inline-flex shrink-0 items-center gap-1.5 tabular-nums", hot ? "font-medium text-destructive" : "text-muted-foreground")}>
                        {hot && <AlertTriangle className="size-4" aria-hidden />}
                        {URGENCY[o.urgency]} · {o.age_days} วัน
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">ไม่มีงานค้าง</p>
            )}
          </Section>

          {/* Trend of one period */}
          <section aria-labelledby="h-trend" className="space-y-4 border-t border-border pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="h-trend" className="text-sm font-medium text-muted-foreground">
                แนวโน้ม
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <nav aria-label="ช่วงเวลา" className="inline-flex rounded-lg bg-muted p-1 text-sm">
                  {(["month", "term"] as const).map((k) => (
                    <Link
                      key={k}
                      href={href(k)}
                      aria-current={period.kind === k ? "page" : undefined}
                      className={cn("flex min-h-11 items-center rounded-md px-4 font-medium", focusRing, period.kind === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                      {k === "month" ? "รายเดือน" : "รายภาคเรียน"}
                    </Link>
                  ))}
                </nav>
                <div className="inline-flex items-center gap-1">
                  <Link href={href(period.kind, period.prevKey)} aria-label="ช่วงก่อนหน้า" className={cn("flex size-11 items-center justify-center rounded-lg hover:bg-muted", focusRing)}>
                    <ChevronLeft className="size-5" aria-hidden />
                  </Link>
                  <span className="min-w-32 text-center text-sm font-medium">{period.label}</span>
                  {period.hasNext ? (
                    <Link href={href(period.kind, period.nextKey)} aria-label="ช่วงถัดไป" className={cn("flex size-11 items-center justify-center rounded-lg hover:bg-muted", focusRing)}>
                      <ChevronRight className="size-5" aria-hidden />
                    </Link>
                  ) : (
                    <span aria-hidden className="flex size-11 items-center justify-center opacity-30">
                      <ChevronRight className="size-5" />
                    </span>
                  )}
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-3 gap-3">
              <Stat label="งานแจ้งซ่อม" value={num(data.repairs.total)} sub={<Delta now={data.repairs.total} prev={data.repairs.total_prev} />} />
              <Stat
                label="ซ่อมเสร็จ"
                value={num(data.repairs.completed)}
                sub={data.repairs.total ? `${Math.round((data.repairs.completed / data.repairs.total) * 100)}% ของงานทั้งหมด` : undefined}
              />
              <Stat label="ยังค้าง" value={num(data.repairs.open)} />
            </dl>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-3 text-sm text-muted-foreground">งานแจ้งซ่อม{period.bucket === "day" ? "รายวัน" : "รายเดือน"}</p>
              <Columns
                label="แจ้งใหม่"
                overlayLabel="ปิดงานแล้ว"
                items={data.trend.map((t) => ({ key: t.bucket, label: bucketLabel(t.bucket, period.bucket), value: t.tickets, overlay: t.completed }))}
              />
            </div>
          </section>

          {/* The rest, opened on demand */}
          <div className="space-y-3">
            <Disclosure title="สถิติงานซ่อมเพิ่มเติม" hint="เวลาซ่อม อาคารที่แจ้งมาก จุดที่แจ้งซ้ำ">
              <dl className="grid gap-3 sm:grid-cols-2">
                <Stat
                  label="เวลาซ่อมเฉลี่ย"
                  value={data.repairs.avg_hours == null ? "–" : data.repairs.avg_hours >= 48 ? `${num(data.repairs.avg_hours / 24, 1)} วัน` : `${num(data.repairs.avg_hours, 1)} ชม.`}
                  sub="นับจากแจ้งถึงเสร็จ"
                />
                <Stat
                  label="เสร็จตามกำหนด"
                  value={data.repairs.on_time_pct == null ? "–" : `${data.repairs.on_time_pct}%`}
                  sub="ฉุกเฉิน 1 วัน · เร่งด่วน 3 · ปานกลาง 7 · ทั่วไป 14"
                />
              </dl>
              <div>
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">อาคาร/สถานที่ที่แจ้งซ่อมมากที่สุด</h3>
                <HBars
                  rows={data.repairs.by_building.map((b) => ({ label: b.name, value: b.total, extra: b.open ? `ค้าง ${b.open}` : undefined }))}
                  unit="งาน"
                  empty="ไม่มีงานแจ้งซ่อมในช่วงนี้"
                />
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">จุดที่แจ้งซ้ำ</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">ห้องเดียวกันแจ้งตั้งแต่ 2 ครั้งขึ้นไป</p>
                {data.repairs.repeat_spots.length ? (
                  <ul className="mt-2 divide-y divide-border">
                    {data.repairs.repeat_spots.map((s) => (
                      <li key={`${s.building}-${s.place}`} className="flex min-h-11 items-center justify-between gap-3 py-2">
                        <span className="min-w-0 truncate">
                          {s.building} · {s.place}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{s.reports} ครั้ง</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">ไม่มีจุดที่แจ้งซ้ำในช่วงนี้</p>
                )}
              </div>
            </Disclosure>

            <Disclosure title="การใช้ห้องประชุม" hint="จำนวนการจอง ชั่วโมงใช้ห้อง แยกตามห้อง">
              <dl className="grid gap-3 sm:grid-cols-2">
                <Stat label="การจองห้อง" value={num(data.rooms.total)} sub={<Delta now={data.rooms.total} prev={data.rooms.total_prev} />} />
                <Stat label="ชั่วโมงใช้ห้อง" value={num(data.rooms.hours, 1)} sub={`อนุมัติ ${data.rooms.approved} · ปฏิเสธ ${data.rooms.rejected} · รอ ${data.rooms.pending}`} />
              </dl>
              <div>
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">การจองตามช่วงเวลา (เฉพาะที่อนุมัติ)</h3>
                <Columns label="การจอง" items={data.trend.map((t) => ({ key: t.bucket, label: bucketLabel(t.bucket, period.bucket), value: t.reservations }))} />
              </div>
              <div>
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">ชั่วโมงใช้ห้องแยกตามห้อง (เฉพาะที่อนุมัติ)</h3>
                <HBars
                  rows={data.rooms.by_room.map((r) => ({ label: r.name, value: r.hours, extra: `${r.bookings} ครั้ง` }))}
                  unit="ชม."
                  empty="ไม่มีการจองที่อนุมัติในช่วงนี้"
                />
              </div>
            </Disclosure>
          </div>

          <p className="text-xs text-muted-foreground">
            งานซ้ำที่ถูกรวมแล้วนับเป็นงานเดียว เทียบกับช่วงก่อนหน้าที่ยาวเท่ากัน ตัวเลขอัปเดตทุก {REFRESH_MS / 1000} วินาทีขณะเปิดหน้านี้
          </p>
        </>
      )}
    </div>
  );
}
