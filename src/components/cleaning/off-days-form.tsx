"use client";

import { X } from "lucide-react";
import { useActionState } from "react";

import {
  removeOffDay,
  setOffDay,
  type SetupResult,
} from "@/app/(dashboard)/cleaning/manage/actions";
import { field, Result } from "@/components/cleaning/classroom-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDayLong } from "@/lib/time";

function OffDayRow({ day, reason }: { day: string; reason: string | null }) {
  const [state, action, pending] = useActionState<SetupResult, FormData>(
    (_, fd) => removeOffDay(fd),
    null,
  );
  const label = formatDayLong(day);
  return (
    <li className="py-2">
      <form action={action} className="flex items-center gap-3">
        <input type="hidden" name="day" value={day} />
        <span className="min-w-0 flex-1">
          <span className="font-medium">{label}</span>
          {reason && (
            <span className="block text-sm text-muted-foreground">
              {reason}
            </span>
          )}
        </span>
        <Button
          type="submit"
          variant="ghost"
          disabled={pending}
          aria-label={`ลบวันหยุด${label}`}
          className="size-11 shrink-0"
        >
          <X className="size-4" aria-hidden />
        </Button>
      </form>
      {state && !state.ok && <Result state={state} />}
    </li>
  );
}

/** School off days (holidays, closures): no class has to confirm on them. Weekends are off already. */
export function OffDaysForm({
  offDays,
}: {
  offDays: { day: string; reason: string | null }[];
}) {
  const [state, action, pending] = useActionState<SetupResult, FormData>(
    setOffDay,
    null,
  );
  return (
    <div className="space-y-3">
      {offDays.length > 0 ? (
        <ul className="divide-y divide-border">
          {offDays.map((o) => (
            <OffDayRow key={o.day} day={o.day} reason={o.reason} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          ยังไม่มีวันหยุดที่กำหนดไว้
        </p>
      )}
      <form action={action} className="space-y-3 border-t border-border pt-3">
        <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <div className="space-y-1.5">
            <Label htmlFor="off-day">วันที่</Label>
            <Input
              id="off-day"
              name="day"
              type="date"
              required
              className={field}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="off-reason">เหตุผล (ไม่บังคับ)</Label>
            <Input
              id="off-reason"
              name="reason"
              maxLength={100}
              placeholder="เช่น วันปิยมหาราช"
              className={field}
            />
          </div>
        </div>
        <Result state={state} />
        <Button
          type="submit"
          disabled={pending}
          className="h-11 w-full sm:w-auto"
        >
          {pending ? "กำลังบันทึก..." : "เพิ่มวันหยุด"}
        </Button>
      </form>
    </div>
  );
}
