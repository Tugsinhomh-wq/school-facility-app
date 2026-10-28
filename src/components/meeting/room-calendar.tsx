"use client";

import { ChevronLeft, ChevronRight, Clock, Plus, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { BookingMark } from "@/components/meeting/booking-mark";
import { BookingDetailDialog } from "@/components/meeting/booking-detail-dialog";
import {
  BookingDialog,
  type BookingDefaults,
} from "@/components/meeting/booking-dialog";
import { buildDay, DayQueue } from "@/components/meeting/day-queue";
import { RoomOverview } from "@/components/meeting/room-overview";
import { Button } from "@/components/ui/button";
import type { Booking, RoomInfo } from "@/lib/data/rooms";
import { DAY_END, DAY_START, segmentOn, STEP } from "@/lib/meeting";
import { shortRoomName } from "@/lib/room-label";
import {
  addDays,
  atBangkok,
  bangkokMinutes,
  bangkokYmd,
  formatDayShort,
  formatHm,
  mondayOf,
} from "@/lib/time";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const ROW_H = 28;
const ROWS = (DAY_END - DAY_START) / STEP;
const GRID_H = ROWS * ROW_H;
const HOURS = Array.from(
  { length: (DAY_END - DAY_START) / 60 },
  (_, i) => DAY_START + i * 60,
);

interface Props {
  rooms: RoomInfo[];
  bookings: Booking[];
  weekStart: string;
  roomId: string;
  userId: string | null;
  isStaff: boolean;
  /** Subscribe to live changes (only with a real database). */
  live: boolean;
}

export function RoomCalendar({
  rooms,
  bookings,
  weekStart,
  roomId,
  userId,
  isStaff,
  live,
}: Props) {
  const router = useRouter();
  const [defaults, setDefaults] = useState<BookingDefaults | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const room = rooms.find((r) => r.id === roomId) ?? rooms[0];
  const roomBookings = useMemo(
    () => bookings.filter((b) => b.room_id === room?.id),
    [bookings, room],
  );
  const detail = bookings.find((b) => b.id === detailId) ?? null;
  // My own requests that are still ahead of us (any room), soonest first.
  const myUpcoming = useMemo(
    () =>
      bookings
        .filter(
          (b) =>
            userId !== null &&
            b.applicant_id === userId &&
            (b.status === "pending" || b.status === "approved") &&
            (!now || new Date(b.end_time) > now),
        )
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
        .slice(0, 4),
    [bookings, userId, now],
  );

  // Client-only clock: keeps past slots disabled and draws the "now" line without a hydration mismatch.
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // Real-time: any booking change anywhere re-fetches the week, so conflicts show up immediately.
  // The connection is dropped while the tab is hidden, so idle phones do not hold a slot open.
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!live) return;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const connect = () => {
      if (channel) return;
      channel = supabase
        .channel("facility-reservations")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "facility_reservations" },
          () => {
            clearTimeout(refreshTimer.current);
            refreshTimer.current = setTimeout(() => router.refresh(), 300);
          },
        )
        .subscribe();
    };
    const disconnect = () => {
      clearTimeout(refreshTimer.current);
      if (channel) void supabase.removeChannel(channel);
      channel = null;
    };
    const onVisibility = () => {
      if (document.hidden) {
        disconnect();
      } else {
        connect();
        router.refresh(); // catch up on whatever changed while hidden
      }
    };
    if (!document.hidden) connect();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      disconnect();
    };
  }, [live, router]);

  const today = now ? bangkokYmd(now) : null;
  const nowMin = now ? bangkokMinutes(now) : null;
  const isPast = (ymd: string, minute: number) =>
    now ? atBangkok(ymd, minute + STEP).getTime() <= now.getTime() : false;
  const isTaken = (ymd: string, minute: number) =>
    roomBookings.some((b) => {
      const seg = segmentOn(b, ymd);
      return seg !== null && seg.start < minute + STEP && seg.end > minute;
    });

  const day =
    picked && days.includes(picked)
      ? picked
      : today && days.includes(today)
        ? today
        : days[0];
  // On the chosen day, hide time that has already passed (rounded up to the next slot).
  const earliest =
    today === day && nowMin !== null
      ? Math.ceil(nowMin / STEP) * STEP
      : DAY_START;
  const dayItems = useMemo(
    () => buildDay(roomBookings, day, earliest),
    [roomBookings, day, earliest],
  );

  /** Phone: one day back or forward; past the edge of the week it loads the neighbouring week. */
  function stepDay(n: number) {
    const next = addDays(day, n);
    setPicked(next);
    if (!days.includes(next)) router.push(href(mondayOf(next)));
  }

  function openBooking(ymd: string, start: number) {
    if (room) setDefaults({ roomId: room.id, ymd, start });
  }

  /** Keyboard/shortcut path: the next free half hour, starting today. */
  function openNextFree() {
    const start = now ? new Date(now) : new Date();
    for (let d = 0; d < 7; d++) {
      const ymd = addDays(bangkokYmd(start), d);
      for (let m = DAY_START; m < DAY_END; m += STEP) {
        if (!isPast(ymd, m) && !isTaken(ymd, m)) return openBooking(ymd, m);
      }
    }
  }

  const href = (week: string, rid = room?.id) =>
    `/meeting-rooms?week=${week}${rid ? `&room=${rid}` : ""}`;
  const thisWeek = today
    ? addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7))
    : weekStart;

  if (!room) {
    return (
      <p className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
        ยังไม่มีห้องที่เปิดให้ขอใช้ ให้เจ้าหน้าที่ตั้งค่าห้องที่ “เปิดให้จอง”
        ในฐานข้อมูลก่อน
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden flex-wrap items-center gap-3 md:flex">
        <div
          role="tablist"
          aria-label="เลือกห้อง"
          className="-mx-4 flex w-[calc(100%+2rem)] snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:w-auto sm:flex-wrap sm:px-0"
        >
          {rooms.map((r) => (
            <Link
              key={r.id}
              href={href(weekStart, r.id)}
              role="tab"
              aria-selected={r.id === room.id}
              className={cn(
                "inline-flex min-h-11 shrink-0 snap-start items-center rounded-lg border px-4 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                r.id === room.id
                  ? "border-primary bg-primary/10 font-semibold text-primary"
                  : "border-border hover:bg-muted",
              )}
            >
              {r.name}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Button
            variant="outline"
            size="icon"
            className="size-11"
            nativeButton={false}
            render={
              <Link
                href={href(addDays(weekStart, -7))}
                aria-label="สัปดาห์ก่อนหน้า"
              />
            }
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            variant="outline"
            className="h-11 px-4"
            nativeButton={false}
            render={<Link href={href(thisWeek)} />}
          >
            สัปดาห์นี้
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-11"
            nativeButton={false}
            render={
              <Link
                href={href(addDays(weekStart, 7))}
                aria-label="สัปดาห์ถัดไป"
              />
            }
          >
            <ChevronRight aria-hidden />
          </Button>
          <Button className="h-11 px-4" onClick={openNextFree}>
            <Plus aria-hidden /> จองห้อง
          </Button>
        </div>
      </div>

      <p className="hidden text-sm text-muted-foreground md:block">
        {room.name}
        {room.building_name !== room.name ? ` · ${room.building_name}` : ""}
        {room.capacity ? ` · ${room.capacity} ที่นั่ง` : ""} ·{" "}
        {room.requires_approval ? "ต้องให้ ผอ. อนุมัติ" : "จองแล้วได้ทันที"} แตะช่วงว่างเพื่อจอง
      </p>

      {userId && myUpcoming.length > 0 && (
        <section aria-labelledby="my-requests">
          <h2 id="my-requests" className="mb-2 font-semibold">
            คำขอของฉัน
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {myUpcoming.map((b) => {
              const roomName =
                rooms.find((r) => r.id === b.room_id)?.name ?? "ห้องประชุม";
              const ymd = bangkokYmd(new Date(b.start_time));
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => setDetailId(b.id)}
                    className="flex min-h-16 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
                  >
                    <span className="min-w-0 flex-1 leading-snug">
                      <span className="block truncate font-semibold">
                        {b.purpose}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {roomName} · {formatDayShort(ymd)}{" "}
                        {formatHm(bangkokMinutes(new Date(b.start_time)))}-
                        {formatHm(bangkokMinutes(new Date(b.end_time)))} น.
                      </span>
                      <BookingMark
                        kind={b.status === "pending" ? "pending" : "booked"}
                        className="mt-1.5"
                      />
                    </span>
                    <ChevronRight
                      className="size-5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="hidden md:block">
        <RoomOverview
          rooms={rooms}
          bookings={bookings}
          days={days}
          today={today}
          activeRoomId={room.id}
          href={(rid) => href(weekStart, rid)}
        />
      </div>

      <div className="space-y-4 md:hidden">
        <nav
          aria-label="เลือกห้อง"
          className={cn("grid gap-2", rooms.length > 3 ? "grid-cols-2" : "grid-cols-3")}
        >
          {rooms.map((r) => (
            <Link
              key={r.id}
              href={href(weekStart, r.id)}
              aria-current={r.id === room.id ? "page" : undefined}
              className={cn(
                "flex min-h-20 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-3 text-center leading-snug outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                r.id === room.id ? "border-2 border-primary bg-primary/10 text-primary" : "border-border",
              )}
            >
              <span className="text-base font-semibold">{shortRoomName(r.name)}</span>
              {r.capacity ? (
                <span className="text-xs font-normal text-muted-foreground">{r.capacity} ที่นั่ง</span>
              ) : null}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="size-11" onClick={() => stepDay(-1)} aria-label="วันก่อนหน้า">
            <ChevronLeft aria-hidden />
          </Button>
          <p className="flex-1 text-center text-xl font-semibold" aria-live="polite">
            {day === today && "วันนี้ "}
            {formatDayShort(day)}
          </p>
          <Button variant="outline" size="icon" className="size-11" onClick={() => stepDay(1)} aria-label="วันถัดไป">
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <div role="tablist" aria-label="เลือกวัน" className="grid grid-cols-7 gap-1">
          {days.map((ymd) => {
            const has = roomBookings.some((b) => segmentOn(b, ymd) !== null);
            return (
              <button
                key={ymd}
                type="button"
                role="tab"
                aria-selected={ymd === day}
                onClick={() => setPicked(ymd)}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center rounded-lg border text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  ymd === day ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  ymd === today && ymd !== day && "border-primary",
                )}
              >
                <span>{formatDayShort(ymd).split(" ")[0]}</span>
                <span className="text-base font-semibold tabular-nums">{Number(ymd.slice(8))}</span>
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 size-1.5 rounded-full",
                    has ? (ymd === day ? "bg-primary-foreground" : "bg-primary") : "bg-transparent",
                  )}
                />
              </button>
            );
          })}
        </div>
        <DayQueue
          items={dayItems}
          userId={userId}
          onBook={(start) => setDefaults({ roomId: room.id, ymd: day, start })}
          onOpen={setDetailId}
          bookLabel={`${shortRoomName(room.name)} ${day === today ? "วันนี้" : formatDayShort(day)}`}
          note={`${room.requires_approval ? "ต้องให้ ผอ. อนุมัติ" : "จองแล้วได้ทันที"}${room.capacity ? ` · ${room.capacity} ที่นั่ง` : ""}`}
        />
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <div className="min-w-[46rem]">
          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-border bg-muted/50 text-center text-sm text-muted-foreground">
            <div />
            {days.map((ymd) => (
              <div
                key={ymd}
                className={cn(
                  "py-3",
                  ymd === today && "font-semibold text-primary",
                )}
              >
                {formatDayShort(ymd)}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
            <div className="relative" style={{ height: GRID_H }}>
              {HOURS.map((m) => (
                <span
                  key={m}
                  className="absolute right-2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums"
                  style={{ top: ((m - DAY_START) / STEP) * ROW_H }}
                >
                  {m === DAY_START ? "" : formatHm(m)}
                </span>
              ))}
            </div>

            {days.map((ymd) => (
              <div
                key={ymd}
                className="relative border-l border-border"
                style={{ height: GRID_H }}
              >
                {Array.from({ length: ROWS }, (_, i) => {
                  const minute = DAY_START + i * STEP;
                  const disabled = isPast(ymd, minute) || isTaken(ymd, minute);
                  return (
                    <button
                      key={minute}
                      type="button"
                      tabIndex={-1}
                      disabled={disabled}
                      onClick={() => openBooking(ymd, minute)}
                      aria-label={`จอง ${formatDayShort(ymd)} เวลา ${formatHm(minute)} น.`}
                      className={cn(
                        "block w-full border-t outline-none transition-colors",
                        minute % 60 === 0
                          ? "border-border"
                          : "border-border/50",
                        disabled
                          ? "cursor-not-allowed bg-muted/50"
                          : "cursor-pointer hover:bg-primary/10 focus-visible:bg-primary/10",
                      )}
                      style={{ height: ROW_H }}
                    />
                  );
                })}

                {roomBookings.map((b) => {
                  const seg = segmentOn(b, ymd);
                  if (!seg) return null;
                  const start = Math.max(seg.start, DAY_START);
                  const end = Math.min(seg.end, DAY_END);
                  if (end <= start) return null;
                  const pending = b.status === "pending";
                  const mine = userId !== null && b.applicant_id === userId;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setDetailId(b.id)}
                      className={cn(
                        "absolute inset-x-0.5 z-10 overflow-hidden rounded-md px-1.5 py-1 text-left text-xs leading-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/60",
                        pending
                          ? "border border-amber-800/50 bg-amber-50 text-amber-900"
                          : "border border-primary/40 bg-primary/10 text-foreground",
                        mine && "ring-1 ring-primary",
                      )}
                      style={{
                        top: ((start - DAY_START) / STEP) * ROW_H + 1,
                        height: ((end - start) / STEP) * ROW_H - 2,
                      }}
                    >
                      <span className="block font-medium">{b.purpose}</span>
                      <span className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground">
                        {formatHm(seg.start)}-{formatHm(seg.end)}
                        {pending && (
                          <span className="inline-flex items-center gap-0.5">
                            <Clock className="size-3" aria-hidden />
                            รออนุมัติ
                          </span>
                        )}
                        {mine && (
                          <span className="inline-flex items-center gap-0.5">
                            <User className="size-3" aria-hidden />
                            ของฉัน
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}

                {ymd === today &&
                  nowMin !== null &&
                  nowMin >= DAY_START &&
                  nowMin <= DAY_END && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-500"
                      style={{ top: ((nowMin - DAY_START) / STEP) * ROW_H }}
                    />
                  )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="hidden flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground md:flex">
        <span className="flex items-center gap-1.5">
          <span
            className="size-3.5 rounded-sm border border-primary/40 bg-primary/10"
            aria-hidden
          />{" "}
          จองแล้ว
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="size-3.5 rounded-sm border border-amber-800/50 bg-amber-50"
            aria-hidden
          />{" "}
          รออนุมัติ (ล็อกคิวไว้ระหว่างรอ)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3.5 rounded-sm ring-1 ring-primary" aria-hidden />{" "}
          ของฉัน
        </span>
      </p>

      <BookingDialog
        open={defaults !== null}
        onClose={() => setDefaults(null)}
        rooms={rooms}
        bookings={bookings}
        defaults={defaults}
      />
      <BookingDetailDialog
        booking={detail}
        room={rooms.find((r) => r.id === detail?.room_id)}
        mine={userId !== null && detail?.applicant_id === userId}
        isStaff={isStaff}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
