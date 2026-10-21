import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState, LoadError } from "@/components/ui/state-card";
import { UserRow, type UserItem } from "@/components/users/user-row";
import { getSession } from "@/lib/data/session";
import { ROLE_LABEL } from "@/lib/ticket-meta";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "จัดการผู้ใช้ | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

const ROLES = Object.keys(ROLE_LABEL) as UserRole[];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.viewer.role !== "super_admin") redirect("/");

  const { q = "", role = "" } = await searchParams;
  let query = session.supabase
    .from("profiles")
    .select("id, full_name, email, position, role, is_active, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (ROLES.includes(role as UserRole))
    query = query.eq("role", role as UserRole);
  // PostgREST or() treats these characters as separators, so drop them.
  const term = q.replace(/[,()%*\\]/g, " ").trim();
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  const { data, error } = await query;
  const users = (data ?? []) as UserItem[];

  const chip = (key: string, label: string) => (
    <Link
      key={key}
      href={`/users?${new URLSearchParams({ ...(term ? { q: term } : {}), ...(key ? { role: key } : {}) })}`}
      aria-current={role === key ? "true" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center rounded-full border px-4 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        role === key
          ? "border-primary bg-primary font-medium text-primary-foreground"
          : "border-input text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );

  return (
    <>
      <h1 className="font-display text-3xl font-medium tracking-tight">
        จัดการผู้ใช้
      </h1>
      <p className="mt-1 text-muted-foreground">
        เปลี่ยนบทบาท แก้ชื่อและตำแหน่ง หรือปิดบัญชี เห็นเฉพาะผู้ดูแลระบบ
      </p>

      <form className="mt-6 flex gap-2" role="search">
        <input
          name="q"
          defaultValue={term}
          placeholder="ค้นหาชื่อหรืออีเมล"
          aria-label="ค้นหา"
          className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:max-w-sm sm:flex-none sm:basis-96"
        />
        {role && <input type="hidden" name="role" value={role} />}
        <button
          type="submit"
          className="h-11 rounded-lg border border-input px-5 text-sm font-medium outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          ค้นหา
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="กรองตามบทบาท">
        {chip("", "ทั้งหมด")}
        {ROLES.map((r) => chip(r, ROLE_LABEL[r]))}
      </div>

      {error ? (
        <LoadError what="รายชื่อผู้ใช้" retryHref="/users" className="mt-6" />
      ) : users.length === 0 ? (
        <EmptyState title="ไม่พบผู้ใช้" className="mt-6 py-10" />
      ) : (
        <>
          <p className="mt-5 mb-2 text-sm text-muted-foreground">
            {users.length} บัญชี
          </p>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {users.map((u) => (
              <UserRow key={u.id} user={u} isSelf={u.id === session.userId} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
