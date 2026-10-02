import Link from "next/link";
import { redirect } from "next/navigation";

import { UserRow, type UserItem } from "@/components/users/user-row";
import { getSession } from "@/lib/data/session";
import { ROLE_LABEL } from "@/lib/ticket-meta";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "จัดการผู้ใช้ | ระบบแจ้งซ่อม โรงเรียนละหานทรายรัชดาภิเษก",
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
      className={cn(
        "rounded-full border px-3 py-1 text-sm",
        role === key
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );

  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">
        จัดการผู้ใช้
      </h1>
      <p className="mt-1 text-muted-foreground">
        เปลี่ยนบทบาท แก้ชื่อและตำแหน่ง หรือปิดบัญชี เห็นเฉพาะผู้ดูแลระบบ
      </p>

      <form className="mt-6 flex flex-wrap gap-2" role="search">
        <input
          name="q"
          defaultValue={term}
          placeholder="ค้นหาชื่อหรืออีเมล"
          aria-label="ค้นหา"
          className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm sm:max-w-sm"
        />
        {role && <input type="hidden" name="role" value={role} />}
        <button
          type="submit"
          className="h-10 rounded-lg border border-input px-4 text-sm font-medium"
        >
          ค้นหา
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="กรองตามบทบาท">
        {chip("", "ทั้งหมด")}
        {ROLES.map((r) => chip(r, ROLE_LABEL[r]))}
      </div>

      {error ? (
        <p role="alert" className="mt-6 text-sm text-destructive">
          โหลดไม่สำเร็จ ลองรีเฟรชหน้านี้
        </p>
      ) : users.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border bg-card/60 p-10 text-center text-muted-foreground">
          ไม่พบผู้ใช้
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            {users.length} บัญชี
          </p>
          <ul className="mt-2 space-y-3">
            {users.map((u) => (
              <UserRow key={u.id} user={u} isSelf={u.id === session.userId} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
