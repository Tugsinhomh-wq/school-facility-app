"use client";

import { ChevronDown, Clock, FileText, Minus, Plus, Zap } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import { createMemoFromReservation, createReservation, type BookingResult } from "@/app/(dashboard)/meeting-rooms/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Booking, RoomInfo } from "@/lib/data/rooms";
import { findConflict } from "@/lib/meeting";
import { equipmentGroupsFor } from "@/lib/meeting-equipment";
import { formatDayLong, formatHm } from "@/lib/time";
import { cn } from "@/lib/utils";

const SUGGEST = ["ประชุมกลุ่มสาระ", "อบรมครู", "ประชุมผู้ปกครอง", "ซ้อมกิจกรรม"];

const chip =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-input bg-card px-3.5 text-sm leading-tight outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

/** The booking action of the whole page: orange, the only orange on it. */
export const nextClass =
  "h-14 text-base font-semibold bg-orange-600 text-black hover:bg-orange-700 hover:text-white disabled:bg-muted disabled:text-muted-foreground";

const lengthText = (min: number) => (min < 60 ? `${min} นาที` : `${Math.floor(min / 60)} ชม.${min % 60 ? ` ${min % 60} นาที` : ""}`);

/**
 * Step 3 of the booking page. The room, day and time are decided by now, so this only asks what the booking is for.
 * It posts the same action as before and shows the result in place: a booking made, or a request waiting for approval.
 */
