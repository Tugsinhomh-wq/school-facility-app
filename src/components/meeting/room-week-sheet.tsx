"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { BookingDetailDialog } from "@/components/meeting/booking-detail-dialog";
import { BookingForm } from "@/components/meeting/booking-dialog";
import { PendingQueue } from "@/components/meeting/pending-queue";
import { RoomOverview } from "@/components/meeting/room-overview";
import { useLiveRefresh, useNow } from "@/components/meeting/use-meeting-live";
import type { Booking, RoomInfo } from "@/lib/data/rooms";
import { DAY_END, DAY_START, STEP } from "@/lib/meeting";
import { firstFreeStart, HOURS, lanePos, segOn, weekDays } from "@/lib/meeting-view";
import { addDays, bangkokMinutes, bangkokYmd, formatDateShort, formatDayLong, formatDayShort, formatHm, mondayOf } from "@/lib/time";
import { cn } from "@/lib/utils";

const ROW_REM = 2.75;
const LINES = `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${ROW_REM}rem - 1px), var(--color-sheet-rule) calc(${ROW_REM}rem - 1px), var(--color-sheet-rule) ${ROW_REM}rem)`;
const WELL = "border-2 border-sheet-ink bg-sheet-paper-2 p-4 shadow-[8px_8px_0_var(--color-sheet-paper-3)] sm:p-6";

/**
 * The administrator's view: the whole week of one room as a printed sheet (desktop), the same week as a day-by-day
 * list (phone), the booking form and the approval queue beside it, and every room against every day below. Rooms and
 * weeks are in the URL; the chosen day and start time are local.
 */
