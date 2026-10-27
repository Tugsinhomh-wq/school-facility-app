"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * "ยกเลิกการยืนยัน" for one confirmed day of the teacher's own room. A quiet link first, then a
 * sentence with two buttons so a stray tap cannot delete anything. `action` is the form action of
 * the card (it owns the result message, because this control disappears once the day is cancelled).
 * While pending the buttons stay focusable (aria-disabled) so focus is not thrown away.
 */
export function CancelConfirmation({
  classroomId,
  day,
  dayWord,
  hasPhotos,
  action,
  pending,
}: {
  classroomId: string;
  day: string;
  /** "วันนี้" or "เมื่อวาน". */
  dayWord: string;
  hasPhotos: boolean;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const yesRef = useRef<HTMLButtonElement>(null);

  // Move focus into the question when it opens, so a keyboard user lands on the new choice.
  useEffect(() => {
    if (asking) yesRef.current?.focus();
  }, [asking]);

  if (!asking)
    return (
      <Button
        type="button"
        variant="ghost"
        className="h-11 px-3 text-sm text-muted-foreground"
        onClick={() => setAsking(true)}
      >
        ยกเลิกการยืนยัน
        <span className="sr-only">ของ{dayWord}</span>
      </Button>
    );

  return (
    <form
      action={action}
      onSubmit={(e) => pending && e.preventDefault()}
      className="space-y-2 rounded-lg border border-border p-3"
    >
      <input type="hidden" name="classroom_id" value={classroomId} />
      <input type="hidden" name="day" value={day} />
      <p id={`cancel-${day}`} className="text-sm leading-snug">
        ยกเลิกการยืนยันของ{dayWord}ใช่ไหม{hasPhotos && " รูปที่แนบไว้จะถูกลบด้วย"}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          ref={yesRef}
          type="submit"
          aria-disabled={pending}
          aria-describedby={`cancel-${day}`}
          className="h-11 px-4"
        >
          {pending ? "กำลังยกเลิก..." : "ยืนยันยกเลิก"}
        </Button>
        <Button
          type="button"
          variant="outline"
          aria-disabled={pending}
          onClick={() => !pending && setAsking(false)}
          className="h-11 px-4"
        >
          ไม่ยกเลิก
        </Button>
      </div>
    </form>
  );
}
