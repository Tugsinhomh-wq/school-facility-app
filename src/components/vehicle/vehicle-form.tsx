"use client";

import { ChevronDown, Clock, Zap } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import { createVehicleRequest, type VehicleResult } from "@/app/(dashboard)/vehicles/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDays, atBangkok, formatDayLong, formatDayShort, formatHm } from "@/lib/time";
import { FIRST_MIN, LAST_MIN, MAX_TRIP_DAYS, STEP, findVehicleConflict, tripLength, type VehicleBooking, type VehicleInfo } from "@/lib/vehicle";
import { cn } from "@/lib/utils";

const focusRing = "outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
const selectClass = `h-12 w-full appearance-none rounded-md border border-input bg-card px-3.5 pr-10 text-base tabular-nums disabled:opacity-50 ${focusRing}`;
const TIMES = Array.from({ length: (LAST_MIN - FIRST_MIN) / STEP + 1 }, (_, i) => FIRST_MIN + i * STEP);
/** How far ahead a departure day can be picked. */
const AHEAD_DAYS = 120;

function Pick({ id, label, value, onChange, children }: { id: string; label: string; value: string | number; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      </div>
    </div>
  );
}

/**
 * The request form for one vehicle. Departure and return (a day and a time each) are chosen here and are controlled by
 * the page, so the calendar can show them as a highlighted range. It posts the same action whether or not the vehicle needs approval.
 */
