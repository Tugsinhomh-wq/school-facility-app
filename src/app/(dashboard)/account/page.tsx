import { ChevronRight, Inbox, LogOut, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/auth/actions";
import { FeedbackButton } from "@/components/feedback/feedback-button";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/data/session";
import { ROLE_LABEL } from "@/lib/ticket-meta";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "บัญชีของฉัน | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

const ADMIN_LINKS = [
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
];

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { name, role } = session.viewer;
  const section = "border-t border-border pt-6";
  const heading = "text-sm font-medium text-muted-foreground";

  return (
    <div className="mx-auto max-w-[640px] space-y-6">
      <h1 className="font-display text-3xl font-medium tracking-tight">
        บัญชีของฉัน
      </h1>
      <section aria-labelledby="me-h" className={section}>
        <h2 id="me-h" className={heading}>
          ข้อมูลของฉัน
        </h2>
        <dl className="mt-3 space-y-3">
          <div>
            <dt className="text-sm text-muted-foreground">ชื่อ</dt>
            <dd className="text-lg font-medium">{name}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">บทบาท</dt>
            <dd className="font-medium">{ROLE_LABEL[role]}</dd>
          </div>
        </dl>
      </section>
      {role === "super_admin" && (
        <nav aria-labelledby="admin-h" className={section}>
          <h2 id="admin-h" className={heading}>
            เครื่องมือผู้ดูแลระบบ
          </h2>
          <ul className="mt-2 divide-y divide-border">
            {ADMIN_LINKS.map(({ href, label, hint, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="-mx-2 flex min-h-16 items-center gap-3 rounded-lg px-2 py-3 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Icon
                    className="size-5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{label}</span>
                    <span className="block text-sm text-muted-foreground">
                      {hint}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <section aria-labelledby="fb-h" className={section}>
        <h2 id="fb-h" className={heading}>
          ส่งความเห็น
        </h2>
        <div className="mt-3">
          <FeedbackButton />
        </div>
      </section>
      <form action={signOut} className={section}>
        <Button
          type="submit"
          variant="outline"
          className="h-11 w-full text-base"
        >
          <LogOut aria-hidden />
          ออกจากระบบ
        </Button>
      </form>
      <p className="flex justify-center gap-4 text-sm text-muted-foreground">
        <Link
          href="/privacy"
          className="inline-flex min-h-11 items-center hover:text-foreground focus-visible:underline"
        >
          นโยบายความเป็นส่วนตัว
        </Link>
        <Link
          href="/terms"
          className="inline-flex min-h-11 items-center hover:text-foreground focus-visible:underline"
        >
          เงื่อนไขการใช้งาน
        </Link>
      </p>
    </div>
  );
}
