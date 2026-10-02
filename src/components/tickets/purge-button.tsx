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
        size="sm"
        variant="outline"
        className="text-destructive"
      >
        ลบถาวร
      </Button>
    </form>
  );
}
