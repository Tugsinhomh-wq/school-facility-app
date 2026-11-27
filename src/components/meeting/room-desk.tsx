"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Clock, MousePointerClick, Users, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { BookingDetailDialog } from "@/components/meeting/booking-detail-dialog";
import { BookingDetails } from "@/components/meeting/booking-details";
import { PendingQueue } from "@/components/meeting/pending-queue";
import { useLiveRefresh, useNow } from "@/components/meeting/use-meeting-live";
import type { Booking, RoomInfo } from "@/lib/data/rooms";
import { DAY_END, DAY_START, latestEnd, STEP } from "@/lib/meeting";
import { clashOf, earliestFit, splitRooms, type Seg } from "@/lib/meeting-finder";
import { segOn, weekDays } from "@/lib/meeting-view";
import { addDays, bangkokMinutes, bangkokYmd, formatDateShort, formatDayLong, formatDayShort, formatHm, mondayOf } from "@/lib/time";
import { cn } from "@/lib/utils";

const LENGTHS = [
  { min: 30, label: "30 นาที" },
  { min: 60, label: "1 ชม." },
  { min: 120, label: "2 ชม." },
  { min: 180, label: "3 ชม." },
  { min: 240, label: "ครึ่งวัน" },
];
/** Teachers rarely start at 07:00, so a future day opens on 08:00. */
const DEFAULT_START = 8 * 60;
const SPAN = DAY_END - DAY_START;
const SLOTS = SPAN / STEP;
const HOUR_MARKS = Array.from({ length: SPAN / 60 }, (_, i) => DAY_START + i * 60);
const pct = (m: number) => ((m - DAY_START) / SPAN) * 100;
const ROW_H = "h-14";

const focusRing = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const selectClass = `h-11 w-full appearance-none rounded-md border border-input bg-card px-3.5 pr-10 text-base tabular-nums disabled:opacity-50 ${focusRing}`;

type Active = { b: Booking; seg: { start: number; end: number } };

/**
 * One page for booking, on a phone and on a desktop. The day, the start and the length sit on top. Below them the
 * rooms are shown against the day: a grid of rooms by half hours on a wide screen (click a free slot to choose room and
 * start in one go), a list of rooms with a small timeline on a phone. The details form sits beside the grid, or under
 * the list, once a room is chosen. The week lives in the URL; everything else is local.
 */
