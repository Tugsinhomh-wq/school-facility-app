"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { trashTickets } from "@/app/(dashboard)/tickets/actions";
import { Button } from "@/components/ui/button";

const boxes = () =>
  Array.from(
    document.querySelectorAll<HTMLInputElement>(
      'input[name="ids"][form="bulk-trash"]',
    ),
  );

/** Administrator only: counts the ticked rows and moves them to the trash after a confirmation. */
export function BulkTrashBar() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => setCount(boxes().filter((b) => b.checked).length);
    document.addEventListener("change", update);
    return () => document.removeEventListener("change", update);
  }, []);

  function toggleAll() {
    const all = boxes();
    const next = !all.every((b) => b.checked);
    all.forEach((b) => (b.checked = next));
    setCount(next ? all.length : 0);
  }

  return (
    <form
      id="bulk-trash"
      action={trashTickets}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `ย้าย ${count} งานไปถังขยะ?\nงานที่มีรายงานซ้ำรวมอยู่จะถูกย้ายไปด้วย กู้คืนได้ภายใน 30 วัน`,
          )
        )
          e.preventDefault();
      }}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2"
    >
      <Button type="button" variant="ghost" className="h-11 px-3" onClick={toggleAll}>
        เลือก/ล้างทั้งหมดในหน้านี้
      </Button>
      <span className="text-sm text-muted-foreground" aria-live="polite">
        {count > 0 ? `เลือกแล้ว ${count} งาน` : "ติ๊กงานที่ต้องการลบ"}
      </span>
      <Button
        type="submit"
        variant="outline"
        disabled={count === 0}
        className="ml-auto h-11 px-4 text-destructive disabled:border-dashed disabled:text-muted-foreground disabled:opacity-100"
      >
        <Trash2 aria-hidden />
        ย้ายไปถังขยะ
      </Button>
    </form>
  );
}
