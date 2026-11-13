"use client";

import { useActionState } from "react";

import { confirmCleaning, type ConfirmResult } from "@/app/(dashboard)/cleaning/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The one-tap confirmation on the home page. It posts the same action as the cleaning page, with no
 * `day` (the server uses its own Bangkok date). Photos and late days stay on /cleaning.
 */
export function ConfirmToday({ classroomId }: { classroomId: string }) {
  const [state, action, pending] = useActionState<ConfirmResult | null, FormData>(confirmCleaning, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="classroom_id" value={classroomId} />
      <Button
        type="submit"
        disabled={pending}
        className="h-13 w-full rounded-full px-8 text-base font-semibold sm:w-auto"
      >
        {pending ? "กำลังบันทึก..." : "ยืนยันเขตวันนี้"}
      </Button>
      {state && (
        <p
          role={state.ok ? "status" : "alert"}
          className={cn(
            "rounded-lg p-3 text-sm",
            state.ok
              ? "border border-emerald-500/40 bg-emerald-500/10"
              : "border border-destructive/40 bg-destructive/5 text-destructive",
          )}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
