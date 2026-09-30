import Image from "next/image";

import { LoginForm } from "@/components/auth/login-form";
import { GridPattern } from "@/components/ui/grid-pattern";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const metadata = { title: "เข้าสู่ระบบ | ระบบแจ้งซ่อม โรงเรียนละหานทรายรัชดาภิเษก" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <GridPattern
        width={32}
        height={32}
        className="stroke-primary/10 fill-primary/5 [mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)]"
      />
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <main className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/logo.png" alt="ตราโรงเรียนละหานทรายรัชดาภิเษก" width={640} height={1016} priority className="h-28 w-auto drop-shadow-[0_8px_24px_rgba(0,0,0,.3)]" />
          <h1 className="font-display mt-4 text-2xl font-bold leading-tight">โรงเรียนละหานทรายรัชดาภิเษก</h1>
          <p className="mt-1 text-sm text-muted-foreground">ระบบแจ้งซ่อมอาคารสถานที่และสิ่งแวดล้อม</p>
        </div>
        <div className="rounded-xl border border-border bg-card/90 p-6 backdrop-blur-sm">
          <LoginForm initialError={error === "confirm" ? "ลิงก์ยืนยันอีเมลไม่ถูกต้องหรือหมดอายุ ลองสมัครหรือเข้าสู่ระบบอีกครั้ง" : undefined} />
        </div>
      </main>
    </div>
  );
}
