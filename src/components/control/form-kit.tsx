"use client";

import { startTransition, useActionState, useRef, type FormEvent, type ReactNode } from "react";

import type { ControlResult } from "@/app/(dashboard)/control/actions";
import { Label } from "@/components/ui/label";
import { withSubmitter } from "@/lib/control/form-data";
import { cn } from "@/lib/utils";

// Shared pieces of the internal-control forms: field sizes (44px targets), a labelled field, the
// action's answer, and the hook that submits a form by hand.

// A closed (read-only) field keeps full contrast: its text is the thing being read.
export const fieldClass = "h-11 text-base disabled:bg-muted/50 disabled:opacity-100";
export const areaClass = "min-h-24 text-base disabled:bg-muted/50 disabled:opacity-100";
export const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-muted/50 md:text-sm";

export const sectionHeading = "text-sm font-medium text-muted-foreground";

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/** The action's answer, announced to screen readers. */
export function Result({ state }: { state: ControlResult }) {
  if (!state) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={cn("text-sm", state.ok ? "text-emerald-800" : "text-destructive")}>
      {state.message}
    </p>
  );
}

type Run = (prev: ControlResult, formData: FormData) => Promise<ControlResult>;

/**
 * A server action, submitted by hand: a plain form `action` clears every field even when the save is
 * refused, and a long project form would have to be typed again. The button that was pressed is part
 * of the data (the review form tells "save" from "confirm" by it).
 */
export function useControlAction(run: Run, resetOnOk = false) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, dispatch, pending] = useActionState<ControlResult, FormData>(async (prev, formData) => {
    const r = await run(prev, formData);
    if (r?.ok && resetOnOk) ref.current?.reset();
    return r;
  }, null);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    // Older browsers ignore the 2nd argument; withSubmitter adds the pressed button then.
    const data = withSubmitter(new FormData(e.currentTarget, submitter), submitter);
    startTransition(() => dispatch(data));
  };
  return { ref, state, pending, onSubmit };
}
