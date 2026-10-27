"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { deleteMemo, type SaveResult } from "@/app/(dashboard)/memos/actions";
import { Button } from "@/components/ui/button";

type Ctx = { armed: string | null; busy: boolean; arm: (id: string | null) => void; remove: (id: string) => void };
const DeleteCtx = createContext<Ctx | null>(null);

/**
 * Wraps a memo list (or a memo page) for the system administrator: holds which memo is asked about and
 * the answer. The answer lives here, not in the row, because the row is gone once the list refreshes.
 * `back` is set on the detail page, where a successful delete goes on to the list. The server checks the role.
 */
export function DeleteMemos({ back, children }: { back?: boolean; children: ReactNode }) {
  const [armed, setArmed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SaveResult>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  // The deleted row's button is gone, so focus goes to the answer.
  useEffect(() => resultRef.current?.focus(), [result]);

  function arm(id: string | null) {
    const was = armed;
    setArmed(id);
    // Cancelled: the panel closes, so put focus back on the visible button of that memo.
    if (!id && was)
      queueMicrotask(() =>
        [...document.querySelectorAll<HTMLElement>(`[data-memo-del="${was}"]`)].find((b) => b.offsetParent)?.focus(),
      );
  }

  async function remove(id: string) {
    setBusy(true);
    const form = new FormData();
    form.set("id", id);
    if (back) form.set("back", "1");
    try {
      // A redirect (detail page) resolves to nothing: the page is already on its way to the list.
      const res = await deleteMemo(form);
      if (res) setResult(res);
    } catch {
      setResult({ ok: false, message: "ลบไม่สำเร็จ ลองใหม่อีกครั้ง" });
    }
    setArmed(null);
    setBusy(false);
  }

  const Icon = result?.ok ? CheckCircle2 : AlertTriangle;
  return (
    <DeleteCtx.Provider value={{ armed, busy, arm, remove }}>
      {result && (
        <div
          ref={resultRef}
          tabIndex={-1}
          role={result.ok ? "status" : "alert"}
          className={`mb-3 flex items-start gap-2 text-sm outline-none ${result.ok ? "text-emerald-800" : "text-destructive"}`}
        >
          <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="min-w-0 break-words">{result.message}</span>
        </div>
      )}
      {children}
    </DeleteCtx.Provider>
  );
}

/** The quiet "ลบ", first click. Sits beside the row link, never inside it. */
export function DeleteMemoButton({ id, refNo, className = "" }: { id: string; refNo: string; className?: string }) {
  const ctx = useContext(DeleteCtx);
  if (!ctx) return null;
  return (
    <button
      type="button"
      data-memo-del={id}
      onClick={() => ctx.arm(ctx.armed === id ? null : id)}
      aria-expanded={ctx.armed === id}
      aria-label={`ลบ ${refNo}`}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2 text-sm font-medium text-destructive outline-none hover:bg-destructive/10 focus-visible:ring-3 focus-visible:ring-ring/50 ${className}`}
    >
      ลบ
    </button>
  );
}

/** The second click: names the document and says it is permanent. `row` renders it as a table row. */
export function DeleteMemoPanel({
  id,
  refNo,
  subject,
  row,
  className = "",
}: {
  id: string;
  refNo: string;
  subject: string;
  row?: boolean;
  className?: string;
}) {
  const ctx = useContext(DeleteCtx);
  if (!ctx || ctx.armed !== id) return null;
  const panel = (
    <div className={`space-y-2 ${className}`}>
      <p className="text-sm break-words">
        ลบ {refNo} ({subject}) ถาวรใช่ไหม ลบแล้วกู้คืนไม่ได้ (ยังมีสำเนาในไฟล์สำรองข้อมูลอีก 60 วัน)
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="destructive" disabled={ctx.busy} onClick={() => ctx.remove(id)} className="h-11 px-4">
          {ctx.busy ? "กำลังลบ..." : "ยืนยันลบ"}
        </Button>
        <Button type="button" variant="outline" disabled={ctx.busy} onClick={() => ctx.arm(null)} className="h-11 px-4">
          ยกเลิก
        </Button>
      </div>
    </div>
  );
  return row ? (
    <tr>
      <td colSpan={4} className="px-4 pb-4">
        {panel}
      </td>
    </tr>
  ) : (
    panel
  );
}
