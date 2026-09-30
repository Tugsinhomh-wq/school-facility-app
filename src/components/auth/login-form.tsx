"use client";

import { useActionState, useState } from "react";

import { signIn, signUp, type AuthResult } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [signInState, signInAction, signInPending] = useActionState<AuthResult, FormData>(signIn, null);
  const [signUpState, signUpAction, signUpPending] = useActionState<AuthResult, FormData>(signUp, null);

  const isSignIn = mode === "signin";
  const state = isSignIn ? signInState : signUpState;
  const pending = isSignIn ? signInPending : signUpPending;
  const message = state?.message ?? (isSignIn ? initialError : undefined);

  return (
    <div>
      <div role="tablist" aria-label="เลือกการใช้งาน" className="mb-5 grid grid-cols-2 rounded-lg bg-muted p-1 text-sm">
        {(
          [
            ["signin", "เข้าสู่ระบบ"],
            ["signup", "สมัครใช้งาน"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              "rounded-md py-1.5 font-medium transition-colors",
              mode === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <form key={mode} action={isSignIn ? signInAction : signUpAction} className="space-y-4">
        {!isSignIn && (
          <div className="space-y-1.5">
            <Label htmlFor="full_name">ชื่อ-นามสกุล</Label>
            <Input id="full_name" name="full_name" autoComplete="name" required placeholder="เช่น สมชาย ใจดี" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">อีเมล</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="name@lrp.ac.th" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">รหัสผ่าน</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignIn ? "current-password" : "new-password"}
            minLength={isSignIn ? undefined : 8}
            required
          />
          {!isSignIn && <p className="text-xs text-muted-foreground">อย่างน้อย 8 ตัวอักษร</p>}
        </div>

        {message && (
          <p role={state?.ok ? "status" : "alert"} className={cn("text-sm", state?.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
            {message}
          </p>
        )}

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? "กำลังดำเนินการ..." : isSignIn ? "เข้าสู่ระบบ" : "สมัครใช้งาน"}
        </Button>
      </form>
    </div>
  );
}
