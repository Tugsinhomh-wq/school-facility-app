"use client";

import { useActionState } from "react";

import { updateTicket, type UpdateResult } from "@/app/(dashboard)/tickets/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_LABEL } from "@/lib/ticket-meta";
import { cn } from "@/lib/utils";
import type { TicketRow } from "@/types/tickets";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:[&>option]:bg-card";

export function TicketManageForm({ ticket }: { ticket: TicketRow }) {
  const [state, action, pending] = useActionState<UpdateResult, FormData>(updateTicket, null);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={ticket.id} />
      <div className="space-y-1.5">
        <Label htmlFor="status">สถานะ</Label>
        <select id="status" name="status" defaultValue={ticket.status} className={selectClass}>
          {Object.entries(STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="estimated_cost">ค่าใช้จ่ายประมาณการ (บาท)</Label>
        <Input id="estimated_cost" name="estimated_cost" inputMode="decimal" defaultValue={Number(ticket.estimated_cost) || ""} placeholder="0" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="technician_notes">บันทึกช่าง</Label>
        <Textarea id="technician_notes" name="technician_notes" rows={4} defaultValue={ticket.technician_notes ?? ""} placeholder="ผลการตรวจ วัสดุที่ใช้ หรือสิ่งที่ต้องทำต่อ" />
      </div>
      {state && (
        <p role={state.ok ? "status" : "alert"} className={cn("text-sm", state.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
      </Button>
    </form>
  );
}
