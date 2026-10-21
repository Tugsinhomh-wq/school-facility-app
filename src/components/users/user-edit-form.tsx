"use client";

import { useActionState } from "react";

import { updateUser, type UserResult } from "@/app/(dashboard)/users/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_LABEL } from "@/lib/ticket-meta";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

const ROLE_ORDER: UserRole[] = [
  "user",
  "staff",
  "head",
  "room_staff",
  "executive",
  "super_admin",
];

const field =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-muted disabled:text-muted-foreground";

export function UserEditForm({
  user,
  isSelf,
}: {
  user: {
    id: string;
    full_name: string;
    position: string | null;
    role: UserRole;
  };
  isSelf: boolean;
}) {
  const [state, action, pending] = useActionState<UserResult, FormData>(
    updateUser,
    null,
  );

  return (
    <form
      action={action}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_14rem]"
    >
      <input type="hidden" name="id" value={user.id} />
      <label className="block text-sm">
        <span className="mb-1 block text-muted-foreground">ชื่อ</span>
        <Input
          name="full_name"
          defaultValue={user.full_name}
          required
          maxLength={120}
          className="h-11"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted-foreground">ตำแหน่ง</span>
        <Input
          name="position"
          defaultValue={user.position ?? ""}
          maxLength={120}
          className="h-11"
        />
      </label>
      <label className="block text-sm sm:col-span-2 lg:col-span-1">
        <span className="mb-1 block text-muted-foreground">บทบาท</span>
        <select
          name="role"
          defaultValue={user.role}
          disabled={isSelf}
          className={field}
        >
          {ROLE_ORDER.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        {isSelf && (
          <span className="mt-1 block text-muted-foreground">
            เปลี่ยนบทบาทของตัวเองไม่ได้
          </span>
        )}
      </label>
      {isSelf && <input type="hidden" name="role" value={user.role} />}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
        <Button
          type="submit"
          disabled={pending}
          className="h-11 w-full px-6 sm:w-auto"
        >
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
        {state && (
          <p
            role={state.ok ? "status" : "alert"}
            className={cn(
              "text-sm font-medium",
              state.ok ? "text-emerald-800" : "text-destructive",
            )}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
