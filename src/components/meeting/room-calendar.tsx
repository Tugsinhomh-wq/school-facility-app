"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { BookingDetailDialog } from "@/components/meeting/booking-detail-dialog";
import { BookingDialog, type BookingDefaults } from "@/components/meeting/booking-dialog";
import { Button } from "@/components/ui/button";
import type { Booking, RoomInfo } from "@/lib/data/rooms";
import { DAY_END, DAY_START, segmentOn, STEP } from "@/lib/meeting";
import { addDays, atBangkok, bangkokMinutes, bangkokYmd, formatDayShort, formatHm } from "@/lib/time";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const ROW_H = 28;
const ROWS = (DAY_END - DAY_START) / STEP;
const GRID_H = ROWS * ROW_H;
const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START + i * 60);

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

export function RoomCalendar({ rooms, bookings, weekStart, roomId, userId, isStaff, live }: Props) {
  const router = useRouter();
  const [defaults, setDefaults] = useState<BookingDefaults | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const room = rooms.find((r) => r.id === roomId) ?? rooms[0];
  const roomBookings = useMemo(() => bookings.filter((b) => b.room_id === room?.id), [bookings, room]);
  const detail = bookings.find((b) => b.id === detailId) ?? null;

  // Client-only clock: keeps past slots disabled and draws the "now" line without a hydration mismatch.
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // Real-time: any booking change anywhere re-fetches the week, so conflicts show up immediately.
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!live) return;
    const supabase = createClient();
    const channel = supabase
      .channel("facility-reservations")
      .on("postgres_changes", { event: "*", schema: "public", table: "facility_reservations" }, () => {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => router.refresh(), 300);
      })
      .subscribe();
    return () => {
      clearTimeout(refreshTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [live, router]);

  const today = now ? bangkokYmd(now) : null;
  const nowMin = now ? bangkokMinutes(now) : null;
  const isPast = (ymd: string, minute: number) => (now ? atBangkok(ymd, minute + STEP).getTime() <= now.getTime() : false);
  const isTaken = (ymd: string, minute: number) =>
    roomBookings.some((b) => {
      const seg = segmentOn(b, ymd);
      return seg !== null && seg.start < minute + STEP && seg.end > minute;
    });

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

  const href = (week: string, rid = room?.id) => `/meeting-rooms?week=${week}${rid ? `&room=${rid}` : ""}`;
  const thisWeek = today ? addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7)) : weekStart;

  if (!room) {
    return <p className="rounded-xl border border-dashed border-border bg-card/60 p-10 text-center text-muted-foreground">ยังไม่มีห้องที่เปิดให้ขอใช้ ให้เจ้าหน้าที่ตั้งค่าห้องที่ “เปิดให้จอง” ในฐานข้อมูลก่อน</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="เลือกห้อง" className="flex flex-wrap gap-2">
          {rooms.map((r) => (
            <Link
              key={r.id}
              href={href(weekStart, r.id)}
              role="tab"
              aria-selected={r.id === room.id}
              className={cn("rounded-full border px-3.5 py-1 text-sm transition-colors", r.id === room.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card/80 hover:bg-muted")}
            >
              {r.name}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="icon" nativeButton={false} render={<Link href={href(addDays(weekStart, -7))} aria-label="สัปดาห์ก่อนหน้า" />}>
            <ChevronLeft aria-hidden />
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href={href(thisWeek)} />}>สัปดาห์นี้</Button>
          <Button variant="outline" size="icon" nativeButton={false} render={<Link href={href(addDays(weekStart, 7))} aria-label="สัปดาห์ถัดไป" />}>
            <ChevronRight aria-hidden />
          </Button>
          <Button onClick={openNextFree}><Plus aria-hidden /> จองห้อง</Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {room.name} · {room.building_name}{room.capacity ? ` · ${room.capacity} ที่นั่ง` : ""} ·{" "}
        {room.requires_approval ? "ต้องให้ ผอ. อนุมัติ" : "จองแล้วได้ทันที"}. คลิกช่องว่างเพื่อจอง
      </p>

      <div className="overflow-x-auto rounded-xl border border-border bg-card/85 backdrop-blur-sm">
        <div className="min-w-[46rem]">
          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-border text-center text-sm">
            <div />
            {days.map((ymd) => (
              <div key={ymd} className={cn("py-2", ymd === today && "font-semibold text-primary")}>{formatDayShort(ymd)}</div>
            ))}
          </div>

          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
            <div className="relative" style={{ height: GRID_H }}>
              {HOURS.map((m) => (
                <span key={m} className="absolute right-2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums" style={{ top: ((m - DAY_START) / STEP) * ROW_H }}>
                  {m === DAY_START ? "" : formatHm(m)}
                </span>
              ))}
            </div>

            {days.map((ymd) => (
              <div key={ymd} className="relative border-l border-border" style={{ height: GRID_H }}>
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
                        minute % 60 === 0 ? "border-border" : "border-border/40",
                        disabled ? "cursor-not-allowed bg-muted/30" : "cursor-pointer hover:bg-primary/15 focus-visible:bg-primary/15",
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
                        pending ? "border border-dashed border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200" : "bg-primary text-primary-foreground",
                        mine && "ring-2 ring-[#f2b04a]",
                      )}
                      style={{ top: ((start - DAY_START) / STEP) * ROW_H + 1, height: ((end - start) / STEP) * ROW_H - 2 }}
                    >
                      <span className="block font-medium">{b.purpose}</span>
                      <span className="block opacity-80">{formatHm(seg.start)}-{formatHm(seg.end)}{pending ? " รออนุมัติ" : ""}</span>
                    </button>
                  );
                })}

                {ymd === today && nowMin !== null && nowMin >= DAY_START && nowMin <= DAY_END && (
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-500" style={{ top: ((nowMin - DAY_START) / STEP) * ROW_H }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-primary" aria-hidden /> จองแล้ว</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm border border-dashed border-amber-500 bg-amber-100" aria-hidden /> รออนุมัติ (ล็อกคิวไว้ระหว่างรอ)</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm ring-2 ring-[#f2b04a]" aria-hidden /> ของฉัน</span>
      </p>

      <BookingDialog open={defaults !== null} onClose={() => setDefaults(null)} rooms={rooms} bookings={bookings} defaults={defaults} />
      <BookingDetailDialog booking={detail} room={rooms.find((r) => r.id === detail?.room_id)} mine={userId !== null && detail?.applicant_id === userId} isStaff={isStaff} onClose={() => setDetailId(null)} />
    </div>
  );
}
