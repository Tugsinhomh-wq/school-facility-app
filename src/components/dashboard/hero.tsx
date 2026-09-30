import Image from "next/image";

import { RaysCanvas } from "@/components/dashboard/rays-canvas";
import { UserMenu } from "@/components/dashboard/user-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { DashboardData } from "@/lib/data/dashboard";

const SCHOOL_NAME = "โรงเรียนละหานทรายรัชดาภิเษก";

export function Hero({ data }: { data: DashboardData }) {
  const { pending } = data.stats;
  const emergency = data.emergencyOpen;

  return (
    <header className="relative mb-6 grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_32rem]">
      <div className="absolute right-0 top-0 z-10 flex items-center gap-2">
        <UserMenu viewer={data.viewer} />
        <ThemeToggle />
      </div>

      <div className="order-2 lg:order-1">
        <h1 className="font-display text-4xl font-bold leading-[1.15] tracking-tight text-foreground sm:text-5xl">
          {SCHOOL_NAME}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">ระบบแจ้งซ่อมอาคารสถานที่และสิ่งแวดล้อม</p>

        <p className="mt-8 max-w-[40ch] text-xl leading-relaxed">
          {pending > 0 ? (
            <>
              ตอนนี้มี <strong className="font-semibold text-primary">{pending} เรื่อง</strong>รอรับเรื่อง
              {emergency > 0 && (
                <>
                  {" "}
                  และ <strong className="font-semibold text-primary">{emergency} เรื่อง</strong>เป็นงานฉุกเฉิน
                </>
              )}
            </>
          ) : (
            "ไม่มีเรื่องค้างรับ"
          )}
        </p>
        {data.source === "mock" && (
          <p className="mt-2 text-sm text-muted-foreground">ข้อมูลที่เห็นเป็นตัวอย่าง จนกว่าจะเข้าสู่ระบบ</p>
        )}
      </div>

      <figure className="relative order-1 mx-auto aspect-square w-full max-w-[26rem] lg:order-2 lg:max-w-none">
        <RaysCanvas tickets={data.rays} className="absolute inset-0 size-full" />
        <Image
          src="/logo.png"
          alt="ตราโรงเรียนละหานทรายรัชดาภิเษก"
          width={640}
          height={1016}
          priority
          className="absolute left-1/2 top-1/2 h-[42%] w-auto -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_8px_24px_rgba(0,0,0,.35)]"
        />
        <figcaption className="absolute inset-x-0 -bottom-1 text-center text-xs text-muted-foreground">
          หนึ่งเส้นคือหนึ่งงานซ่อม เส้นยิ่งยาวยิ่งเร่งด่วน
        </figcaption>
      </figure>
    </header>
  );
}
