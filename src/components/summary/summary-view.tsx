"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

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

function Card({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card/85 p-4 backdrop-blur-sm sm:p-5",
        className,
      )}
    >
      <h2 className="font-display text-base font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  tone?: "alert" | "good";
}) {
  return (
    <div className="rounded-xl border border-border bg-card/85 p-4 backdrop-blur-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-display text-3xl font-bold leading-none tabular-nums",
          tone === "alert" && "text-destructive",
          tone === "good" && "text-emerald-600 dark:text-emerald-400",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Delta({ now, prev }: { now: number; prev: number }) {
  if (now === prev) return <>เท่ากับช่วงก่อนหน้า</>;
  const up = now > prev;
  return (
    <>
      <span aria-hidden>{up ? "▲" : "▼"}</span> {up ? "เพิ่ม" : "ลด"}{" "}
      {Math.abs(now - prev)} จากช่วงก่อนหน้า
    </>
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
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
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
              className="w-full rounded-t bg-primary/35"
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
      <div className="mt-1 flex gap-[3px] text-[10px] text-muted-foreground">
        {items.map((i, idx) => (
          <span key={i.key} className="min-w-0 flex-1 text-center tabular-nums">
            {dense && idx % 5 !== 0 ? "" : i.label}
          </span>
        ))}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary/35" aria-hidden />
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

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            สรุปภาพรวม
          </h1>
          <p className="mt-1 text-muted-foreground">
            งานแจ้งซ่อมและการใช้ห้องประชุม แสดงเฉพาะตัวเลขรวม
          </p>
        </div>
        <p
          className="flex items-center gap-2 text-xs text-muted-foreground"
          aria-live="polite"
        >
          <span
            className={cn(
              "size-2 rounded-full",
              stale ? "bg-amber-500" : "animate-pulse bg-emerald-500",
            )}
            aria-hidden
          />
          {stale
            ? "เชื่อมต่อไม่ได้ กำลังลองใหม่"
            : data
              ? `อัปเดตสด ล่าสุด ${formatInstantHm(data.generated_at)} น.`
              : ""}
        </p>
      </div>

      {!data ? (
        <p
          role="alert"
          className="mt-8 rounded-xl border border-dashed border-border bg-card/60 p-10 text-center text-muted-foreground"
        >
          โหลดข้อมูลสรุปไม่สำเร็จ ลองรีเฟรชหน้านี้ หรือแจ้งผู้ดูแลระบบ
        </p>
      ) : (
        <>
          <h2 className="mt-8 mb-3 font-display text-lg font-semibold">
            ตอนนี้
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Tile
              label="งานซ่อมค้าง"
              value={num(data.today.open_pending + data.today.open_in_progress)}
              sub={`รอรับเรื่อง ${data.today.open_pending} · กำลังซ่อม ${data.today.open_in_progress}`}
            />
            <Tile
              label="ฉุกเฉิน (ยังไม่เสร็จ)"
              value={num(data.today.open_emergency)}
              tone={data.today.open_emergency ? "alert" : "good"}
              sub={
                data.today.open_emergency
                  ? "ควรติดตามเป็นพิเศษ"
                  : "ไม่มีงานฉุกเฉินค้าง"
              }
            />
            <Tile
              label="วันนี้ แจ้งใหม่ / ปิดงาน"
              value={`${data.today.new_today} / ${data.today.done_today}`}
            />
            <Tile
              label="ห้องประชุมใช้งานอยู่"
              value={`${data.today.rooms_busy_now}/${data.today.rooms_total}`}
              sub={`ประชุมวันนี้ ${data.today.meetings_today} รายการ`}
            />
            <Tile
              label="คำขอรออนุมัติ"
              value={num(data.today.reservations_pending)}
            />
          </div>

          <div className="mt-8 mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">แนวโน้ม</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="tablist"
                aria-label="ช่วงเวลา"
                className="inline-flex rounded-lg border border-border bg-card/85 p-0.5 text-sm"
              >
                {(["month", "term"] as const).map((k) => (
                  <Link
                    key={k}
                    href={href(k)}
                    role="tab"
                    aria-selected={period.kind === k}
                    className={cn(
                      "rounded-md px-3 py-1.5 font-medium",
                      period.kind === k
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {k === "month" ? "รายเดือน" : "รายภาคเรียน"}
                  </Link>
                ))}
              </div>
              <div className="inline-flex items-center gap-1">
                <Link
                  href={href(period.kind, period.prevKey)}
                  aria-label="ช่วงก่อนหน้า"
                  className="flex size-9 items-center justify-center rounded-lg border border-border hover:bg-muted"
                >
                  <ChevronLeft className="size-4" aria-hidden />
                </Link>
                <span className="min-w-36 text-center text-sm font-medium">
                  {period.label}
                </span>
                {period.hasNext ? (
                  <Link
                    href={href(period.kind, period.nextKey)}
                    aria-label="ช่วงถัดไป"
                    className="flex size-9 items-center justify-center rounded-lg border border-border hover:bg-muted"
                  >
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                ) : (
                  <span
                    aria-hidden
                    className="flex size-9 items-center justify-center rounded-lg border border-border opacity-30"
                  >
                    <ChevronRight className="size-4" />
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <Tile
              label="งานแจ้งซ่อม"
              value={num(data.repairs.total)}
              sub={
                <Delta
                  now={data.repairs.total}
                  prev={data.repairs.total_prev}
                />
              }
            />
            <Tile
              label="ซ่อมเสร็จ"
              value={num(data.repairs.completed)}
              sub={
                data.repairs.total
                  ? `${Math.round((data.repairs.completed / data.repairs.total) * 100)}% ของงานทั้งหมด`
                  : undefined
              }
            />
            <Tile label="ยังค้าง" value={num(data.repairs.open)} />
            <Tile
              label="เวลาซ่อมเฉลี่ย"
              value={
                data.repairs.avg_hours == null
                  ? "–"
                  : data.repairs.avg_hours >= 48
                    ? `${num(data.repairs.avg_hours / 24, 1)} วัน`
                    : `${num(data.repairs.avg_hours, 1)} ชม.`
              }
              sub="นับจากแจ้งถึงเสร็จ"
            />
            <Tile
              label="เสร็จตามกำหนด"
              value={
                data.repairs.on_time_pct == null
                  ? "–"
                  : `${data.repairs.on_time_pct}%`
              }
              sub="ฉุกเฉิน 1 วัน · เร่งด่วน 3 · ปานกลาง 7 · ทั่วไป 14"
            />
            <Tile
              label="การจองห้อง"
              value={num(data.rooms.total)}
              sub={
                <Delta now={data.rooms.total} prev={data.rooms.total_prev} />
              }
            />
            <Tile
              label="ชั่วโมงใช้ห้อง"
              value={num(data.rooms.hours, 1)}
              sub={`อนุมัติ ${data.rooms.approved} · ปฏิเสธ ${data.rooms.rejected} · รอ ${data.rooms.pending}`}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card
              title="งานแจ้งซ่อมตามช่วงเวลา"
              hint={period.bucket === "day" ? "รายวัน" : "รายเดือน"}
            >
              <Columns
                label="แจ้งใหม่"
                overlayLabel="ปิดงานแล้ว"
                items={data.trend.map((t) => ({
                  key: t.bucket,
                  label: bucketLabel(t.bucket, period.bucket),
                  value: t.tickets,
                  overlay: t.completed,
                }))}
              />
            </Card>
            <Card title="การจองห้องประชุมตามช่วงเวลา" hint="เฉพาะที่อนุมัติ">
              <Columns
                label="การจอง"
                items={data.trend.map((t) => ({
                  key: t.bucket,
                  label: bucketLabel(t.bucket, period.bucket),
                  value: t.reservations,
                }))}
              />
            </Card>
          </div>

          <h2 className="mt-8 mb-3 font-display text-lg font-semibold">
            จุดเสียบ่อยและความเสี่ยง
          </h2>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="อาคาร/สถานที่ที่แจ้งซ่อมมากที่สุด">
              <HBars
                rows={data.repairs.by_building.map((b) => ({
                  label: b.name,
                  value: b.total,
                  extra: b.open ? `ค้าง ${b.open}` : undefined,
                }))}
                unit="งาน"
                empty="ไม่มีงานแจ้งซ่อมในช่วงนี้"
              />
            </Card>
            <Card
              title="จุดที่แจ้งซ้ำ"
              hint="ห้องเดียวกันแจ้งตั้งแต่ 2 ครั้งขึ้นไป"
            >
              {data.repairs.repeat_spots.length ? (
                <ul className="space-y-2 text-sm">
                  {data.repairs.repeat_spots.map((s) => (
                    <li
                      key={`${s.building}-${s.place}`}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="min-w-0 truncate">
                        {s.building} · {s.place}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {s.reports} ครั้ง
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  ไม่มีจุดที่แจ้งซ้ำในช่วงนี้
                </p>
              )}
            </Card>
            <Card title="งานค้างนานที่สุด" hint="5 งานแรกที่ยังไม่เสร็จ">
              {data.today.oldest_open.length ? (
                <ul className="space-y-2 text-sm">
                  {data.today.oldest_open.map((o, i) => (
                    <li
                      key={i}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="min-w-0 truncate">
                        {o.building}
                        {o.place ? ` · ${o.place}` : ""}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 tabular-nums",
                          o.urgency === "emergency" || o.urgency === "high"
                            ? "font-medium text-destructive"
                            : "text-muted-foreground",
                        )}
                      >
                        {URGENCY[o.urgency]} · {o.age_days} วัน
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">ไม่มีงานค้าง</p>
              )}
            </Card>
          </div>

          <h2 className="mt-8 mb-3 font-display text-lg font-semibold">
            การใช้ห้องประชุม
          </h2>
          <Card title="ชั่วโมงใช้งานแยกตามห้อง" hint="เฉพาะการจองที่อนุมัติ">
            <HBars
              rows={data.rooms.by_room.map((r) => ({
                label: r.name,
                value: r.hours,
                extra: `${r.bookings} ครั้ง`,
              }))}
              unit="ชม."
              empty="ไม่มีการจองที่อนุมัติในช่วงนี้"
            />
          </Card>
          <p className="mt-6 text-xs text-muted-foreground">
            งานซ้ำที่ถูกรวมแล้วนับเป็นงานเดียว เทียบกับช่วงก่อนหน้าที่ยาวเท่ากัน
            ตัวเลขอัปเดตทุก {REFRESH_MS / 1000} วินาทีขณะเปิดหน้านี้
          </p>
        </>
      )}
    </>
  );
}
