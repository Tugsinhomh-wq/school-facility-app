"use client";

import { useActionState } from "react";

import {
  setUserActive,
  updateUser,
  type UserResult,
} from "@/app/(dashboard)/users/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_LABEL } from "@/lib/ticket-meta";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

export interface UserItem {
  id: string;
  full_name: string;
  email: string;
  position: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

const ROLE_ORDER: UserRole[] = [
  "user",
  "staff",
  "room_staff",
  "executive",
  "super_admin",
];

export function UserRow({ user, isSelf }: { user: UserItem; isSelf: boolean }) {
  const [state, action, pending] = useActionState<UserResult, FormData>(
    updateUser,
    null,
  );

  return (
    <li
      className={cn(
        "rounded-xl border border-border bg-card/85 p-4 backdrop-blur-sm",
        !user.is_active && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-0 truncate font-medium">{user.full_name}</span>
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {user.email}
        </span>
        {isSelf && <Badge variant="outline">คุณ</Badge>}
        {!user.is_active && (
          <Badge className="bg-destructive/15 text-destructive">
            ปิดบัญชีแล้ว
          </Badge>
        )}
      </div>
      <form
        action={action}
        className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_11rem_auto]"
      >
        <input type="hidden" name="id" value={user.id} />
        <Input
          name="full_name"
          defaultValue={user.full_name}
          required
          maxLength={120}
          aria-label="ชื่อ"
        />
        <Input
          name="position"
          defaultValue={user.position ?? ""}
          maxLength={120}
          placeholder="ตำแหน่ง"
          aria-label="ตำแหน่ง"
        />
        <select
          name="role"
          defaultValue={user.role}
          disabled={isSelf}
          aria-label="บทบาท"
          className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30 dark:[&>option]:bg-card"
        >
          {ROLE_ORDER.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        {isSelf && <input type="hidden" name="role" value={user.role} />}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
      </form>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {state && (
          <p
            role={state.ok ? "status" : "alert"}
            className={cn(
              "text-xs",
              state.ok
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-destructive",
            )}
          >
            {state.message}
          </p>
        )}
        {!isSelf && (
          <form action={setUserActive} className="ml-auto">
            <input type="hidden" name="id" value={user.id} />
            <input
              type="hidden"
              name="active"
              value={user.is_active ? "0" : "1"}
            />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              className={user.is_active ? "text-destructive" : undefined}
            >
              {user.is_active ? "ปิดบัญชี" : "เปิดบัญชีอีกครั้ง"}
            </Button>
          </form>
        )}
      </div>
    </li>
  );
}