export function BookingDetails({
  room,
  bookings,
  ymd,
  start,
  end,
  onBack,
  onAgain,
}: {
  room: RoomInfo;
  bookings: Booking[];
  ymd: string;
  start: number;
  end: number;
  onBack: () => void;
  onAgain: () => void;
}) {
  const [state, action, pending] = useActionState<BookingResult, FormData>(createReservation, null);
  const [purpose, setPurpose] = useState("");
  const [attendees, setAttendees] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  // Someone else may book this slot while the form is open: `bookings` refreshes live, so this reacts at once.
  const conflict = useMemo(() => findConflict(bookings, room.id, ymd, start, end), [bookings, room.id, ymd, start, end]);
  const tooMany = Boolean(room.capacity && attendees && Number(attendees) > room.capacity);
  const groups = equipmentGroupsFor(room.room_number, room.equipment);
  const toggle = (e: string) => setPicked((p) => (p.includes(e) ? p.filter((x) => x !== e) : [...p, e]));
  const bump = (by: number) => setAttendees(String(Math.max(1, (Number(attendees) || 0) + by)));

  if (state?.ok) {
    const wait = state.status === "pending";
    return (
      <div className="grid justify-items-center gap-4 py-6 text-center" role="status">
        <span className={cn("grid size-16 place-items-center rounded-full", wait ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900")}>
          {wait ? <Clock className="size-8" aria-hidden /> : <Zap className="size-8" aria-hidden />}
        </span>
        <h2 className="font-display text-2xl font-semibold">{wait ? "ส่งคำขอแล้ว" : "จองห้องเรียบร้อย"}</h2>
        <p className="text-muted-foreground">{state.message}</p>
        <p>
          {room.name}
          <br />
          {formatDayLong(ymd)} {formatHm(start)} – {formatHm(end)} น.
        </p>
        {wait && state.reservationId && (
          <>
            <p className="max-w-[32ch] text-sm text-muted-foreground">ห้องนี้ต้องให้ ผอ. อนุมัติ เตรียมบันทึกข้อความเสนอได้เลย ระบบร่างให้จากข้อมูลที่กรอก</p>
            <form action={createMemoFromReservation} className="w-full max-w-sm">
              <input type="hidden" name="reservation_id" value={state.reservationId} />
              <Button type="submit" variant="outline" className="h-12 w-full gap-2">
                <FileText className="size-5" aria-hidden />
                ร่างบันทึกข้อความเสนอ ผอ.
              </Button>
            </form>
          </>
        )}
        <Button type="button" className={cn(nextClass, "w-full max-w-sm")} onClick={onAgain}>
          จองห้องอื่นต่อ
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="room_id" value={room.id} />
      <input type="hidden" name="date" value={ymd} />
      <input type="hidden" name="start" value={start} />
      <input type="hidden" name="end" value={end} />

      <div className="grid gap-1 rounded-md bg-primary/10 p-4">
        <p className="font-display text-lg leading-snug font-semibold text-primary">{room.name}</p>
        <p>
          {formatDayLong(ymd)} · {formatHm(start)} – {formatHm(end)} น. ({lengthText(end - start)})
        </p>
        <p className={cn("mt-1 inline-flex items-center gap-1.5 text-sm font-medium", room.requires_approval ? "text-amber-800" : "text-emerald-800")}>
          {room.requires_approval ? <Clock className="size-4" aria-hidden /> : <Zap className="size-4" aria-hidden />}
          {room.requires_approval ? "ต้องรอ ผอ. อนุมัติ คำขอจะอยู่สถานะรออนุมัติ" : "จองแล้วได้ทันที ระบบล็อกคิวให้เลย"}
        </p>
      </div>

      {conflict && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          ช่วงเวลานี้เพิ่งมีคนจอง “{conflict.purpose}” ({conflict.status === "pending" ? "รออนุมัติ" : "จองแล้ว"}) กลับไปเลือกห้องหรือเวลาใหม่
        </p>
      )}

      <div className="grid gap-2">
        <Label htmlFor="purpose">ชื่อการประชุมหรือกิจกรรม</Label>
        <Input id="purpose" name="purpose" required maxLength={200} autoComplete="off" value={purpose} onChange={(e) => setPurpose(e.target.value)} className="h-12 rounded-md text-base" placeholder="เช่น ประชุมกลุ่มสาระวิทยาศาสตร์" />
        <div className="flex flex-wrap gap-2" role="group" aria-label="ตัวอย่างชื่อ">
          {SUGGEST.map((s) => (
            <button key={s} type="button" className={chip} onClick={() => setPurpose(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="attendee_count">จำนวนผู้เข้าร่วม (คน)</Label>
        <div className="flex items-center">
          <button type="button" aria-label="ลดจำนวนคน" onClick={() => bump(-1)} className="grid size-12 place-items-center rounded-l-md border border-input bg-card outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
            <Minus className="size-5" aria-hidden />
          </button>
          <Input
            id="attendee_count"
            name="attendee_count"
            type="number"
            min={1}
            max={room.capacity ?? undefined}
            inputMode="numeric"
            placeholder="ไม่ระบุ"
            value={attendees}
            onChange={(e) => setAttendees(e.target.value)}
            className="h-12 w-24 rounded-none border-x-0 text-center text-lg font-medium"
          />
          <button type="button" aria-label="เพิ่มจำนวนคน" onClick={() => bump(1)} className="grid size-12 place-items-center rounded-r-md border border-input bg-card outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
            <Plus className="size-5" aria-hidden />
          </button>
        </div>
        {tooMany && (
          <p role="alert" className="text-sm text-destructive">
            ห้องนี้รองรับได้ {room.capacity} คน
          </p>
        )}
      </div>

      <details className="group rounded-md border border-input bg-card">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
          ต้องการอุปกรณ์เพิ่ม
          <span className="text-sm font-normal text-muted-foreground">{picked.length ? `เลือกแล้ว ${picked.length} อย่าง` : "ไม่บังคับ"}</span>
          <ChevronDown className="ml-auto size-5 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="grid gap-4 px-4 pt-1 pb-4">
          {groups.map((g) => (
            <div key={g.title} className="grid gap-1.5">
              <p className="text-sm text-muted-foreground">{g.title}</p>
              <div className="flex flex-wrap gap-2">
                {g.items.map((eq) => (
                  <label key={eq} className={cn(chip, "relative cursor-pointer has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50")}>
                    <input type="checkbox" name="equipment" value={eq} checked={picked.includes(eq)} onChange={() => toggle(eq)} className="absolute inset-0 cursor-pointer opacity-0" />
                    {eq}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="grid gap-2">
            <Label htmlFor="equipment_other">อื่น ๆ</Label>
            <Input id="equipment_other" name="equipment_other" maxLength={200} className="h-12 rounded-md text-base" placeholder="ถ้ามี" />
          </div>
        </div>
      </details>

      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <div className="grid gap-2">
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-14 rounded-md px-5 text-base" onClick={onBack}>
            เปลี่ยนห้อง
          </Button>
          <Button type="submit" disabled={pending || Boolean(conflict) || tooMany} className={cn(nextClass, "flex-1 rounded-md")}>
            {pending ? "กำลังส่ง..." : room.requires_approval ? "ส่งคำขอใช้ห้อง" : "จองห้อง"}
          </Button>
        </div>
        {room.requires_approval && <p className="text-center text-sm text-muted-foreground">ห้องนี้ต้องให้ ผอ. อนุมัติก่อนจึงจะใช้ได้</p>}
      </div>
    </form>
  );
}
