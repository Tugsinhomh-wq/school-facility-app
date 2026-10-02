import { ChevronRight, Inbox, LogOut, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/auth/actions";
import { PushToggle } from "@/components/account/push-toggle";
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
      <PushToggle />
      <FeedbackButton />
      {session.viewer.role === "super_admin" && (
        <nav
          aria-label="เครื่องมือผู้ดูแลระบบ"
          className="overflow-hidden rounded-xl border border-border bg-card/85"
        >
          <p className="px-5 pt-4 pb-1 text-sm text-muted-foreground">
            เครื่องมือผู้ดูแลระบบ
          </p>
          {[
            {
              href: "/users",
              label: "จัดการผู้ใช้",
              hint: "เปลี่ยนบทบาท ปิดบัญชี",
              icon: Users,
            },
            {
              href: "/feedback",
              label: "ความคิดเห็นจากผู้ใช้",
              hint: "อ่านและติดตามสถานะ",
              icon: Inbox,
            },
            {
              href: "/trash",
              label: "ถังขยะงานแจ้งซ่อม",
              hint: "กู้คืนหรือลบถาวร",
              icon: Trash2,
            },
          ].map(({ href, label, hint, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-16 items-center gap-3 border-t border-border px-5 py-3 first:border-t-0 active:bg-muted/60"
            >
              <Icon
                className="size-5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">
                  {hint}
                </span>
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          ))}
        </nav>
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
