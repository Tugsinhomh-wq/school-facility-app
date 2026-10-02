"use client";

import { Trash2 } from "lucide-react";

import { trashTickets } from "@/app/(dashboard)/tickets/actions";
import { Button } from "@/components/ui/button";

/** Administrator only: moves one ticket to the trash after a confirmation. */
export function TrashButton({ id }: { id: string }) {
  return (
    <form
      action={trashTickets}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "ย้ายงานนี้ไปถังขยะ?\nงานที่มีรายงานซ้ำรวมอยู่จะถูกย้ายไปด้วย กู้คืนได้ภายใน 30 วัน",
          )
        )
          e.preventDefault();
      }}
      className="mt-4 border-t border-border pt-4"
    >
      <input type="hidden" name="ids" value={id} />
      <Button type="submit" variant="ghost" className="w-full text-destructive">
        <Trash2 aria-hidden />
        ย้ายไปถังขยะ
      </Button>
    </form>
  );
}
