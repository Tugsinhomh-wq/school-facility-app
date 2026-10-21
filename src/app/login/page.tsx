import Image from "next/image";

import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "เข้าสู่ระบบ | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <main className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/logo.png"
            alt="ตราโรงเรียนละหานทรายรัชดาภิเษก"
            width={640}
            height={1016}
            priority
            className="h-24 w-auto"
          />
          <h1 className="font-display mt-4 text-2xl font-medium leading-tight">
            สำนักงานออนไลน์
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            โรงเรียนละหานทรายรัชดาภิเษก
          </p>
        </div>
        <div className="border-t border-border pt-6">
          <LoginForm
            googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "1"}
            initialError={
              error === "confirm"
                ? "ลิงก์ยืนยันอีเมลไม่ถูกต้องหรือหมดอายุ ลองสมัครหรือเข้าสู่ระบบอีกครั้ง"
                : error === "domain"
                  ? "เข้าด้วย Google ได้เฉพาะอีเมล @lrp.ac.th ถ้าไม่ใช่อีเมลโรงเรียน ให้สมัครด้วยอีเมลและรหัสผ่านแทน"
                  : error === "google"
                    ? "เข้าสู่ระบบด้วย Google ไม่สำเร็จ ลองใหม่อีกครั้ง"
                    : undefined
            }
          />
        </div>
        <p className="mt-6 flex justify-center gap-2 text-sm text-muted-foreground">
          <a
            href="/privacy"
            className="flex min-h-11 items-center px-2 hover:text-foreground"
          >
            นโยบายความเป็นส่วนตัว
          </a>
          <a
            href="/terms"
            className="flex min-h-11 items-center px-2 hover:text-foreground"
          >
            เงื่อนไขการใช้งาน
          </a>
        </p>
      </main>
    </div>
  );
}
