"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Clock, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { BookingDetailDialog } from "@/components/meeting/booking-detail-dialog";
import { BookingDetails, nextClass } from "@/components/meeting/booking-details";
import { PendingQueue } from "@/components/meeting/pending-queue";
import { useLiveRefresh, useNow } from "@/components/meeting/use-meeting-live";
import { Button } from "@/components/ui/button";
import type { Booking, RoomInfo } from "@/lib/data/rooms";
import { DAY_END, DAY_START, STEP } from "@/lib/meeting";
import { earliestFit, splitRooms, type Seg } from "@/lib/meeting-finder";
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
const STEPS = ["เวลา", "ห้อง", "รายละเอียด"];
/** Teachers rarely start at 07:00, so a future day opens on 08:00. */
const DEFAULT_START = 8 * 60;

const selectClass =
  "h-12 w-full appearance-none rounded-md border border-input bg-card px-3.5 pr-10 text-base tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

/**
 * Booking in three steps, for everyone but the administrator: 1 when (day, start, length), 2 which room (only the
 * rooms that are free then), 3 what for. The week lives in the URL; everything else is local. Approvers also see the
 * requests waiting for a decision on step 1.
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
  /** Kept for the page's shared props: step 2 lists every room, so the URL's room is not used. */
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

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [picked, setPicked] = useState<string | null>(null);
  const [userStart, setUserStart] = useState<number | null>(null);
  const [length, setLength] = useState(60);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  // Each step opens at the top with its heading focused, so a screen reader and a thumb both start in the right place.
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    heading.current?.focus({ preventScroll: true });
  }, [step]);

  const isPastDay = (ymd: string) => today !== null && ymd < today;
  const firstOpen = days.find((d) => !isPastDay(d)) ?? null;
  const day = picked && days.includes(picked) && !isPastDay(picked) ? picked : today && days.includes(today) ? today : (firstOpen ?? days[0]);

  // The earliest start on this day: the next half hour when it is today, the start of the day otherwise.
  const earliest = today === day && nowMin !== null ? Math.ceil(nowMin / STEP) * STEP : DAY_START;
  const latestStart = DAY_END - STEP;
  const dayClosed = earliest > latestStart || isPastDay(day);
  const start = Math.min(Math.max(userStart ?? DEFAULT_START, earliest), latestStart);
  const len = Math.min(length, DAY_END - start);
  const end = start + len;

  const segs = useMemo<Seg[]>(() => {
    const out: Seg[] = [];
    for (const b of bookings) {
      if (b.status !== "pending" && b.status !== "approved") continue;
      const s = segOn(b, day);
      if (s) out.push({ id: b.id, roomId: b.room_id, start: s.start, end: s.end });
    }
    return out;
  }, [bookings, day]);

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
  // Rooms that can be booked on the spot come first.
  const freeRooms = free.map(roomOf).sort((a, b) => Number(a.requires_approval) - Number(b.requires_approval));
  const nearest = freeRooms.length === 0 ? earliestFit(busy) : null;
  // A room somebody else just took drops out of the choice; step 3 keeps its room and reports the clash itself.
  const chosen = roomId && (step === 3 || free.includes(roomId)) ? rooms.find((r) => r.id === roomId) : undefined;
  const detail = bookings.find((b) => b.id === detailId) ?? null;
  const whenShort = `${formatDayShort(day)} · ${formatHm(start)} – ${formatHm(end)} น.`;

  function pickDay(ymd: string) {
    setPicked(ymd);
    setUserStart(null);
  }
  const reset = () => {
    setRoomId(null);
    setPicked(null);
    setUserStart(null);
    setLength(60);
    setFormKey((n) => n + 1);
    setStep(1);
  };
  const stepNames = STEPS.map((name, i) => ({ name, n: i + 1 }));

  return (
    <div className="max-w-2xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-sm text-muted-foreground">
            {today ? formatDayLong(today) : " "}
            {sample && <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs">ข้อมูลตัวอย่าง</span>}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">ขอใช้ห้องประชุม</h1>
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

      <ol aria-label="ขั้นตอนการจอง" className="grid grid-cols-3 border-t-2 border-primary">
        {stepNames.map(({ name, n }) => (
          <li key={n} aria-current={n === step ? "step" : undefined} className={cn("flex items-baseline gap-2 pt-2.5 pr-2 text-sm", n === step ? "font-semibold text-primary" : n < step ? "text-foreground" : "text-muted-foreground")}>
            <span className="tabular-nums">{n}</span>
            {name}
          </li>
        ))}
      </ol>

      {step > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 border-y border-border py-1.5">
          <p className="font-semibold tabular-nums">{whenShort}</p>
          <button type="button" onClick={() => setStep(1)} className="inline-flex min-h-11 items-center px-1 font-semibold text-primary underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            แก้ไขเวลา
          </button>
        </div>
      )}

      {step === 1 && (
        <section aria-labelledby="h-time" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-x-3">
            <h2 id="h-time" ref={heading} tabIndex={-1} className="font-display text-2xl font-semibold outline-none">
              ต้องการใช้เมื่อไร
            </h2>
            <nav aria-label="สัปดาห์" className="flex items-center text-sm">
              <Link href={href(addDays(weekStart, -7))} aria-label="สัปดาห์ก่อนหน้า" className="grid size-11 place-items-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
                <ChevronLeft className="size-5" aria-hidden />
              </Link>
              <Link href={href(thisWeek)} className="inline-flex min-h-11 items-center px-1 whitespace-nowrap text-muted-foreground outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                {formatDateShort(days[0]).replace(/ \d{4}$/, "")} – {formatDateShort(days[6]).replace(/ \d{4}$/, "")}
              </Link>
              <Link href={href(addDays(weekStart, 7))} aria-label="สัปดาห์ถัดไป" className="grid size-11 place-items-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
                <ChevronRight className="size-5" aria-hidden />
              </Link>
            </nav>
          </div>

          <div role="group" aria-label="วัน" className="grid grid-cols-7 border-t border-l border-input">
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
                    "flex min-h-[4.25rem] flex-col items-start justify-center border-r border-b border-input py-1.5 pl-2 text-left outline-none focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40",
                    on ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                  )}
                >
                  <span className={cn("text-xs leading-none", on ? "text-primary-foreground/80" : "text-muted-foreground")}>{dow}</span>
                  <span className="font-display text-xl leading-tight font-semibold tabular-nums">{date}</span>
                  <span className={cn("min-h-[1em] text-[11px] leading-none", on ? "text-primary-foreground/80" : "text-muted-foreground")}>{ymd === today ? "วันนี้" : ""}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-5 sm:grid-cols-[11rem_1fr]">
            <div className="grid gap-2">
              <label htmlFor="start-sel" className="font-medium">
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
              <span id="len-l" className="font-medium">
                ใช้นานแค่ไหน
              </span>
              <div role="group" aria-labelledby="len-l" className="flex flex-wrap gap-2">
                {LENGTHS.map((l) => (
                  <button
                    key={l.min}
                    type="button"
                    aria-pressed={len === l.min}
                    disabled={dayClosed || start + l.min > DAY_END}
                    onClick={() => setLength(l.min)}
                    className={cn(
                      "min-h-11 rounded-md border px-3.5 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40",
                      len === l.min ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted",
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div role="status" className={cn("flex items-baseline gap-3 border border-l-4 border-input bg-card p-4", freeRooms.length > 0 ? "border-l-primary" : "border-l-amber-700")}>
            {dayClosed ? (
              <p className="text-muted-foreground">{isPastDay(day) ? "วันนี้ผ่านมาแล้ว จองย้อนหลังไม่ได้ เลือกวันอื่น" : "วันนี้เลยเวลาจองแล้ว เลือกวันอื่น"}</p>
            ) : (
              <>
                <strong className={cn("font-display text-4xl leading-none tabular-nums", freeRooms.length > 0 ? "text-primary" : "text-amber-800")}>{freeRooms.length}</strong>
                <span className="text-muted-foreground">{freeRooms.length > 0 ? `ห้องว่างในช่วง ${formatHm(start)} – ${formatHm(end)} น.` : "ไม่มีห้องว่างในช่วงนี้ ลองเปลี่ยนเวลาหรือวัน"}</span>
              </>
            )}
          </div>

          {nearest && !dayClosed && (
            <button type="button" onClick={() => setUserStart(nearest.start)} className="inline-flex min-h-11 items-center rounded-md border border-input bg-card px-3.5 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
              ลองเริ่ม {formatHm(nearest.start)} น. (ว่าง {roomOf(nearest.roomId).name})
            </button>
          )}

          <Button
            type="button"
            disabled={dayClosed || freeRooms.length === 0}
            onClick={() => {
              setRoomId(null);
              setStep(2);
            }}
            className={cn(nextClass, "w-full rounded-md")}
          >
            {freeRooms.length > 0 && !dayClosed ? `ดูห้องว่าง ${freeRooms.length} ห้อง` : "ไม่มีห้องว่าง"}
          </Button>

          {isManager && <PendingQueue bookings={bookings} rooms={rooms} onOpen={setDetailId} tone="well" />}
        </section>
      )}

      {step === 2 && (
        <section aria-labelledby="h-room" className="space-y-5">
          <h2 id="h-room" ref={heading} tabIndex={-1} className="font-display text-2xl font-semibold outline-none">
            เลือกห้อง
          </h2>
          {freeRooms.length === 0 ? (
            <div className="space-y-3 border border-dashed border-input p-5">
              <p className="font-medium">ห้องว่างช่วงนี้ถูกจองไปแล้ว</p>
              <Button type="button" variant="outline" className="h-12 rounded-md" onClick={() => setStep(1)}>
                กลับไปเลือกเวลาใหม่
              </Button>
            </div>
          ) : (
            <fieldset>
              <legend className="sr-only">ห้องที่ว่าง</legend>
              <div className="border-t border-input">
                {freeRooms.map((r) => (
                  <label key={r.id} className="grid min-h-[4.75rem] cursor-pointer grid-cols-[1.75rem_1fr] items-center gap-x-3.5 gap-y-1 border-b border-input py-3 pr-2 hover:bg-primary/5 has-checked:bg-primary/10 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 has-focus-visible:ring-inset">
                    <input type="radio" name="room" value={r.id} checked={chosen?.id === r.id} onChange={() => setRoomId(r.id)} className="peer sr-only" />
                    <span aria-hidden className="row-span-2 grid size-6 place-items-center rounded-full border-2 border-primary after:size-3 after:rounded-full after:bg-primary after:opacity-0 peer-checked:after:opacity-100" />
                    <span className="font-display text-lg leading-snug font-semibold">{r.name}</span>
                    <span
                      className={cn(
                        "inline-flex w-fit items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium",
                        r.requires_approval ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900",
                      )}
                    >
                      {r.requires_approval ? <Clock className="size-4" aria-hidden /> : <Zap className="size-4" aria-hidden />}
                      {r.requires_approval ? "ต้องรอ ผอ. อนุมัติ" : "จองได้ทันที"}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-14 rounded-md px-5 text-base" onClick={() => setStep(1)}>
              ย้อนกลับ
            </Button>
            <Button type="button" disabled={!chosen} aria-describedby={chosen ? undefined : "pick-hint"} onClick={() => setStep(3)} className={cn(nextClass, "flex-1 rounded-md")}>
              ถัดไป: รายละเอียด
            </Button>
          </div>
          {!chosen && freeRooms.length > 0 && (
            <p id="pick-hint" className="-mt-2 text-center text-sm text-muted-foreground">
              เลือกห้องก่อนจึงไปต่อได้
            </p>
          )}

          {busy.length > 0 && (
            <details open={freeRooms.length === 0} className="group border border-input bg-card">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-4 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                ไม่ว่างในช่วงนี้
                <span className="text-sm font-normal text-muted-foreground">{busy.length} ห้อง</span>
                <ChevronDown className="ml-auto size-5 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <ul className="divide-y divide-border px-4 pb-2">
                {busy.map(({ roomId: rid, clash, fit }) => {
                  const b = bookings.find((x) => x.id === clash.id);
                  return (
                    <li key={rid} className="grid gap-1 py-3">
                      <p className="font-medium">{roomOf(rid).name}</p>
                      <button type="button" onClick={() => setDetailId(clash.id)} className="w-fit rounded text-left text-sm text-muted-foreground underline decoration-border underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
                        {b?.status === "pending" ? "มีคำขอที่รออนุมัติ" : "มีคนจองแล้ว"}: {b?.purpose} {formatHm(clash.start)} – {formatHm(clash.end)} น.
                        {b && userId && b.applicant_id === userId ? " (ของฉัน)" : ""}
                      </button>
                      {fit !== null && (
                        <button
                          type="button"
                          onClick={() => {
                            setUserStart(fit);
                            setStep(1);
                          }}
                          className="mt-1 inline-flex min-h-11 w-fit items-center rounded-md border border-input px-3.5 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          ห้องนี้ว่าง ลองเริ่ม {formatHm(fit)} น.
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </details>
          )}
        </section>
      )}

      {step === 3 && chosen && (
        <section aria-labelledby="h-details" className="space-y-5">
          <h2 id="h-details" ref={heading} tabIndex={-1} className="font-display text-2xl font-semibold outline-none">
            รายละเอียด
          </h2>
          <BookingDetails key={`${chosen.id}|${day}|${start}|${end}|${formKey}`} room={chosen} bookings={bookings} ymd={day} start={start} end={end} onBack={() => setStep(2)} onAgain={reset} />
        </section>
      )}

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
