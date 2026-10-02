"use client";

import { useActionState, useState } from "react";

import {
  signIn,
  signInWithGoogle,
  signUp,
  type AuthResult,
} from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

export function LoginForm({
  initialError,
  googleEnabled = false,
}: {
  initialError?: string;
  googleEnabled?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("signin");
  const [signInState, signInAction, signInPending] = useActionState<
    AuthResult,
    FormData
  >(signIn, null);
  const [signUpState, signUpAction, signUpPending] = useActionState<
    AuthResult,
    FormData
  >(signUp, null);

  const isSignIn = mode === "signin";
  const state = isSignIn ? signInState : signUpState;
  const pending = isSignIn ? signInPending : signUpPending;
  const message = state?.message ?? (isSignIn ? initialError : undefined);

  return (
    <div>
      {googleEnabled && (
        <>
          <form action={signInWithGoogle}>
            <Button
              type="submit"
              variant="outline"
              size="lg"
              className="w-full"
            >
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.4 14.4a7.2 7.2 0 0 1 0-4.8V6.5H1.4a12 12 0 0 0 0 11z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.5l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"
                />
              </svg>
              เข้าด้วย Google (อีเมล @lrp.ac.th)
            </Button>
          </form>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            การเข้าสู่ระบบถือว่ายอมรับ{" "}
            <a href="/privacy" className="underline">
              นโยบายความเป็นส่วนตัว
            </a>{" "}
            และ{" "}
            <a href="/terms" className="underline">
              เงื่อนไขการใช้งาน
            </a>
          </p>
          <div
            className="my-4 flex items-center gap-3 text-xs text-muted-foreground"
            aria-hidden
          >
            <span className="h-px flex-1 bg-border" />
            หรือใช้อีเมลและรหัสผ่าน
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}
      <div
        role="tablist"
        aria-label="เลือกการใช้งาน"
        className="mb-5 grid grid-cols-2 rounded-lg bg-muted p-1 text-sm"
      >
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
              mode === value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <form
        key={mode}
        action={isSignIn ? signInAction : signUpAction}
        className="space-y-4"
      >
        {!isSignIn && (
          <div className="space-y-1.5">
            <Label htmlFor="full_name">ชื่อ-นามสกุล</Label>
            <Input
              id="full_name"
              name="full_name"
              autoComplete="name"
              required
              placeholder="เช่น สมชาย ใจดี"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">อีเมล</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="name@lrp.ac.th"
          />
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
          {!isSignIn && (
            <p className="text-xs text-muted-foreground">
              อย่างน้อย 8 ตัวอักษร
            </p>
          )}
        </div>

        {!isSignIn && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="accept"
              required
              className="mt-1 size-4 shrink-0"
            />
            <span>
              ฉันยอมรับ{" "}
              <a href="/privacy" target="_blank" className="underline">
                นโยบายความเป็นส่วนตัว
              </a>{" "}
              และ{" "}
              <a href="/terms" target="_blank" className="underline">
                เงื่อนไขการใช้งาน
              </a>
            </span>
          </label>
        )}

        {message && (
          <p
            role={state?.ok ? "status" : "alert"}
            className={cn(
              "text-sm",
              state?.ok
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-destructive",
            )}
          >
            {message}
          </p>
        )}

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending
            ? "กำลังดำเนินการ..."
            : isSignIn
              ? "เข้าสู่ระบบ"
              : "สมัครใช้งาน"}
        </Button>
      </form>
    </div>
  );
}