export function VehicleForm({
  vehicle,
  bookings,
  today,
  startYmd,
  startMin,
  endYmd,
  endMin,
  onChange,
  onAgain,
  onClear,
}: {
  vehicle: VehicleInfo;
  bookings: VehicleBooking[];
  /** Today in Bangkok, or the shown week's Monday until the clock is read. */
  today: string;
  startYmd: string;
  startMin: number;
  endYmd: string;
  endMin: number;
  onChange: (next: { startYmd?: string; startMin?: number; endYmd?: string; endMin?: number }) => void;
  onAgain: () => void;
  onClear: () => void;
}) {
  const [state, action, pending] = useActionState<VehicleResult, FormData>(createVehicleRequest, null);
  const [passengers, setPassengers] = useState("");

  const start = atBangkok(startYmd, startMin).getTime();
  const end = atBangkok(endYmd, endMin).getTime();
  const conflict = useMemo(() => (end > start ? findVehicleConflict(bookings, vehicle.id, start, end) : undefined), [bookings, vehicle.id, start, end]);
  const tooMany = Boolean(vehicle.seats && passengers && Number(passengers) > vehicle.seats);
  const badOrder = end <= start;

  const departDays = Array.from({ length: AHEAD_DAYS }, (_, i) => addDays(today, i));
  if (!departDays.includes(startYmd)) departDays.unshift(startYmd);
  const returnDays = Array.from({ length: MAX_TRIP_DAYS }, (_, i) => addDays(startYmd, i));
  if (!returnDays.includes(endYmd)) returnDays.push(endYmd);

  if (state?.ok) {
    const wait = state.status === "pending";
    return (
      <div className="grid justify-items-center gap-4 py-6 text-center" role="status">
        <span className={cn("grid size-16 place-items-center rounded-full", wait ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900")}>
          {wait ? <Clock className="size-8" aria-hidden /> : <Zap className="size-8" aria-hidden />}
        </span>
        <h3 className="font-display text-2xl font-semibold">{wait ? "ส่งคำขอแล้ว" : "จองรถเรียบร้อย"}</h3>
        <p className="text-muted-foreground">{state.message}</p>
        <p>
          {vehicle.name}
          <br />
          {formatDayLong(startYmd)} {formatHm(startMin)} น.
          <br />
          ถึง {formatDayLong(endYmd)} {formatHm(endMin)} น.
        </p>
        <Button type="button" className="h-12 w-full max-w-sm" onClick={onAgain}>
          จองรถคันอื่นต่อ
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="vehicle_id" value={vehicle.id} />

      <div className="grid gap-1 rounded-md bg-primary/10 p-4">
        <p className="font-display text-lg leading-snug font-semibold text-primary">{vehicle.name}</p>
        <p className="tabular-nums">
          {formatDayShort(startYmd)} {formatHm(startMin)} น. ถึง {formatDayShort(endYmd)} {formatHm(endMin)} น.
        </p>
        {!badOrder && <p className="text-sm text-muted-foreground">{tripLength(startYmd, endYmd)}</p>}
        <p className={cn("mt-1 inline-flex items-center gap-1.5 text-sm font-medium", vehicle.requires_approval ? "text-amber-800" : "text-emerald-800")}>
          {vehicle.requires_approval ? <Clock className="size-4" aria-hidden /> : <Zap className="size-4" aria-hidden />}
          {vehicle.requires_approval ? "ต้องรอ ผอ. อนุมัติ คำขอจะอยู่สถานะรออนุมัติ" : "จองแล้วได้ทันที ระบบล็อกวันให้เลย"}
        </p>
      </div>

      {conflict && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          ช่วงนี้มีคนจอง “{conflict.purpose}” ({conflict.status === "pending" ? "รออนุมัติ" : "จองแล้ว"}) ไว้แล้ว เลือกวันหรือเวลาอื่น
        </p>
      )}
      {badOrder && !conflict && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          เวลากลับต้องหลังเวลาออกรถ
        </p>
      )}

      <fieldset className="grid gap-3">
        <legend className="mb-1 font-medium">ออกรถ</legend>
        <div className="grid grid-cols-[1fr_8.5rem] gap-3">
          <Pick id="start-date" label="วัน" value={startYmd} onChange={(v) => onChange({ startYmd: v })}>
            {departDays.map((d) => (
              <option key={d} value={d}>
                {formatDayShort(d)}
              </option>
            ))}
          </Pick>
          <Pick id="start-min" label="เวลา" value={startMin} onChange={(v) => onChange({ startMin: Number(v) })}>
            {TIMES.map((m) => (
              <option key={m} value={m}>
                {formatHm(m)} น.
              </option>
            ))}
          </Pick>
        </div>
        <input type="hidden" name="start_date" value={startYmd} />
        <input type="hidden" name="start_min" value={startMin} />
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-1 font-medium">กลับ</legend>
        <div className="grid grid-cols-[1fr_8.5rem] gap-3">
          <Pick id="end-date" label="วัน" value={endYmd} onChange={(v) => onChange({ endYmd: v })}>
            {returnDays.map((d) => (
              <option key={d} value={d}>
                {formatDayShort(d)}
              </option>
            ))}
          </Pick>
          <Pick id="end-min" label="เวลา" value={endMin} onChange={(v) => onChange({ endMin: Number(v) })}>
            {TIMES.map((m) => (
              <option key={m} value={m}>
                {formatHm(m)} น.
              </option>
            ))}
          </Pick>
        </div>
        <input type="hidden" name="end_date" value={endYmd} />
        <input type="hidden" name="end_min" value={endMin} />
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor="destination">จุดหมายปลายทาง</Label>
        <Input id="destination" name="destination" required maxLength={200} autoComplete="off" className="h-12 rounded-md text-base" placeholder="เช่น สนามกีฬาจังหวัด" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="purpose">เรื่องที่ไป</Label>
        <Input id="purpose" name="purpose" required maxLength={200} autoComplete="off" className="h-12 rounded-md text-base" placeholder="เช่น พานักกีฬาไปแข่งขัน" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="passenger_count">ผู้โดยสาร (คน)</Label>
          <Input
            id="passenger_count"
            name="passenger_count"
            type="number"
            required
            min={1}
            max={vehicle.seats ?? 200}
            inputMode="numeric"
            value={passengers}
            onChange={(e) => setPassengers(e.target.value)}
            className="h-12 rounded-md text-base"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="contact_phone">เบอร์ติดต่อ</Label>
          <Input id="contact_phone" name="contact_phone" type="tel" required inputMode="tel" autoComplete="tel" maxLength={20} className="h-12 rounded-md text-base" />
        </div>
      </div>
      {vehicle.seats && <p className={cn("-mt-3 text-sm", tooMany ? "text-destructive" : "text-muted-foreground")}>รถคันนี้นั่งได้ {vehicle.seats} คน</p>}

      {vehicle.has_driver ? (
        <p className="text-sm text-muted-foreground">รถคันนี้มีคนขับประจำ ไม่ต้องระบุผู้ขับ</p>
      ) : (
        <div className="grid gap-2">
          <Label htmlFor="driver_name">ชื่อผู้ขับรถ</Label>
          <Input id="driver_name" name="driver_name" required maxLength={100} autoComplete="off" className="h-12 rounded-md text-base" placeholder="ครูที่ขับรถคันนี้" />
        </div>
      )}

      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-14 rounded-md px-5 text-base" onClick={onClear}>
          เปลี่ยนรถ
        </Button>
        <Button
          type="submit"
          disabled={pending || Boolean(conflict) || badOrder || tooMany}
          className="h-14 flex-1 rounded-md bg-orange-600 text-base font-semibold text-black hover:bg-orange-700 hover:text-white disabled:bg-muted disabled:text-muted-foreground"
        >
          {pending ? "กำลังส่ง..." : vehicle.requires_approval ? "ส่งคำขอใช้รถ" : "จองรถ"}
        </Button>
      </div>
    </form>
  );
}
