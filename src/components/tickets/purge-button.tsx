"use client";

import { Button } from "@/components/ui/button";

/** Permanent delete with a confirmation: this one cannot be undone. */
export function PurgeButton({
  id,
  action,
}: {
  id: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("ลบถาวร? งานนี้และรูปที่แนบจะหายไปและกู้คืนไม่ได้"))
          e.preventDefault();
      }}
    >
      <input type="hidden" name="ids" value={id} />
      <Button
        type="submit"
        variant="outline"
        className="h-11 border-destructive/40 px-4 text-destructive hover:bg-destructive/5"
      >
        ลบถาวร
      </Button>
    </form>
  );
}
