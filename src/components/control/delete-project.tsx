"use client";

import { ChevronDown } from "lucide-react";
import { useActionState } from "react";

import { deleteProject, type ControlResult } from "@/app/(dashboard)/control/actions";
import { Result } from "@/components/control/form-kit";
import { Button } from "@/components/ui/button";

/**
 * Remove the project, behind a confirmation: opening the section is the first click, the red button
 * inside is the second. On success the server redirects to the list (this page would be a 404).
 * Shown only to whoever may edit the project; the server checks that again.
 */
export function DeleteProject({ projectId, name, measures }: { projectId: string; name: string; measures: number }) {
  const [state, run, pending] = useActionState<ControlResult, FormData>((_prev, formData) => deleteProject(formData), null);
  return (
    <details className="group rounded-xl border border-border">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 font-medium text-destructive outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <span className="flex-1">ลบโครงการนี้</span>
        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <form action={run} className="space-y-3 border-t border-border px-4 py-4">
        <input type="hidden" name="id" value={projectId} />
        <p className="break-words">
          ลบโครงการ &ldquo;{name || "(ไม่มีชื่อ)"}&rdquo;
          {measures > 0 ? ` พร้อมมาตรการปรับปรุง ${measures} รายการ` : ""} ลบแล้วเอากลับคืนไม่ได้
        </p>
        <Result state={state} />
        <Button type="submit" variant="destructive" disabled={pending} className="h-11 w-full sm:w-auto">
          {pending ? "กำลังลบ..." : "ยืนยันลบโครงการ"}
        </Button>
      </form>
    </details>
  );
}
