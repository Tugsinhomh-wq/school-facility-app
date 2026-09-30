"use client";

import { useActionState, useMemo, useState } from "react";

import { createMemoFromReservation, createReservation, type BookingResult } from "@/app/(dashboard)/meeting-rooms/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Booking, RoomInfo } from "@/lib/data/rooms";
import { DAY_END, DAY_START, findConflict, latestEnd, STEP } from "@/lib/meeting";
import { formatDayLong, formatHm } from "@/lib/time";
import { cn } from "@/lib/utils";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:[&>option]:bg-card";

export interface BookingDefaults {
  roomId: string;
  ymd: string;
  start: number;
}

const range = (from: number, to: number) => Array.from({ length: Math.max(0, Math.floor((to - from) / STEP)) + 1 }, (_, i) => from + i * STEP);

function BookingForm({ rooms, bookings, defaults, onDone }: { rooms: RoomInfo[]; bookings: Booking[]; defaults: BookingDefaults; onDone: () => void }) {
  const [roomId, setRoomId] = useState(defaults.roomId);
  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(() => Math.min(defaults.start + 60, latestEnd(bookings, defaults.roomId, defaults.ymd, defaults.start)));
  const [attendees, setAttendees] = useState("");
  const [state, action, pending] = useActionState<BookingResult, FormData>(createReservation, null);

  const room = rooms.find((r) => r.id === roomId) ?? rooms[0];
  const ymd = defaults.ymd;

  // Real-time conflict check: `bookings` is refreshed whenever anyone books, so this reacts live.
  const conflict = useMemo(() => findConflict(bookings, roomId, ymd, start, end), [bookings, roomId, ymd, start, end]);
  const maxEnd = latestEnd(bookings, roomId, ymd, start);
  const tooMany = Boolean(room?.capacity && attendees && Number(attendees) > room.capacity);

  function changeRoom(id: string) {
    setRoomId(id);
    setEnd((e) => Math.min(Math.max(e, start + STEP), latestEnd(bookings, id, ymd, start)) || start + STEP);
  }
  function changeStart(value: number) {
    setStart(value);
    setEnd((e) => Math.min(Math.max(e, value + STEP), Math.max(value + STEP, latestEnd(bookings, roomId, ymd, value))));
  }

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <p role="status" className="font-medium">{state.message}</p>
        {state.status === "pending" && state.reservationId && (
          <>
            <p className="text-sm text-muted-foreground">ห้องนี้ต้องได้รับอนุมัติ เตรียมบันทึกข้อความเสนอผู้อำนวยการได้เลย ระบบร่างให้จากข้อมูลที่กรอก</p>
            <form action={createMemoFromReservation}>
              <input type="hidden" name="reservation_id" value={state.reservationId} />
              <Button type="submit" className="w-full">ร่างบันทึกข้อความเสนอ ผอ. (PDF/Word)</Button>
            </form>
          </>
        )}
        <Button variant="outline" className="w-full" onClick={onDone}>ปิด</Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="date" value={ymd} />
      <input type="hidden" name="start" value={start} />
      <input type="hidden" name="end" value={end} />

      <div className="space-y-1.5">
        <Label htmlFor="room_id">ห้อง</Label>
        <select id="room_id" name="room_id" value={roomId} onChange={(e) => changeRoom(e.target.value)} className={selectClass}>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}{r.building_name !== r.name || r.capacity ? ` (${[r.building_name !== r.name ? r.building_name : null, r.capacity ? `${r.capacity} ที่นั่ง` : null].filter(Boolean).join(", ")})` : ""}
            </option>
          ))}
        </select>
        <p className={cn("text-xs", room?.requires_approval ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300")}>
          {room?.requires_approval ? "ห้องนี้ต้องให้ ผอ. อนุมัติ คำขอจะอยู่สถานะรออนุมัติ" : "จองแล้วได้ทันที ระบบล็อกคิวให้เลย"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="start_sel">เริ่ม</Label>
          <select id="start_sel" value={start} onChange={(e) => changeStart(Number(e.target.value))} className={selectClass}>
            {range(DAY_START, DAY_END - STEP).map((m) => (
              <option key={m} value={m}>{formatHm(m)} น.</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="end_sel">สิ้นสุด</Label>
          <select id="end_sel" value={end} onChange={(e) => setEnd(Number(e.target.value))} className={selectClass}>
            {range(start + STEP, Math.max(start + STEP, maxEnd)).map((m) => (
              <option key={m} value={m}>{formatHm(m)} น.</option>
            ))}
          </select>
        </div>
      </div>

      {conflict && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-2.5 text-sm text-destructive">
          เวลานี้ชนกับ “{conflict.purpose}” ({conflict.status === "pending" ? "รออนุมัติ" : "จองแล้ว"}) เลือกเวลาหรือห้องอื่น
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="purpose">วัตถุประสงค์ (ชื่อการประชุม)</Label>
        <Input id="purpose" name="purpose" required maxLength={200} placeholder="เช่น ประชุมกลุ่มสาระวิทยาศาสตร์" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="attendee_count">จำนวนผู้เข้าร่วม (คน)</Label>
        <Input id="attendee_count" name="attendee_count" type="number" min={1} max={room?.capacity ?? undefined} inputMode="numeric" value={attendees} onChange={(e) => setAttendees(e.target.value)} />
        {tooMany && <p role="alert" className="text-xs text-destructive">ห้องนี้รองรับได้ {room?.capacity} คน</p>}
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">อุปกรณ์ที่ต้องการ</legend>
        {room && room.equipment.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {room.equipment.map((eq) => (
              <label key={`${room.id}-${eq}`} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="equipment" value={eq} className="size-4 accent-[var(--color-primary)]" />
                {eq}
              </label>
            ))}
          </div>
        )}
        <Textarea name="equipment_other" rows={2} maxLength={200} placeholder="อื่น ๆ (ถ้ามี)" aria-label="อุปกรณ์อื่น ๆ" />
      </fieldset>

      {state && !state.ok && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
      <Button type="submit" disabled={pending || Boolean(conflict) || tooMany} className="w-full">
        {pending ? "กำลังส่ง..." : room?.requires_approval ? "ส่งคำขอใช้ห้อง" : "จองห้อง"}
      </Button>
    </form>
  );
}

export function BookingDialog({ open, onClose, rooms, bookings, defaults }: { open: boolean; onClose: () => void; rooms: RoomInfo[]; bookings: Booking[]; defaults: BookingDefaults | null }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ขอใช้ห้องประชุม</DialogTitle>
          <DialogDescription>{defaults ? formatDayLong(defaults.ymd) : ""}</DialogDescription>
        </DialogHeader>
        {/* Remounted per slot so each booking starts from a clean form. */}
        {defaults && <BookingForm key={`${defaults.roomId}-${defaults.ymd}-${defaults.start}`} rooms={rooms} bookings={bookings} defaults={defaults} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
