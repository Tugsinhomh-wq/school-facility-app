import {
  Ban,
  ChevronRight,
  Eye,
  Shield,
  UserRound,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { setUserActive } from "@/app/(dashboard)/users/actions";
import { TONE } from "@/components/dashboard/home-actions";
import { Pill } from "@/components/tickets/status-mark";
import { UserEditForm } from "@/components/users/user-edit-form";
import { Button } from "@/components/ui/button";
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

const ROLE_ICON: Record<UserRole, LucideIcon> = {
  super_admin: Shield,
  head: Users,
  staff: Wrench,
  room_staff: Wrench,
  executive: Eye,
  user: UserRound,
};

export function UserRow({ user, isSelf }: { user: UserItem; isSelf: boolean }) {
  return (
    <li>
      <details className="group">
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_10.5rem_7.5rem_1.25rem] [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1 leading-snug md:flex-none">
            <span className="block font-semibold">
              {user.full_name}
              {isSelf && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  (คุณ)
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-sm break-all text-muted-foreground">
              {user.email}
              {user.position && (
                <span className="md:hidden"> · {user.position}</span>
              )}
            </span>
            <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1.5 md:hidden">
              <RolePill role={user.role} />
              <ActivePill active={user.is_active} />
            </span>
          </span>
          <span className="hidden min-w-0 text-sm text-muted-foreground md:block">
            {user.position}
          </span>
          <span className="hidden md:block">
            <RolePill role={user.role} />
          </span>
          <span className="hidden md:block">
            <ActivePill active={user.is_active} />
          </span>
          <span className="sr-only">แก้ไขผู้ใช้</span>
          <ChevronRight
            className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
            aria-hidden
          />
        </summary>

        <div className="border-t border-border bg-muted/30 px-4 py-4">
          <UserEditForm user={user} isSelf={isSelf} />

          {!isSelf && (
            <form
              action={setUserActive}
              className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
            >
              <input type="hidden" name="id" value={user.id} />
              <input
                type="hidden"
                name="active"
                value={user.is_active ? "0" : "1"}
              />
              <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                {user.is_active
                  ? "ปิดบัญชีแล้วผู้ใช้จะเข้าสู่ระบบไม่ได้ ข้อมูลยังอยู่ และเปิดกลับได้"
                  : "บัญชีนี้ปิดอยู่ เปิดอีกครั้งเพื่อให้เข้าสู่ระบบได้"}
              </p>
              <Button
                type="submit"
                variant="outline"
                className={cn(
                  "h-11 w-full px-5 sm:w-auto",
                  user.is_active && "border-destructive/40 text-destructive",
                )}
              >
                {user.is_active ? "ปิดบัญชีผู้ใช้นี้" : "เปิดบัญชีอีกครั้ง"}
              </Button>
            </form>
          )}
        </div>
      </details>
    </li>
  );
}

function RolePill({ role }: { role: UserRole }) {
  return (
    <Pill
      tone={{ icon: ROLE_ICON[role], className: "text-primary" }}
      label={ROLE_LABEL[role]}
    />
  );
}

function ActivePill({ active }: { active: boolean }) {
  return (
    <Pill
      tone={active ? TONE.ok : { icon: Ban, className: "text-red-700" }}
      label={active ? "ใช้งานอยู่" : "ปิดบัญชีแล้ว"}
    />
  );
}
