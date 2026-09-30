import Image from "next/image";

import { RaysCanvas } from "@/components/dashboard/rays-canvas";
import { NumberTicker } from "@/components/ui/number-ticker";
import type { DashboardBase } from "@/lib/data/dashboard";

const SCHOOL_NAME = "โรงเรียนละหานทรายรัชดาภิเษก";

/** A short strip instead of a full hero: the crest with its rays, the school name and the four numbers that matter. */
export function DashboardHeader({ base }: { base: DashboardBase }) {
  const numbers = [
    { label: "รอรับเรื่อง", value: base.stats.pending, hot: false },
    { label: "กำลังดำเนินการ", value: base.stats.in_progress, hot: false },
    { label: "ฉุกเฉิน", value: base.emergencyOpen, hot: base.emergencyOpen > 0 },
    { label: "ห้องประชุมวันนี้", value: base.roomsInUseToday, hot: false },
  ];

  return (
    <section className="relative mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 overflow-hidden rounded-2xl border border-border bg-card/70 px-4 py-3 sm:gap-x-8 sm:gap-y-4 sm:px-5 sm:py-4 backdrop-blur-sm">
      <div className="relative size-20 shrink-0 sm:size-32">
        <RaysCanvas tickets={base.rays} className="absolute inset-0 size-full" />
        <Image
          src="/logo.png"
          alt="ตราโรงเรียนละหานทรายรัชดาภิเษก"
          width={640}
          height={1016}
          className="absolute left-1/2 top-1/2 h-[46%] w-auto -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_4px_12px_rgba(0,0,0,.35)]"
        />
      </div>
      <div className="min-w-0 flex-1 basis-40 sm:basis-56">
        <h1 className="font-display text-xl font-bold leading-tight tracking-tight sm:text-3xl">{SCHOOL_NAME}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ระบบแจ้งซ่อมอาคารสถานที่และสิ่งแวดล้อม
          {base.source === "mock" && " · ข้อมูลตัวอย่างจนกว่าจะเข้าสู่ระบบ"}
        </p>
      </div>
      <dl className="grid w-full grid-cols-4 gap-2 sm:w-auto sm:gap-4">
        {numbers.map(({ label, value, hot }) => (
          <div key={label}>
            <dt className="text-[11px] leading-tight text-muted-foreground sm:text-xs">{label}</dt>
            <dd className={`text-2xl font-semibold leading-tight sm:text-3xl ${hot ? "text-red-500" : "text-foreground"}`}>
              <NumberTicker value={value} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
