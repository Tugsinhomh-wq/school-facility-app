import Image from "next/image";
import { redirect } from "next/navigation";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getSession } from "@/lib/data/session";

export const metadata = {
  title: "ตั้งรหัสผ่านใหม่ | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

export const dynamic = "force-dynamic";

/** Opened from the reset link in the email, which has already signed the user in. */
export default async function ResetPasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login?error=confirm");

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <main className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/logo.png"
            alt=""
            width={640}
            height={1016}
            priority
            className="h-16 w-auto"
          />
          <h1 className="font-display mt-4 text-2xl font-medium leading-tight">
            ตั้งรหัสผ่านใหม่
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {session.viewer.name}
          </p>
        </div>
        <div className="border-t border-border pt-6">
          <ResetPasswordForm />
        </div>
      </main>
    </div>
  );
}
