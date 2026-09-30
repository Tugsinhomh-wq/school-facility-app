import { LogOut } from "lucide-react";
import { redirect } from "next/navigation";

import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getSession } from "@/lib/data/session";
import { ROLE_LABEL } from "@/lib/ticket-meta";

export const dynamic = "force-dynamic";
export const metadata = { title: "บัญชีของฉัน | ระบบแจ้งซ่อม โรงเรียนละหานทรายรัชดาภิเษก" };

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">บัญชีของฉัน</h1>
      <dl className="space-y-3 rounded-xl border border-border bg-card/85 p-5">
        <div>
          <dt className="text-sm text-muted-foreground">ชื่อ</dt>
          <dd className="text-lg font-medium">{session.viewer.name}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">บทบาท</dt>
          <dd>{ROLE_LABEL[session.viewer.role]}</dd>
        </div>
      </dl>
      <div className="flex items-center justify-between rounded-xl border border-border bg-card/85 p-5">
        <span>โหมดสว่าง / มืด</span>
        <ThemeToggle />
      </div>
      <form action={signOut}>
        <Button type="submit" variant="outline" className="h-12 w-full text-base">
          <LogOut aria-hidden />
          ออกจากระบบ
        </Button>
      </form>
    </div>
  );
}