export function RoomWeekSheet({
  rooms,
  bookings,
  weekStart,
  roomId,
  userId,
  live,
  sample,
  error,
}: {
  rooms: RoomInfo[];
  bookings: Booking[];
  weekStart: string;
  roomId: string;
  userId: string | null;
  live: boolean;
  sample: boolean;
  error?: string;
}) {
  useLiveRefresh(live);
  const now = useNow();
  const room = rooms.find((r) => r.id === roomId) ?? rooms[0];
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const roomBookings = useMemo(() => bookings.filter((b) => b.room_id === room.id), [bookings, room.id]);
  const today = now ? bangkokYmd(now) : null;
  const nowMin = now ? bangkokMinutes(now) : null;
  const thisWeek = today ? mondayOf(today) : weekStart;
  const href = (week: string, rid = room.id) => `/meeting-rooms?week=${week}&room=${rid}`;

  const [sel, setSel] = useState<{ ymd: string; start: number } | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = bookings.find((b) => b.id === detailId) ?? null;

  // The first suggestion is worked out once per room and week, so a ticking minute never remounts a form in use.
  // (Set during render, not in an effect.)
  const [auto, setAuto] = useState<{ k: string; ymd: string; start: number } | null>(null);
  const k = `${room.id}|${weekStart}`;
  if (now && auto?.k !== k) {
    const ymd = days.includes(bangkokYmd(now)) ? bangkokYmd(now) : days[0];
    setAuto({ k, ymd, start: firstFreeStart(roomBookings, room.id, ymd, now) });
  }
  const chosen = sel ?? (auto ? { ymd: auto.ymd, start: auto.start } : { ymd: days[0], start: DAY_START });
  const dayPast = today !== null && chosen.ymd < today;

  const blocksOn = (ymd: string) =>
    roomBookings
      .filter((b) => b.status === "pending" || b.status === "approved")
      .map((b) => ({ b, seg: segOn(b, ymd) }))
      .filter((x): x is { b: Booking; seg: { start: number; end: number } } => x.seg !== null && x.seg.end > DAY_START && x.seg.start < DAY_END)
      .sort((a, b) => a.seg.start - b.seg.start);

  function choose(ymd: string, start: number) {
    setSel({ ymd, start });
    setFormKey((n) => n + 1);
  }
  const mine = (b: Booking) => userId !== null && b.applicant_id === userId;
  const label = (b: Booking, seg: { start: number; end: number }) =>
    `${b.purpose} ${formatHm(seg.start)} ถึง ${formatHm(seg.end)} น. ${b.status === "pending" ? "รออนุมัติ" : "จองแล้ว"}`;

  return (
    <div className="room-sheet -mx-4 bg-sheet-paper px-4 py-6 text-sheet-ink-2 sm:mx-0 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b-2 border-sheet-ink pb-4">
        <div>
          <p className="text-sm font-semibold text-sheet-muted">
            สัปดาห์ {formatDateShort(days[0])} ถึง {formatDateShort(days[6])}
          </p>
          <h1 className="mt-1 font-sheet text-3xl leading-snug font-bold text-sheet-ink">ขอใช้ห้องประชุม</h1>
        </div>
        <p className="max-w-[52ch] flex-1 basis-64">ดูตารางว่างและจองห้อง ระบบกันเวลาชนกันให้{sample && " (ข้อมูลตัวอย่าง)"}</p>
        <Link href="/meeting-rooms/manage" className="inline-flex min-h-11 items-center text-sm font-semibold text-sheet-ink underline decoration-sheet-ink underline-offset-4 hover:decoration-sheet-accent">
          จัดการห้อง
        </Link>
      </header>
      {error && (
        <p role="alert" className="mt-4 text-sm text-sheet-accent">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <nav aria-label="เลือกห้อง" className="flex flex-wrap gap-x-6">
          {rooms.map((r) => (
            <Link
              key={r.id}
              href={href(weekStart, r.id)}
              aria-current={r.id === room.id ? "page" : undefined}
              className={cn(
                "flex min-h-12 flex-col justify-center border-b-2 pb-0.5 text-sm font-semibold text-sheet-ink outline-none transition-colors hover:border-sheet-gold focus-visible:ring-3 focus-visible:ring-sheet-accent/60",
                r.id === room.id ? "border-sheet-accent" : "border-transparent",
              )}
            >
              {r.name}
              <span className="text-xs font-semibold text-sheet-muted">
                {[r.building_name !== r.name ? r.building_name : null, r.capacity ? `${r.capacity} ที่นั่ง` : null].filter(Boolean).join(", ")}
              </span>
            </Link>
          ))}
        </nav>
        <nav aria-label="สัปดาห์" className="flex items-center gap-4 text-sm font-semibold">
          {[
            ["สัปดาห์ก่อน", addDays(weekStart, -7)],
            ["สัปดาห์นี้", thisWeek],
            ["สัปดาห์ถัดไป", addDays(weekStart, 7)],
          ].map(([name, w]) => (
            <Link key={name} href={href(w)} className="inline-flex min-h-11 items-center text-sheet-ink underline decoration-sheet-ink underline-offset-4 hover:decoration-sheet-accent">
              {name}
            </Link>
          ))}
        </nav>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-6 text-sm font-semibold text-sheet-muted">
        {room.equipment.map((e) => (
          <span key={e}>{e}</span>
        ))}
        <span>{room.requires_approval ? "ต้องให้ ผอ. อนุมัติ" : "จองแล้วได้ทันที"}</span>
      </p>

      <div className="mt-6 grid grid-cols-1 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          {/* Desktop: the printed week. */}
          <div
            role="group"
            aria-label="ตารางสัปดาห์ของห้อง"
            className="hidden border-2 border-sheet-ink bg-sheet-paper-2 shadow-[8px_8px_0_var(--color-sheet-paper-3)] lg:grid lg:grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]"
          >
            <div className="border-b-2 border-sheet-ink" />
            {days.map((ymd) => {
              const [dow, date] = formatDayShort(ymd).split(" ");
              return (
                <div key={ymd} className="border-b-2 border-l border-sheet-ink border-l-sheet-rule px-1 pt-3 pb-2 text-center">
                  <span className="block text-sm font-semibold text-sheet-muted">{dow}</span>
                  <span className={cn("block font-sheet text-2xl leading-snug font-bold tabular-nums", ymd === today ? "text-sheet-accent" : "text-sheet-ink")}>{date}</span>
                  <span className="block min-h-[1.2em] text-xs font-semibold text-sheet-accent">{ymd === today ? "วันนี้" : ""}</span>
                </div>
              );
            })}
            <div aria-hidden className="relative" style={{ height: `${HOURS.length * ROW_REM}rem` }}>
              {HOURS.slice(1).map((h, i) => (
                <span key={h} className="absolute inset-x-0 -translate-y-1/2 pr-2 text-right text-xs font-semibold text-sheet-muted tabular-nums" style={{ top: `${(i + 1) * ROW_REM}rem` }}>
                  {formatHm(h)}
                </span>
              ))}
            </div>
            {days.map((ymd) => {
              const line = ymd === today && nowMin !== null && nowMin >= DAY_START && nowMin < DAY_END ? lanePos(DAY_START, nowMin).height : null;
              return (
                <div
                  key={ymd}
                  title="คลิกช่วงเวลาที่ว่างเพื่อเริ่มจอง"
                  className="relative cursor-pointer border-l border-sheet-rule"
                  style={{ height: `${HOURS.length * ROW_REM}rem`, backgroundImage: LINES }}
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    const slot = Math.floor((((e.clientY - r.top) / r.height) * (DAY_END - DAY_START)) / STEP);
                    choose(ymd, Math.min(DAY_END - STEP, DAY_START + slot * STEP));
                  }}
                >
                  {blocksOn(ymd).map(({ b, seg }) => {
                    const pos = lanePos(seg.start, seg.end);
                    const pending = b.status === "pending";
                    return (
                      <button
                        key={b.id}
                        type="button"
                        aria-label={label(b, seg) + (mine(b) ? " ของฉัน" : "")}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailId(b.id);
                        }}
                        className={cn(
                          "absolute inset-x-1 overflow-hidden px-1.5 py-0.5 text-left text-xs leading-snug outline-none focus-visible:ring-3 focus-visible:ring-sheet-accent/60",
                          pending ? "border-2 border-dashed border-sheet-accent bg-sheet-paper-2" : "border border-sheet-ink bg-sheet-paper-3",
                          mine(b) && "outline-2 -outline-offset-4 outline-sheet-ink",
                        )}
                        style={{ top: `${pos.top}%`, height: `${pos.height}%` }}
                      >
                        <span className="block truncate text-sm font-semibold text-sheet-ink">{b.purpose}</span>
                        <span className="block text-xs font-semibold text-sheet-ink-2 tabular-nums">
                          {formatHm(seg.start)} ถึง {formatHm(seg.end)} น.{pending && " รออนุมัติ"}
                        </span>
                      </button>
                    );
                  })}
                  {line !== null && (
                    <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-sheet-accent" style={{ top: `${line}%` }}>
                      <span className="absolute right-0 -translate-y-full bg-sheet-accent px-1 text-xs font-semibold text-sheet-paper-2">ตอนนี้ {formatHm(nowMin ?? 0)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Phone and tablet: the same week as a list. */}
          <div className="lg:hidden" aria-label="รายการจองรายวันของห้อง">
            {days.map((ymd) => {
              const list = blocksOn(ymd);
              return (
                <section key={ymd} className="mt-6 first:mt-0">
                  <h2 className={cn("border-b-2 border-sheet-ink pb-1 font-sheet text-lg leading-snug font-bold", ymd === today ? "text-sheet-accent" : "text-sheet-ink")}>
                    {ymd === today && "วันนี้ "}
                    {formatDayLong(ymd).replace(/^วัน/, "").replace(/ \d{4}$/, "")}
                  </h2>
                  {list.length === 0 ? (
                    <p className="py-3 text-sm text-sheet-muted">ว่างทั้งวัน</p>
                  ) : (
                    <ul className="divide-y divide-sheet-rule">
                      {list.map(({ b, seg }) => (
                        <li key={b.id}>
                          <button type="button" onClick={() => setDetailId(b.id)} className="block min-h-14 w-full py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-sheet-accent/60">
                            <span className="block font-semibold text-sheet-ink">{b.purpose}</span>
                            <span className="block text-sm font-semibold text-sheet-muted tabular-nums">
                              {formatHm(seg.start)} ถึง {formatHm(seg.end)} น. {b.status === "pending" ? "รออนุมัติ" : "จองแล้ว"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>

          <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs font-semibold text-sheet-muted">
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block h-3 w-4 border border-sheet-ink bg-sheet-paper-3" aria-hidden />
              จองแล้ว
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block h-3 w-4 border-2 border-dashed border-sheet-accent bg-sheet-paper-2" aria-hidden />
              รออนุมัติ
            </span>
            <span>เส้นสีส้มแดงคือเวลาตอนนี้</span>
          </p>

          <section aria-labelledby="overview-h" className="mt-10 hidden lg:block">
            <h2 id="overview-h" className="mb-3 border-b-2 border-sheet-ink pb-1 font-sheet text-xl leading-snug font-bold text-sheet-ink">
              ความว่างของทุกห้อง
            </h2>
            <RoomOverview rooms={rooms} bookings={bookings} days={days} today={today} activeRoomId={room.id} href={(rid) => href(weekStart, rid)} />
          </section>
        </div>

        <div className="space-y-8">
          <section aria-labelledby="sheet-form-h" className={WELL}>
            <h2 id="sheet-form-h" className="mb-3 border-b border-sheet-gold pb-2 font-sheet text-xl leading-snug font-bold text-sheet-ink">
              จองห้องนี้
            </h2>
            <div className="mb-3 space-y-1.5">
              <label htmlFor="sheet-day" className="text-sm font-semibold text-sheet-ink">
                วัน
              </label>
              <select
                id="sheet-day"
                value={chosen.ymd}
                onChange={(e) => choose(e.target.value, firstFreeStart(roomBookings, room.id, e.target.value, now))}
                className="h-11 w-full border border-sheet-ink bg-transparent px-2.5 text-base outline-none focus-visible:ring-3 focus-visible:ring-sheet-accent/60"
              >
                {days.map((ymd) => (
                  <option key={ymd} value={ymd}>
                    {formatDayLong(ymd).replace(/ \d{4}$/, "")}
                  </option>
                ))}
              </select>
            </div>
            {dayPast ? (
              <p className="border border-sheet-gold bg-sheet-paper-3 p-3 text-sm">วันนี้ผ่านมาแล้ว จองย้อนหลังไม่ได้ เลือกวันอื่น</p>
            ) : (
              <BookingForm
                key={`${room.id}-${chosen.ymd}-${chosen.start}-${formKey}`}
                rooms={rooms}
                bookings={bookings}
                defaults={{ roomId: room.id, ymd: chosen.ymd, start: chosen.start }}
                onDone={() => setFormKey((n) => n + 1)}
              />
            )}
          </section>
          <PendingQueue bookings={bookings} rooms={rooms} onOpen={setDetailId} tone="sheet" />
        </div>
      </div>

      <BookingDetailDialog
        booking={detail}
        room={rooms.find((r) => r.id === detail?.room_id)}
        mine={detail !== null && mine(detail)}
        isStaff
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
