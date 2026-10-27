"use client";

import { useActionState } from "react";

import {
  saveCheckWindow,
  type SetupResult,
} from "@/app/(dashboard)/cleaning/manage/actions";
import { field, Result } from "@/components/cleaning/classroom-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { windowText, type CheckWindow } from "@/lib/cleaning";

/**
 * The days the cleaning checks apply to (administrator only; the page does not render it for anyone
 * else and the action and database check the role again). Outside the window nothing is due.
 */
export function CheckWindowForm({ window, today }: { window: CheckWindow; today: string }) {
  const [state, action, pending] = useActionState<SetupResult, FormData>(
    saveCheckWindow,
    null,
  );
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm">ตอนนี้: {windowText(window, today)}</p>
      {/* Keyed by the saved value, so clearing or saving shows what is stored. */}
      <div key={`${window.start}|${window.end}`} className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="check-start">เริ่มเช็กวันที่ (ไม่บังคับ)</Label>
          <Input id="check-start" name="check_start" type="date" defaultValue={window.start ?? ""} className={field} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="check-end">สิ้นสุดวันที่ (ไม่บังคับ)</Label>
          <Input id="check-end" name="check_end" type="date" defaultValue={window.end ?? ""} className={field} />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        วันนอกช่วงนี้ไม่ต้องยืนยันเขตและไม่นับเป็นวันที่ยังไม่ยืนยัน เว้นว่างไว้ = ไม่จำกัดด้านนั้น
      </p>
      <Result state={state} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} className="h-11 w-full sm:w-auto">
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
        <Button
          type="submit"
          name="intent"
          value="clear"
          variant="outline"
          disabled={pending}
          className="h-11 w-full sm:w-auto"
        >
          ล้างช่วง (เช็กทุกวันทำการ)
        </Button>
      </div>
    </form>
  );
}
