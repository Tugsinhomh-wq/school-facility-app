"use client";

import { useActionState } from "react";

import { signOut } from "@/app/auth/actions";
import { acceptPolicy, type ConsentResult } from "@/app/consent/actions";
import { Button } from "@/components/ui/button";

export function ConsentForm() {
  const [state, action, pending] = useActionState<ConsentResult, FormData>(acceptPolicy, null);
  return (
    <div>
      <form action={action} className="space-y-4">
        <label className="flex min-h-11 items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="accept"
            required
            className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
          />
          <span>ฉันได้อ่านและยอมรับนโยบายความเป็นส่วนตัวและเงื่อนไขการใช้งาน</span>
        </label>
        {state && (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}
        <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
          {pending ? "กำลังบันทึก..." : "ยอมรับและเข้าใช้งาน"}
        </Button>
      </form>
      <form action={signOut} className="mt-2 flex justify-center">
        <button
          type="submit"
          className="min-h-11 px-3 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ออกจากระบบ
        </button>
      </form>
    </div>
  );
}
