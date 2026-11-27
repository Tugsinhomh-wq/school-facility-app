"use client";

import { ChevronLeft, ChevronRight, Clock, MousePointerClick, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { MyTrips, VehicleDetailDialog, VehicleForm, VehicleQueue, whenText } from "@/components/vehicle";
import { useLiveRefresh, useNow } from "@/components/meeting/use-meeting-live";
import type { MyTrip } from "@/lib/data/vehicles";
import { weekDays } from "@/lib/meeting-view";
import { addDays, bangkokYmd, formatDateShort, formatDayShort, formatHm, mondayOf } from "@/lib/time";
import { KIND_LABEL, itemsOn, type DayItem, type VehicleBooking, type VehicleInfo } from "@/lib/vehicle";
import { cn } from "@/lib/utils";

const focusRing = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const DEFAULT_START = 7 * 60;
const DEFAULT_END = 16 * 60;

/** "07:00–16:00", "ทั้งวัน", or the open end of a trip that goes on past this day. */
function span({ from, to }: DayItem) {
  if (from === 0 && to >= 1440) return "ทั้งวัน";
  if (from === 0) return `ถึง ${formatHm(to)}`;
  if (to >= 1440) return `ตั้งแต่ ${formatHm(from)}`;
  return `${formatHm(from)}–${formatHm(to)}`;
}

const chipTone = (b: VehicleBooking, mine: boolean) =>
  cn(
    "relative z-10 flex h-7 w-full items-center gap-1 overflow-hidden rounded-md border px-1.5 text-left text-xs leading-none transition-colors",
    focusRing,
    b.status === "pending" ? "border-dashed border-primary/50 bg-card hover:bg-muted" : "border-primary/30 bg-primary/15 text-primary hover:bg-primary/25",
    mine && "ring-2 ring-primary ring-inset",
  );

/**
 * One page for booking a vehicle. The week is a grid of vehicles by days, with every trip drawn on the days it covers.
 * Clicking a day on a vehicle starts a request for it; the form (departure and return, destination, passengers) sits
 * beside the grid, or under the list on a phone. The week lives in the URL; everything else is local.
 */
export function VehicleDesk({
  vehicles,
  bookings,
  pending,
  mine,
  weekStart,
  userId,
  canBook,
  isApprover,
  live,
  sample,
  error,
}: {
  vehicles: VehicleInfo[];
  bookings: VehicleBooking[];
  pending: VehicleBooking[];
  mine: MyTrip[];
  weekStart: string;
  userId: string | null;
  canBook: boolean;
  isApprover: boolean;
  live: boolean;
  sample: boolean;
  error?: string;
}) {
  useLiveRefresh(live, "vehicle_reservations");
  const now = useNow();
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const today = now ? bangkokYmd(now) : weekStart;
  const thisWeek = mondayOf(today);
  const href = (week: string) => `/vehicles?week=${week}`;

  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [startYmd, setStartYmd] = useState(today);
  const [startMin, setStartMin] = useState(DEFAULT_START);
  const [endYmd, setEndYmd] = useState(today);
  const [endMin, setEndMin] = useState(DEFAULT_END);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const chosen = vehicles.find((v) => v.id === vehicleId);
  const detail = bookings.find((b) => b.id === detailId) ?? pending.find((b) => b.id === detailId) ?? null;
  const isPast = (ymd: string) => now !== null && ymd < today;

  function pick(id: string, ymd: string) {
    if (!canBook || isPast(ymd)) return;
    setVehicleId(id);
    setStartYmd(ymd);
    setEndYmd(ymd);
  }
  function change(next: { startYmd?: string; startMin?: number; endYmd?: string; endMin?: number }) {
    if (next.startMin !== undefined) setStartMin(next.startMin);
    if (next.endMin !== undefined) setEndMin(next.endMin);
    if (next.endYmd !== undefined) setEndYmd(next.endYmd);
    if (next.startYmd !== undefined) {
      setStartYmd(next.startYmd);
      // A return before the new departure moves along with it.
      if (endYmd < next.startYmd) setEndYmd(next.startYmd);
    }
  }
  const reset = () => {
    setVehicleId(null);
    setStartYmd(today);
    setEndYmd(today);
    setStartMin(DEFAULT_START);
    setEndMin(DEFAULT_END);
    setFormKey((n) => n + 1);
  };
  const inRange = (id: string, ymd: string) => canBook && vehicleId === id && ymd >= startYmd && ymd <= endYmd;

  // On a phone the form opens under the list: bring it into view when a vehicle is chosen.
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!vehicleId || !window.matchMedia("(max-width: 1279px)").matches) return;
    panel.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [vehicleId]);

  const weekRange = `${formatDateShort(days[0]).replace(/ \d{4}$/, "")} – ${formatDateShort(days[6]).replace(/ \d{4}$/, "")}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-sm text-muted-foreground">
            ตารางรถโรงเรียน
            {sample && <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs">ข้อมูลตัวอย่าง</span>}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">ขอใช้รถ</h1>
        </div>
        <nav aria-label="สัปดาห์" className="flex items-center text-sm">
          <Link href={href(addDays(weekStart, -7))} aria-label="สัปดาห์ก่อนหน้า" className={cn("grid size-11 place-items-center rounded-md hover:bg-muted", focusRing)}>
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <Link href={href(thisWeek)} className={cn("inline-flex min-h-11 items-center px-1 whitespace-nowrap tabular-nums text-muted-foreground hover:underline", focusRing)}>
            {weekRange}
          </Link>
          <Link href={href(addDays(weekStart, 7))} aria-label="สัปดาห์ถัดไป" className={cn("grid size-11 place-items-center rounded-md hover:bg-muted", focusRing)}>
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        </nav>
      </header>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {isApprover && <VehicleQueue pending={pending} vehicles={vehicles} onOpen={setDetailId} />}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-6">
          {!canBook && <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">บัญชีนี้ดูตารางรถและอนุมัติคำขอได้ ไม่ใช้จองรถ</p>}

          {/* Wide screens: vehicles by days */}
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-card lg:block">
            <div className="min-w-[44rem]">
              <div className="grid grid-cols-[11rem_repeat(7,minmax(0,1fr))] border-b border-border">
                <div />
                {days.map((ymd) => {
                  const [dow, date] = formatDayShort(ymd).split(" ");
                  return (
                    <div key={ymd} className={cn("border-l border-border px-2 py-2 text-sm", ymd === today && now ? "font-semibold text-primary" : "text-muted-foreground", isPast(ymd) && "opacity-50")}>
                      {dow} <span className="tabular-nums">{date}</span>
                      {ymd === today && now && <span className="ml-1 text-xs font-normal">วันนี้</span>}
                    </div>
                  );
                })}
              </div>
              {vehicles.map((v) => (
                <div key={v.id} className="grid grid-cols-[11rem_repeat(7,minmax(0,1fr))] border-b border-border last:border-b-0">
                  <div className="flex flex-col justify-center gap-0.5 px-3 py-2">
                    <span className="text-sm font-medium">{v.name}</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {v.requires_approval ? <Clock className="size-3.5" aria-hidden /> : <UserRound className="size-3.5" aria-hidden />}
                      {v.requires_approval ? "รอ ผอ. อนุมัติ" : "จองได้ทันที"}
                      {v.seats ? (
                        <span className="ml-auto inline-flex items-center gap-1 tabular-nums">
                          <Users className="size-3.5" aria-hidden />
                          {v.seats}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">{v.has_driver ? "มีคนขับประจำ" : "ครูขับเอง"}</span>
                  </div>
                  {days.map((ymd) => {
                    const items = itemsOn(bookings, v.id, ymd);
                    const past = isPast(ymd);
                    return (
                      <div key={ymd} className={cn("relative min-h-24 border-l border-border p-1", inRange(v.id, ymd) && "bg-primary/10", past && "bg-muted/50")}>
                        {canBook && !past && (
                          <button
                            type="button"
                            onClick={() => pick(v.id, ymd)}
                            aria-label={`${v.name} ${formatDayShort(ymd)} ${items.length ? "มีการจอง กดเพื่อขอใช้" : "ว่าง กดเพื่อขอใช้"}`}
                            className={cn("absolute inset-0 transition-colors hover:bg-primary/10 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset", focusRing)}
                          />
                        )}
                        <div className="pointer-events-none relative z-10 flex flex-col gap-1">
                          {items.slice(0, 2).map((it) => (
                            <button
                              key={it.booking.id}
                              type="button"
                              onClick={() => setDetailId(it.booking.id)}
                              aria-label={`${it.booking.status === "pending" ? "รออนุมัติ" : "จองแล้ว"}: ${it.booking.destination} ${whenText(it.booking)}`}
                              className={cn(chipTone(it.booking, it.booking.applicant_id === userId), "pointer-events-auto")}
                            >
                              <span className="shrink-0 tabular-nums">{span(it)}</span>
                              <span className="truncate">{it.booking.destination}</span>
                            </button>
                          ))}
                          {items.length > 2 && <span className="px-1 text-xs text-muted-foreground">และอีก {items.length - 2} รายการ</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <ul aria-label="สัญลักษณ์" className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border px-3 py-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <span className="size-3 rounded-sm border border-primary/30 bg-primary/15" aria-hidden />
                จองแล้ว
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-3 rounded-sm border border-dashed border-primary/50 bg-card" aria-hidden />
                รออนุมัติ
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-3 rounded-sm bg-primary/10 ring-1 ring-primary/30" aria-hidden />
                วันที่เลือก
              </li>
              {canBook && (
                <li className="ml-auto flex items-center gap-1.5">
                  <MousePointerClick className="size-3.5" aria-hidden />
                  กดวันที่ในตารางเพื่อขอใช้รถ
                </li>
              )}
            </ul>
          </div>

          {/* Phones: one card per vehicle with its week */}
          <ul className="grid gap-3 lg:hidden">
            {vehicles.map((v) => {
              const trips = days.flatMap((ymd) => itemsOn(bookings, v.id, ymd).map((it) => ({ ymd, it })));
              const seen = new Set<string>();
              const unique = trips.filter(({ it }) => (seen.has(it.booking.id) ? false : (seen.add(it.booking.id), true)));
              return (
                <li key={v.id} className={cn("rounded-xl border bg-card p-3.5", chosen?.id === v.id && canBook ? "border-primary ring-2 ring-primary/20" : "border-border")}>
                  <p className="font-display text-base leading-snug font-semibold">{v.name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                    <span>{KIND_LABEL[v.kind]}</span>
                    {v.seats ? <span className="tabular-nums">{v.seats} ที่นั่ง</span> : null}
                    <span>{v.has_driver ? "มีคนขับประจำ" : "ครูขับเอง"}</span>
                    <span>{v.requires_approval ? "ต้องรอ ผอ. อนุมัติ" : "จองได้ทันที"}</span>
                  </p>
                  <div className="mt-3 grid grid-cols-7 gap-1" role="group" aria-label={`วันของ${v.name}`}>
                    {days.map((ymd) => {
                      const [dow, date] = formatDayShort(ymd).split(" ");
                      const items = itemsOn(bookings, v.id, ymd);
                      const past = isPast(ymd);
                      return (
                        <button
                          key={ymd}
                          type="button"
                          disabled={!canBook || past}
                          onClick={() => pick(v.id, ymd)}
                          aria-pressed={inRange(v.id, ymd)}
                          aria-label={`${formatDayShort(ymd)} ${items.length ? "มีการจอง" : "ว่าง"}`}
                          className={cn(
                            "flex min-h-14 flex-col items-center justify-center rounded-lg border text-center transition-colors disabled:opacity-40",
                            focusRing,
                            inRange(v.id, ymd) ? "border-primary bg-primary text-primary-foreground" : items.length ? "border-primary/30 bg-primary/15 text-primary" : "border-border bg-card hover:bg-muted",
                          )}
                        >
                          <span className="text-xs leading-none">{dow}</span>
                          <span className="mt-1 font-display text-lg leading-none font-semibold tabular-nums">{date}</span>
                        </button>
                      );
                    })}
                  </div>
                  {unique.length > 0 && (
                    <ul className="mt-3 grid gap-1.5 border-t border-border pt-3">
                      {unique.map(({ it }) => (
                        <li key={it.booking.id}>
                          <button type="button" onClick={() => setDetailId(it.booking.id)} className={cn("flex min-h-11 w-full items-center gap-2 rounded text-left text-sm", focusRing)}>
                            <span className={cn("size-2.5 shrink-0 rounded-sm border", it.booking.status === "pending" ? "border-dashed border-primary/60 bg-card" : "border-primary/30 bg-primary/30")} aria-hidden />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{it.booking.destination}</span>
                              <span className="block text-muted-foreground tabular-nums">
                                {whenText(it.booking)}
                                {it.booking.status === "pending" ? " · รออนุมัติ" : ""}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          {canBook && <MyTrips trips={mine} vehicles={vehicles} now={now ? now.getTime() : null} />}
        </div>

        {/* Request */}
        {canBook && (
          <div ref={panel} className="scroll-mt-4 xl:sticky xl:top-6">
            {chosen ? (
              <section aria-labelledby="h-request" className="rounded-xl border border-border bg-card p-4 sm:p-5">
                <h2 id="h-request" className="mb-4 font-display text-lg font-semibold">
                  รายละเอียดการเดินทาง
                </h2>
                <VehicleForm
                  key={formKey}
                  vehicle={chosen}
                  bookings={bookings}
                  today={today}
                  startYmd={startYmd}
                  startMin={startMin}
                  endYmd={endYmd}
                  endMin={endMin}
                  onChange={change}
                  onAgain={reset}
                  onClear={() => setVehicleId(null)}
                />
              </section>
            ) : (
              <div className="hidden rounded-xl border border-dashed border-input p-6 text-center xl:block">
                <p className="font-medium">ยังไม่ได้เลือกรถ</p>
                <p className="mt-1 text-sm text-muted-foreground">กดวันที่ของรถที่ต้องการในตาราง แล้วกรอกรายละเอียดตรงนี้</p>
              </div>
            )}
          </div>
        )}
      </div>

      <VehicleDetailDialog
        booking={detail}
        vehicle={vehicles.find((v) => v.id === detail?.vehicle_id)}
        mine={userId !== null && detail?.applicant_id === userId}
        isApprover={isApprover}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
