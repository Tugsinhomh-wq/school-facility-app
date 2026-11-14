"use client";

import { useActionState, useState } from "react";

import { confirmCleaning, type ConfirmResult } from "@/app/(dashboard)/cleaning/actions";
import { ImagePicker } from "@/components/tickets/image-picker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The one-tap confirmation on the home page. It posts the same action as the cleaning page, with no
 * `day` (the server uses its own Bangkok date). At least one photo is required: take one with the
 * camera or pick from the phone, then confirm. Late days stay on /cleaning.
 */
export function ConfirmToday({ classroomId }: { classroomId: string }) {
  const [state, action, pending] = useActionState<ConfirmResult | null, FormData>(confirmCleaning, null);
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState(0);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="classroom_id" value={classroomId} />
      <ImagePicker
        bucket="cleaning-photos"
        fieldName="photo_paths"
        label="รูปเขต (ต้องมีอย่างน้อย 1 รูป)"
        maxImages={4}
        camera
        onBusyChange={setBusy}
        onCountChange={setPhotos}
      />
      <Button
        type="submit"
        disabled={pending || busy || photos < 1}
        aria-describedby={photos < 1 ? "confirm-today-hint" : undefined}
        className="h-13 w-full rounded-full px-8 text-base font-semibold sm:w-auto"
      >
        {pending ? "กำลังบันทึก..." : busy ? "กำลังอัปโหลดรูป..." : "ยืนยันเขตวันนี้"}
      </Button>
      {photos < 1 && !busy && (
        <p id="confirm-today-hint" className="text-sm text-muted-foreground">
          ถ่ายรูปหรือเลือกรูปเขตอย่างน้อย 1 รูป แล้วจึงกดยืนยันได้
        </p>
      )}
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
