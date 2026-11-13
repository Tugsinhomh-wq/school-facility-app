"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { BookingDetailDialog } from "@/components/meeting/booking-detail-dialog";
import { BookingForm } from "@/components/meeting/booking-dialog";
import { PendingQueue } from "@/components/meeting/pending-queue";
import { useLiveRefresh, useNow } from "@/components/meeting/use-meeting-live";
import { buttonVariants } from "@/components/ui/button";
import type { Booking, RoomInfo } from "@/lib/data/rooms";
import { DAY_END, DAY_START, STEP } from "@/lib/meeting";
import { firstFreeStart, HOURS, lanePos, roomNow, segOn, weekDays } from "@/lib/meeting-view";
import { addDays, atBangkok, bangkokMinutes, bangkokYmd, formatDayLong, formatDayShort, formatHm, mondayOf } from "@/lib/time";
import { cn } from "@/lib/utils";

const ROW_REM = 3.25;

/**
 * The day desk, for everyone but the administrator: one room and one day as a lane you tap to start a booking, the
 * booking form beside it, and (for approvers) the requests waiting for a decision. State that must be shareable
 * (room, week) lives in the URL; the day and the start time are local.
 */
export function RoomDesk({
  rooms,
  bookings,
  weekStart,
  roomId,
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
  roomId: string;
  userId: string | null;
  isManager: boolean;
  live: boolean;
  sample: boolean;
  canManage: boolean;
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

  const [picked, setPicked] = useState<string | null>(null);
  const day = picked && days.includes(picked) ? picked : today && days.includes(today) ? today : days[0];
  const [userStart, setUserStart] = useState<number | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = bookings.find((b) => b.id === detailId) ?? null;

  // The suggested start (the first free half hour) is worked out once per room and day, so a minute ticking by
  // or a booking arriving never remounts a form someone is typing in. (Set during render, not in an effect.)
  const [auto, setAuto] = useState<{ k: string; start: number } | null>(null);
  const k = `${room.id}|${day}`;
  if (now && auto?.k !== k) setAuto({ k, start: firstFreeStart(roomBookings, room.id, day, now) });
  const start = userStart ?? auto?.start ?? DAY_START;

  const isPast = (ymd: string, minute: number) => (now ? atBangkok(ymd, minute + STEP).getTime() <= now.getTime() : false);
  const dayPast = today !== null && day < today;
  const href = (week: string, rid = room.id) => `/meeting-rooms?week=${week}&room=${rid}`;

  const segs = roomBookings
    .filter((b) => b.status === "pending" || b.status === "approved")
    .map((b) => ({ b, seg: segOn(b, day) }))
    .filter((x): x is { b: Booking; seg: { start: number; end: number } } => x.seg !== null && x.seg.end > DAY_START && x.seg.start < DAY_END);
  const nowLine = today === day && nowMin !== null && nowMin >= DAY_START && nowMin < DAY_END ? lanePos(DAY_START, nowMin).height : null;

  function pickDay(ymd: string) {
    setPicked(ymd);
    setUserStart(null);
    setFormKey((n) => n + 1);
  }
  function pickHour(h: number) {
    const earliest = today === day && nowMin !== null ? Math.ceil(nowMin / STEP) * STEP : DAY_START;
    setUserStart(Math.max(h, earliest));
    setFormKey((n) => n + 1);
    // On a phone the form is below the lane: bring it into view so the tap visibly does something.
    if (window.matchMedia("(max-width: 1023px)").matches) document.getElementById("room-form")?.scrollIntoView({ block: "start" });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{today ? formatDayLong(today) : " "}</p>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">ขอใช้ห้องประชุม</h1>
          <p className="mt-1 text-muted-foreground">
            ดูตารางว่างและจองห้อง ระบบกันเวลาชนกันให้{sample && " (ข้อมูลตัวอย่าง)"}
          </p>
        </div>
        {canManage && (
          <Link href="/meeting-rooms/manage" className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline">
            จัดการห้อง
          </Link>
        )}
      </header>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[7fr_5fr]">
        <section aria-labelledby="lane-h" className="rounded-2xl bg-secondary p-4 shadow-xs sm:p-6">
          <h2 id="lane-h" className="font-display text-2xl font-medium leading-snug">
            ตารางห้อง
          </h2>
          <p className="mt-0.5 mb-4 text-muted-foreground">เลือกห้องและวัน แล้วแตะชั่วโมงที่ว่างเพื่อเริ่มจอง</p>

          <nav aria-label="เลือกห้อง" className="flex flex-wrap gap-2">
            {rooms.map((r) => {
              const st = now ? roomNow(bookings, r.id, now) : null;
              return (
                <Link
                  key={r.id}
                  href={href(weekStart, r.id)}
                  aria-current={r.id === room.id ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 flex-col justify-center rounded-3xl px-4 py-1 text-sm leading-snug font-medium outline-none ring-1 ring-input transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                    r.id === room.id ? "bg-sidebar-accent ring-2 ring-foreground" : "hover:bg-muted",
                  )}
                >
                  {r.name}
                  {st && (
                    <span className="text-xs font-normal text-muted-foreground">
                      {st.kind === "busy" && `ใช้งานอยู่ ถึง ${formatHm(st.until)} น.`}
                      {st.kind === "free" && (st.until ? `ว่างตอนนี้ ถึง ${formatHm(st.until)} น.` : "ว่างตอนนี้")}
                      {st.kind === "closed" && "นอกเวลาจอง"}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <p className="my-3 flex flex-wrap items-center gap-2 text-sm text-foreground/80">
            {[room.building_name !== room.name ? room.building_name : null, room.capacity ? `${room.capacity} ที่นั่ง` : null].filter(Boolean).join(", ")}
            {room.equipment.map((e) => (
              <span key={e} className="rounded-full border border-input px-2.5 py-0.5">
                {e}
              </span>
            ))}
            <span className="rounded-full border border-input px-2.5 py-0.5">{room.requires_approval ? "ต้องรออนุมัติ" : "จองได้ทันที"}</span>
          </p>

          <div className="mb-3 flex items-center justify-between gap-2" aria-label="สัปดาห์">
            <Link href={href(addDays(weekStart, -7))} className={cn(buttonVariants({ variant: "outline" }), "h-11 rounded-full px-4 text-sm")}>
              <ChevronLeft className="size-4" aria-hidden />
              ก่อนหน้า
            </Link>
            <Link href={href(thisWeek)} className="inline-flex min-h-11 items-center px-2 text-sm font-medium underline-offset-4 hover:underline">
              สัปดาห์นี้
            </Link>
            <Link href={href(addDays(weekStart, 7))} className={cn(buttonVariants({ variant: "outline" }), "h-11 rounded-full px-4 text-sm")}>
              ถัดไป
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div role="group" aria-label="วัน" className="grid grid-cols-7 gap-1.5">
            {days.map((ymd) => {
              const [dow, date] = formatDayShort(ymd).split(" ");
              const on = ymd === day;
              return (
                <button
                  key={ymd}
                  type="button"
                  aria-pressed={on}
                  onClick={() => pickDay(ymd)}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center rounded-full px-0.5 py-2 text-center outline-none ring-1 ring-input transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                    on ? "bg-sidebar-accent ring-2 ring-foreground" : "hover:bg-muted",
                  )}
                >
                  <span className="text-xs font-medium text-muted-foreground sm:text-sm">{dow}</span>
                  <span className={cn("font-display text-lg leading-tight font-medium tabular-nums sm:text-xl", ymd === today && "text-primary")}>{date}</span>
                  <span className="min-h-[1em] text-[10px] leading-none text-foreground/80 sm:text-xs">{ymd === today ? "วันนี้" : ""}</span>
                </button>
              );
            })}
          </div>

          <div role="group" aria-label={`ตารางเวลา ${formatDayLong(day)}`} className="relative mt-4 overflow-hidden rounded-2xl bg-card" style={{ height: `${HOURS.length * ROW_REM}rem` }}>
            <ol className="m-0 list-none p-0">
              {HOURS.map((h) => {
                const past = isPast(day, h) && isPast(day, h + STEP);
                return (
                  <li key={h}>
                    <button
                      type="button"
                      disabled={past || dayPast}
                      onClick={() => pickHour(h)}
                      aria-label={`เริ่มจองเวลา ${formatHm(h)} น.`}
                      className="group grid w-full grid-cols-[3.5rem_1fr] items-center border-t border-border pr-3 text-left text-sm text-muted-foreground outline-none first:border-t-0 enabled:hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ height: `${ROW_REM}rem` }}
                    >
                      <span className="pl-3 tabular-nums">{formatHm(h)}</span>
                      <span className="text-foreground/80 opacity-0 transition-opacity group-enabled:group-hover:opacity-100 group-focus-visible:opacity-100">แตะเพื่อเริ่มจอง</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {nowLine !== null && (
              <>
                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 bg-foreground/5" style={{ height: `${nowLine}%` }} />
                <div aria-hidden className="pointer-events-none absolute inset-x-0 border-t-2 border-primary" style={{ top: `${nowLine}%` }} />
              </>
            )}
            <div className="pointer-events-none absolute inset-y-0 right-2 left-[4.25rem]">
              {segs.map(({ b, seg }) => {
                const pos = lanePos(seg.start, seg.end);
                const pending = b.status === "pending";
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setDetailId(b.id)}
                    aria-label={`${b.purpose} ${formatHm(seg.start)} ถึง ${formatHm(seg.end)} น. ${pending ? "รออนุมัติ" : "จองแล้ว"}${userId && b.applicant_id === userId ? " ของฉัน" : ""}`}
                    className={cn(
                      "pointer-events-auto absolute inset-x-0 flex flex-col overflow-hidden rounded-2xl px-3 py-1 text-left text-xs leading-snug outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      pending ? "bg-card text-foreground ring-2 ring-primary" : "bg-primary text-primary-foreground",
                      userId && b.applicant_id === userId && "outline-2 -outline-offset-2 outline-foreground",
                    )}
                    style={{ top: `${pos.top}%`, height: `${pos.height}%` }}
                  >
                    <span className="truncate text-sm font-medium">{b.purpose}</span>
                    <span className="tabular-nums opacity-90">
                      {formatHm(seg.start)} ถึง {formatHm(seg.end)} น. {userId && b.applicant_id === userId ? "ของฉัน " : ""}
                      {pending ? "รออนุมัติ" : "จองแล้ว"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block size-3.5 rounded-md bg-primary" aria-hidden />
              จองแล้ว
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block size-3.5 rounded-md bg-card ring-2 ring-primary" aria-hidden />
              รออนุมัติ
            </span>
            <span>เส้นสีน้ำเงินคือเวลาตอนนี้</span>
          </p>
        </section>

        <div className="space-y-6">
          <section id="room-form" aria-labelledby="form-h" className="scroll-mt-4 rounded-2xl bg-secondary p-4 shadow-xs sm:p-6">
            <h2 id="form-h" className="font-display text-2xl font-medium leading-snug">
              จองห้องนี้
            </h2>
            <p className="mt-0.5 mb-4 text-muted-foreground">
              {room.name}, {formatDayLong(day)}
            </p>
            {dayPast ? (
              <p className="rounded-lg bg-card p-3 text-sm text-muted-foreground">วันนี้ผ่านมาแล้ว จองย้อนหลังไม่ได้ เลือกวันอื่น</p>
            ) : (
              <BookingForm
                key={`${room.id}-${day}-${start}-${formKey}`}
                rooms={rooms}
                bookings={bookings}
                defaults={{ roomId: room.id, ymd: day, start }}
                onDone={() => setFormKey((n) => n + 1)}
              />
            )}
          </section>
          {isManager && <PendingQueue bookings={bookings} rooms={rooms} onOpen={setDetailId} tone="well" />}
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
