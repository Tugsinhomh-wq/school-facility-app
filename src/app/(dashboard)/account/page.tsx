import { Inbox, LogOut, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/auth/actions";
import { FeedbackButton } from "@/components/feedback/feedback-button";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getSession } from "@/lib/data/session";
import { ROLE_LABEL } from "@/lib/ticket-meta";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "บัญชีของฉัน | ระบบแจ้งซ่อม โรงเรียนละหานทรายรัชดาภิเษก",
};

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">
        บัญชีของฉัน
      </h1>
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
      <FeedbackButton />
      {session.viewer.role === "super_admin" && (
        <Button
          variant="outline"
          className="h-12 w-full text-base"
          nativeButton={false}
          render={<Link href="/feedback" />}
        >
          <Inbox aria-hidden />
          อ่านความคิดเห็นทั้งหมด
        </Button>
      )}
      {session.viewer.role === "super_admin" && (
        <Button
          variant="outline"
          className="h-12 w-full text-base"
          nativeButton={false}
          render={<Link href="/users" />}
        >
          <Users aria-hidden />
          จัดการผู้ใช้
        </Button>
      )}
      <form action={signOut}>
        <Button
          type="submit"
          variant="outline"
          className="h-12 w-full text-base"
        >
          <LogOut aria-hidden />
          ออกจากระบบ
        </Button>
      </form>
      <p className="flex justify-center gap-4 text-xs text-muted-foreground">
        <Link href="/privacy" className="hover:text-foreground">
          นโยบายความเป็นส่วนตัว
        </Link>
        <Link href="/terms" className="hover:text-foreground">
          เงื่อนไขการใช้งาน
        </Link>
      </p>
    </div>
  );
}
