"use client";

import { useActionState, useEffect, useRef } from "react";

import { cancelCleaning, type ConfirmResult } from "@/app/(dashboard)/cleaning/actions";
import { CancelConfirmation } from "@/components/cleaning/cancel-confirmation";
import { cn } from "@/lib/utils";

/**
 * "ยกเลิกการยืนยัน" for today and yesterday, right on the home page. Only a confirmed day is listed;
 * the server still checks that the person advises the room and that the day is cancellable. The result
 * is shown here, because the cancel control disappears once its day is cancelled.
 */
export function CancelDays({
  classroomId,
  days,
}: {
  classroomId: string;
  days: { ymd: string; word: string; hasPhotos: boolean }[];
}) {
  const [state, action, pending] = useActionState<ConfirmResult | null, FormData>(cancelCleaning, null);
  const resultRef = useRef<HTMLParagraphElement>(null);
  // A successful cancel removes the button that had focus, so the result takes it.
  useEffect(() => {
    if (state?.ok) resultRef.current?.focus();
  }, [state]);
  return (
    <div className="space-y-2 [&:not(:empty)]:mt-3">
      {days.map((d) => (
        <CancelConfirmation
          key={d.ymd}
          classroomId={classroomId}
          day={d.ymd}
          dayWord={d.word}
          hasPhotos={d.hasPhotos}
          action={action}
          pending={pending}
        />
      ))}
      {state && (
        <p
          ref={resultRef}
          tabIndex={-1}
          role={state.ok ? "status" : "alert"}
          className={cn(
            "rounded-lg p-3 text-sm outline-none",
            state.ok
              ? "border border-emerald-500/40 bg-emerald-500/10"
              : "border border-destructive/40 bg-destructive/5 text-destructive",
          )}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