export function RoomDesk({
  rooms,
  bookings,
  weekStart,
  userId,
  isManager,
  live,
  sample,
  canManage,
  error,
}: {
  rooms: RoomInfo[];
  bookings: Booking[];
  weekStart: string;
  /** Kept for the page's shared props: every room is on the page, so the URL's room is not used. */
  roomId?: string;
  userId: string | null;
  isManager: boolean;
  live: boolean;
  sample: boolean;
  canManage: boolean;
  error?: string;
}) {
  useLiveRefresh(live);
  const now = useNow();
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const today = now ? bangkokYmd(now) : null;
  const nowMin = now ? bangkokMinutes(now) : null;
  const thisWeek = today ? mondayOf(today) : weekStart;
  const href = (week: string) => `/meeting-rooms?week=${week}`;

  const [picked, setPicked] = useState<string | null>(null);
  const [userStart, setUserStart] = useState<number | null>(null);
  const [length, setLength] = useState(60);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const isPastDay = (ymd: string) => today !== null && ymd < today;
  const firstOpen = days.find((d) => !isPastDay(d)) ?? null;
  const day = picked && days.includes(picked) && !isPastDay(picked) ? picked : today && days.includes(today) ? today : (firstOpen ?? days[0]);

  // The earliest start on this day: the next half hour when it is today, the start of the day otherwise.
  const earliest = today === day && nowMin !== null ? Math.ceil(nowMin / STEP) * STEP : DAY_START;
  const latestStart = DAY_END - STEP;
  const dayClosed = earliest > latestStart || isPastDay(day);
  const start = Math.min(Math.max(userStart ?? DEFAULT_START, earliest), latestStart);
  // With a room chosen the booking cannot run into the next one, so the longest length is what is left before it.
  const limit = roomId ? Math.max(latestEnd(bookings, roomId, day, start), start + STEP) : DAY_END;
  const len = Math.max(STEP, Math.min(length, limit - start));
  const end = start + len;

  const active = useMemo(() => {
    const out: Active[] = [];
    for (const b of bookings) {
      if (b.status !== "pending" && b.status !== "approved") continue;
      const seg = segOn(b, day);
      if (seg && seg.end > DAY_START && seg.start < DAY_END) out.push({ b, seg });
    }
    return out;
  }, [bookings, day]);
  const segs = useMemo<Seg[]>(() => active.map(({ b, seg }) => ({ id: b.id, roomId: b.room_id, start: seg.start, end: seg.end })), [active]);

  const { free, busy } = useMemo(
    () =>
      splitRooms(
        rooms.map((r) => r.id),
        segs,
        start,
        len,
        DAY_END,
      ),
    [rooms, segs, start, len],
  );
  const roomOf = (id: string) => rooms.find((r) => r.id === id) as RoomInfo;
  const nearest = free.length === 0 ? earliestFit(busy) : null;
  const chosen = roomId ? rooms.find((r) => r.id === roomId) : undefined;
  const detail = bookings.find((b) => b.id === detailId) ?? null;
  const busyOf = (id: string) => busy.find((x) => x.roomId === id);

  function pickDay(ymd: string) {
    setPicked(ymd);
    setUserStart(null);
  }
  function pickSlot(rid: string, minute: number) {
    setRoomId(rid);
    setUserStart(minute);
  }
  const reset = () => {
    setRoomId(null);
    setPicked(null);
    setUserStart(null);
    setLength(60);
    setFormKey((n) => n + 1);
  };

  // On a phone the form opens under the list: bring it into view when a room is chosen.
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!roomId || !window.matchMedia("(max-width: 1279px)").matches) return;
    panel.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [roomId]);

  const nowPct = today === day && nowMin !== null && nowMin >= DAY_START && nowMin <= DAY_END ? pct(nowMin) : null;
  const isPastSlot = (m: number) => today === day && nowMin !== null && m + STEP <= nowMin;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-sm text-muted-foreground">
            {today ? formatDayLong(today) : " "}
            {sample && <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs">ข้อมูลตัวอย่าง</span>}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">ขอใช้ห้องประชุม</h1>
        </div>
        {canManage && (
          <Link href="/meeting-rooms/manage" className={cn("inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline", focusRing)}>
            จัดการห้อง
          </Link>
        )}
      </header>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-5">
          {/* Day */}
          <section aria-labelledby="h-day" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-x-3">
              <h2 id="h-day" className="font-display text-lg font-semibold">
                วัน
              </h2>
              <nav aria-label="สัปดาห์" className="flex items-center text-sm">
                <Link href={href(addDays(weekStart, -7))} aria-label="สัปดาห์ก่อนหน้า" className={cn("grid size-11 place-items-center rounded-md hover:bg-muted", focusRing)}>
                  <ChevronLeft className="size-5" aria-hidden />
                </Link>
                <Link href={href(thisWeek)} className={cn("inline-flex min-h-11 items-center px-1 whitespace-nowrap tabular-nums text-muted-foreground hover:underline", focusRing)}>
                  {formatDateShort(days[0]).replace(/ \d{4}$/, "")} – {formatDateShort(days[6]).replace(/ \d{4}$/, "")}
                </Link>
                <Link href={href(addDays(weekStart, 7))} aria-label="สัปดาห์ถัดไป" className={cn("grid size-11 place-items-center rounded-md hover:bg-muted", focusRing)}>
                  <ChevronRight className="size-5" aria-hidden />
                </Link>
              </nav>
            </div>
            <div role="group" aria-label="เลือกวัน" className="grid grid-cols-7 gap-1.5">
              {days.map((ymd) => {
                const [dow, date] = formatDayShort(ymd).split(" ");
                const on = ymd === day;
                return (
                  <button
                    key={ymd}
                    type="button"
                    aria-pressed={on}
                    disabled={isPastDay(ymd)}
                    onClick={() => pickDay(ymd)}
                    className={cn(
                      "flex min-h-16 flex-col items-center justify-center rounded-lg border py-1.5 transition-colors disabled:opacity-40",
                      focusRing,
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
                    )}
                  >
                    <span className={cn("text-xs leading-none", on ? "text-primary-foreground/80" : "text-muted-foreground")}>{dow}</span>
                    <span className="mt-1 font-display text-xl leading-none font-semibold tabular-nums">{date}</span>
                    <span className={cn("mt-1 min-h-[1em] text-xs leading-none", on ? "text-primary-foreground/80" : "text-primary")}>{ymd === today ? "วันนี้" : ""}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Start and length */}
          <section aria-label="เวลา" className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <div className="grid gap-2">
              <label htmlFor="start-sel" className="text-sm font-medium">
                เริ่มเวลา
              </label>
              <div className="relative">
                <select id="start-sel" value={start} disabled={dayClosed} onChange={(e) => setUserStart(Number(e.target.value))} className={selectClass}>
                  {Array.from({ length: Math.max(0, (latestStart - earliest) / STEP + 1) }, (_, i) => earliest + i * STEP).map((m) => (
                    <option key={m} value={m}>
                      {formatHm(m)} น.
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              </div>
            </div>
            <div className="grid gap-2">
              <span id="len-l" className="text-sm font-medium">
                ใช้นานแค่ไหน
              </span>
              <div role="group" aria-labelledby="len-l" className="flex flex-wrap gap-2">
                {LENGTHS.map((l) => (
                  <button
                    key={l.min}
                    type="button"
                    aria-pressed={length === l.min}
                    disabled={dayClosed || start + l.min > limit}
                    onClick={() => setLength(l.min)}
                    className={cn(
                      "min-h-11 rounded-md border px-3.5 text-sm transition-colors disabled:opacity-40",
                      focusRing,
                      length === l.min ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted",
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Rooms against the day */}
          <section aria-labelledby="h-rooms" className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id="h-rooms" className="font-display text-lg font-semibold">
                ห้องว่าง
              </h2>
              <p role="status" className="text-sm text-muted-foreground tabular-nums">
                {dayClosed
                  ? isPastDay(day)
                    ? "วันนี้ผ่านมาแล้ว จองย้อนหลังไม่ได้"
                    : "วันนี้เลยเวลาจองแล้ว เลือกวันอื่น"
                  : free.length > 0
                    ? `ว่าง ${free.length} จาก ${rooms.length} ห้อง · ${formatHm(start)} – ${formatHm(end)} น.`
                    : `ไม่มีห้องว่าง ${formatHm(start)} – ${formatHm(end)} น.`}
              </p>
            </div>

            {nearest && !dayClosed && (
              <button type="button" onClick={() => setUserStart(nearest.start)} className={cn("inline-flex min-h-11 items-center rounded-md border border-input bg-card px-3.5 text-sm font-medium hover:bg-muted", focusRing)}>
                ลองเริ่ม {formatHm(nearest.start)} น. (ว่าง {roomOf(nearest.roomId).name})
              </button>
            )}

            {/* Wide screens: rooms by half hours */}
            <div className="hidden overflow-x-auto rounded-xl border border-border bg-card lg:block">
              <div className="flex min-w-[44rem]">
                <div className="sticky left-0 z-20 w-40 shrink-0 border-r border-border bg-card">
                  <div className="h-9 border-b border-border" />
                  {rooms.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => !dayClosed && pickSlot(r.id, start)}
                      aria-pressed={roomId === r.id}
                      disabled={dayClosed}
                      className={cn("flex w-full flex-col justify-center border-b border-border px-3 text-left last:border-b-0 hover:bg-muted", ROW_H, focusRing, roomId === r.id && "bg-primary/5")}
                    >
                      <span className="truncate text-sm font-medium">{r.name}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {r.requires_approval ? <Clock className="size-3.5" aria-hidden /> : <Zap className="size-3.5" aria-hidden />}
                        {r.requires_approval ? "รอ ผอ. อนุมัติ" : "จองได้ทันที"}
                        {r.capacity ? (
                          <span className="ml-auto inline-flex items-center gap-1 tabular-nums">
                            <Users className="size-3.5" aria-hidden />
                            {r.capacity}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="relative min-w-0 flex-1">
                  <div className="flex h-9 border-b border-border">
                    {HOUR_MARKS.map((m) => (
                      <div key={m} className="flex-1 border-l border-border pt-2 pl-1.5 text-xs leading-none text-muted-foreground tabular-nums first:border-l-0">
                        {formatHm(m)}
                      </div>
                    ))}
                  </div>
                  {rooms.map((r) => (
                    <div key={r.id} className={cn("relative border-b border-border last:border-b-0", ROW_H)}>
                      <div className="absolute inset-0 flex">
                        {Array.from({ length: SLOTS }, (_, i) => {
                          const m = DAY_START + i * STEP;
                          const taken = clashOf(segs, r.id, m, m + STEP);
                          const disabled = dayClosed || isPastSlot(m) || Boolean(taken);
                          return (
                            <button
                              key={m}
                              type="button"
                              tabIndex={-1}
                              disabled={disabled}
                              onClick={() => pickSlot(r.id, m)}
                              aria-label={`${r.name} ${formatHm(m)} น. ${taken ? "ไม่ว่าง" : "ว่าง"}`}
                              className={cn(
                                "h-full flex-1 border-l transition-colors first:border-l-0 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset",
                                i % 2 === 0 ? "border-border" : "border-border/40",
                                disabled ? "cursor-not-allowed bg-muted/50" : "bg-card hover:bg-primary/10",
                              )}
                            />
                          );
                        })}
                      </div>
                      {active
                        .filter(({ b }) => b.room_id === r.id)
                        .map(({ b, seg }) => {
                          const mine = userId !== null && b.applicant_id === userId;
                          const pending = b.status === "pending";
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => setDetailId(b.id)}
                              aria-label={`${pending ? "รออนุมัติ" : "จองแล้ว"}: ${b.purpose} ${formatHm(seg.start)} – ${formatHm(seg.end)} น.${mine ? " (ของฉัน)" : ""}`}
                              style={{
                                left: `${pct(Math.max(seg.start, DAY_START))}%`,
                                width: `${pct(Math.min(seg.end, DAY_END)) - pct(Math.max(seg.start, DAY_START))}%`,
                                ...(pending ? { backgroundImage: "repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in oklch, var(--color-primary) 10%, transparent) 6px 8px)" } : null),
                              }}
                              className={cn(
                                "absolute inset-y-1 z-10 flex flex-col justify-center overflow-hidden rounded-md border px-2 text-left text-xs leading-tight transition-colors",
                                focusRing,
                                pending ? "border-dashed border-primary/50 bg-card text-foreground" : "border-primary/30 bg-primary/15 text-primary hover:bg-primary/25",
                                mine && "ring-2 ring-primary ring-inset",
                              )}
                            >
                              <span className="truncate font-medium">{b.purpose}</span>
                              <span className="truncate tabular-nums opacity-80">
                                {pending ? "รออนุมัติ" : mine ? "ของฉัน" : b.applicant_name ?? "จองแล้ว"}
                              </span>
                            </button>
                          );
                        })}
                      {chosen?.id === r.id && !dayClosed && (
                        <div
                          aria-hidden
                          style={{ left: `${pct(start)}%`, width: `${pct(end) - pct(start)}%` }}
                          className="pointer-events-none absolute inset-y-1 z-20 flex items-center justify-center overflow-hidden rounded-md bg-primary text-xs font-medium text-primary-foreground tabular-nums shadow-sm"
                        >
                          {formatHm(start)} – {formatHm(end)}
                        </div>
                      )}
                    </div>
                  ))}
                  {nowPct !== null && (
                    <div aria-hidden className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-destructive" style={{ left: `${nowPct}%` }}>
                      <span className="absolute bottom-1 left-1 rounded-sm bg-destructive px-1 py-0.5 text-[11px] leading-none text-white tabular-nums">{nowMin !== null && formatHm(nowMin)}</span>
                    </div>
                  )}
                </div>
              </div>
              <ul aria-label="สัญลักษณ์" className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border px-3 py-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-1.5">
                  <span className="size-3 rounded-sm border border-border bg-card" aria-hidden />
                  ว่าง
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="size-3 rounded-sm border border-primary/30 bg-primary/15" aria-hidden />
                  จองแล้ว
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="size-3 rounded-sm border border-dashed border-primary/50 bg-card" aria-hidden />
                  รออนุมัติ
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="size-3 rounded-sm bg-primary" aria-hidden />
                  ช่วงที่เลือก
                </li>
                <li className="ml-auto flex items-center gap-1.5">
                  <MousePointerClick className="size-3.5" aria-hidden />
                  กดช่องว่างเพื่อเลือกห้องและเวลาเริ่ม
                </li>
              </ul>
            </div>

            {/* Phones: one card per room with a small timeline */}
            <ul className="grid gap-2 lg:hidden">
              {rooms
                .slice()
                .sort((a, b) => Number(free.includes(b.id)) - Number(free.includes(a.id)) || Number(a.requires_approval) - Number(b.requires_approval))
                .map((r) => {
                  const isFree = free.includes(r.id) && !dayClosed;
                  const clash = busyOf(r.id);
                  const clashBooking = clash ? bookings.find((x) => x.id === clash.clash.id) : undefined;
                  const on = roomId === r.id;
                  return (
                    <li key={r.id} className={cn("rounded-xl border bg-card", on ? "border-primary ring-2 ring-primary/20" : "border-border")}>
                      <button
                        type="button"
                        disabled={!isFree}
                        aria-pressed={on}
                        onClick={() => pickSlot(r.id, start)}
                        className={cn("grid w-full gap-2 rounded-xl p-3.5 text-left", focusRing, isFree ? "hover:bg-muted/50" : "cursor-default")}
                      >
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="font-display text-base leading-snug font-semibold">{r.name}</span>
                          <span className={cn("shrink-0 text-sm font-medium", isFree ? "text-emerald-800" : "text-muted-foreground")}>{isFree ? "ว่าง" : "ไม่ว่าง"}</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          {r.requires_approval ? <Clock className="size-4" aria-hidden /> : <Zap className="size-4" aria-hidden />}
                          {r.requires_approval ? "ต้องรอ ผอ. อนุมัติ" : "จองได้ทันที"}
                          {r.capacity ? <span className="ml-auto tabular-nums">{r.capacity} คน</span> : null}
                        </span>
                        <span aria-hidden className="relative block h-2 overflow-hidden rounded-full bg-muted">
                          {active
                            .filter(({ b }) => b.room_id === r.id)
                            .map(({ b, seg }) => (
                              <span
                                key={b.id}
                                className={cn("absolute inset-y-0 bg-primary/40", b.status === "pending" && "bg-primary/20")}
                                style={{ left: `${pct(Math.max(seg.start, DAY_START))}%`, width: `${pct(Math.min(seg.end, DAY_END)) - pct(Math.max(seg.start, DAY_START))}%` }}
                              />
                            ))}
                          {!dayClosed && <span className="absolute inset-y-0 bg-primary" style={{ left: `${pct(start)}%`, width: `${pct(end) - pct(start)}%` }} />}
                        </span>
                        <span aria-hidden className="flex justify-between text-xs text-muted-foreground tabular-nums">
                          <span>{formatHm(DAY_START)}</span>
                          <span>{formatHm(13 * 60)}</span>
                          <span>{formatHm(DAY_END)}</span>
                        </span>
                      </button>
                      {clash && !dayClosed && (
                        <div className="grid gap-1 border-t border-border px-3.5 py-2.5">
                          <button type="button" onClick={() => setDetailId(clash.clash.id)} className={cn("w-fit rounded text-left text-sm text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground", focusRing)}>
                            {clashBooking?.status === "pending" ? "รออนุมัติ" : "มีคนจองแล้ว"}: {clashBooking?.purpose} {formatHm(clash.clash.start)} – {formatHm(clash.clash.end)} น.
                            {clashBooking && userId && clashBooking.applicant_id === userId ? " (ของฉัน)" : ""}
                          </button>
                          {clash.fit !== null && (
                            <button type="button" onClick={() => setUserStart(clash.fit)} className={cn("inline-flex min-h-11 w-fit items-center rounded-md border border-input px-3.5 text-sm hover:bg-muted", focusRing)}>
                              ห้องนี้ว่าง ลองเริ่ม {formatHm(clash.fit)} น.
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
            </ul>
          </section>

          {isManager && <PendingQueue bookings={bookings} rooms={rooms} onOpen={setDetailId} tone="well" />}
        </div>

        {/* Details */}
        <div ref={panel} className="scroll-mt-4 xl:sticky xl:top-6">
          {chosen ? (
            <section aria-labelledby="h-details" className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <h2 id="h-details" className="mb-4 font-display text-lg font-semibold">
                รายละเอียดการจอง
              </h2>
              <BookingDetails key={formKey} room={chosen} bookings={bookings} ymd={day} start={start} end={end} onBack={() => setRoomId(null)} onAgain={reset} />
            </section>
          ) : (
            <div className="hidden rounded-xl border border-dashed border-input p-6 text-center xl:block">
              <p className="font-medium">ยังไม่ได้เลือกห้อง</p>
              <p className="mt-1 text-sm text-muted-foreground">กดช่องว่างในตารางเพื่อเลือกห้องและเวลาเริ่ม แล้วกรอกรายละเอียดตรงนี้</p>
            </div>
          )}
        </div>
      </div>

      <BookingDetailDialog
        booking={detail}
        room={rooms.find((r) => r.id === detail?.room_id)}
        mine={userId !== null && detail?.applicant_id === userId}
        isStaff={isManager}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
