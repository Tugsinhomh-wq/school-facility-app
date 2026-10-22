import { AlertTriangle, CheckCircle2, Lock } from "lucide-react";

import type { CensusResult } from "@/app/(dashboard)/census/actions";
import { cn } from "@/lib/utils";

// Shared pieces of the /census pages: the privacy line and the action's answer.

/** One quiet line under the title of every page that shows or handles names. */
export function PrivacyNotice() {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
      ข้อมูลส่วนบุคคลของนักเรียน ใช้เฉพาะงานของห้องเรียน ห้ามคัดลอกหรือส่งต่อ
    </p>
  );
}

/**
 * The action's answer, announced to screen readers: icon and words, never colour alone. An import
 * shows its counts; import errors are quiet rows by spreadsheet row, past the first ones "และอีก M รายการ".
 */
export function Result({ state }: { state: CensusResult }) {
  if (!state) return null;
  const Icon = state.ok ? CheckCircle2 : AlertTriangle;
  const { counts, errors, more } = state;
  return (
    <div role={state.ok ? "status" : "alert"} className={cn("space-y-2 text-sm", state.ok ? "text-emerald-800" : "text-destructive")}>
      <p className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="min-w-0 break-words">{counts ? "นำเข้ารายชื่อแล้ว" : state.message}</span>
      </p>
      {counts && (
        <p className="pl-6 tabular-nums">
          เพิ่มใหม่ {counts.added} คน · อัปเดต {counts.updated} คน · รวม {counts.total} คน
        </p>
      )}
      {errors && errors.length > 0 && (
        <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-xl border border-border text-foreground">
          {errors.map((e, i) => (
            <li key={i} className="px-3 py-2 break-words">
              <span className="font-medium tabular-nums">แถว {e.row}:</span> {e.message}
            </li>
          ))}
          {!!more && <li className="px-3 py-2 text-muted-foreground tabular-nums">และอีก {more} รายการ</li>}
        </ul>
      )}
    </div>
  );
}
