"use client";

import { useActionState } from "react";

import { updatePassword, type AuthResult } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<AuthResult, FormData>(
    updatePassword,
    null,
  );
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="password">รหัสผ่านใหม่</Label>
        <Input
          className="h-11 text-base"
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-xs text-muted-foreground">อย่างน้อย 8 ตัวอักษร</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password_again">พิมพ์รหัสผ่านใหม่อีกครั้ง</Label>
        <Input
          className="h-11 text-base"
          id="password_again"
          name="password_again"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="h-11 w-full"
      >
        {pending ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
      </Button>
    </form>
  );
}
