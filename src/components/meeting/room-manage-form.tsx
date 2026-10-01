"use client";

import { useActionState } from "react";

import { addRoom, saveRoom, type RoomResult } from "@/app/(dashboard)/meeting-rooms/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ManagedRoom } from "@/lib/data/rooms";
import { cn } from "@/lib/utils";

function Result({ state }: { state: RoomResult }) {
  if (!state) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={cn("text-sm", state.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
      {state.message}
    </p>
  );
}

const check = "size-5 rounded border-input accent-[var(--primary)]";

export function RoomManageForm({ room }: { room: ManagedRoom }) {
  const [state, action, pending] = useActionState<RoomResult, FormData>(saveRoom, null);
  return (
    <form action={action} className="space-y-3 rounded-xl border border-border bg-card/85 p-4">
      <input type="hidden" name="id" value={room.id} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <div className="space-y-1.5">
          <Label htmlFor={`n-${room.id}`}>ชื่อห้อง</Label>
          <Input id={`n-${room.id}`} name="name" defaultValue={room.name} required maxLength={80} className="h-11 text-base" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`c-${room.id}`}>ที่นั่ง</Label>
          <Input id={`c-${room.id}`} name="capacity" inputMode="numeric" defaultValue={room.capacity ?? ""} placeholder="ไม่ระบุ" className="h-11 text-base" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`e-${room.id}`}>อุปกรณ์ (คั่นด้วยจุลภาค)</Label>
        <Input id={`e-${room.id}`} name="equipment" defaultValue={room.equipment.join(", ")} placeholder="โปรเจกเตอร์, ไมค์ลอย" className="h-11 text-base" />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="requires_approval" defaultChecked={room.requires_approval} className={check} />
          ต้องให้ ผอ. อนุมัติ
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_bookable" defaultChecked={room.is_bookable} className={check} />
          เปิดให้จอง
        </label>
      </div>
      <Result state={state} />
      <Button type="submit" disabled={pending} className="h-11 w-full sm:w-auto">{pending ? "กำลังบันทึก..." : "บันทึก"}</Button>
    </form>
  );
}

export function AddRoomForm() {
  const [state, action, pending] = useActionState<RoomResult, FormData>(addRoom, null);
  return (
    <form action={action} className="space-y-3 rounded-xl border border-dashed border-border bg-card/60 p-4">
      <h2 className="text-lg font-semibold">เพิ่มห้อง</h2>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <div className="space-y-1.5">
          <Label htmlFor="new-name">ชื่อห้อง</Label>
          <Input id="new-name" name="name" required maxLength={80} placeholder="เช่น ห้องประชุมจักรี" className="h-11 text-base" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-cap">ที่นั่ง</Label>
          <Input id="new-cap" name="capacity" inputMode="numeric" placeholder="ไม่ระบุ" className="h-11 text-base" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="requires_approval" className={check} />
        ต้องให้ ผอ. อนุมัติ
      </label>
      <Result state={state} />
      <Button type="submit" disabled={pending} className="h-11 w-full sm:w-auto">{pending ? "กำลังเพิ่ม..." : "เพิ่มห้อง"}</Button>
    </form>
  );
}
