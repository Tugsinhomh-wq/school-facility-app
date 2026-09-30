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

  const staff = base.viewer?.role === "staff" || base.viewer?.role === "super_admin";

  return (
    <>
      {/* Phone: one slim row. Staff get the two numbers that need action; everyone else just the name. */}
      <section className="mb-3 flex items-center gap-3 rounded-2xl border border-border bg-card/70 px-3 py-2.5 backdrop-blur-sm sm:hidden">
        <Image src="/logo.png" alt="ตราโรงเรียนละหานทรายรัชดาภิเษก" width={640} height={1016} className="h-10 w-auto shrink-0" />
        <h1 className="min-w-0 flex-1 font-display text-sm font-semibold leading-snug">{SCHOOL_NAME}</h1>
        {staff && (
          <dl className="flex shrink-0 gap-3 text-center">
            <div>
              <dt className="text-[10px] text-muted-foreground">รอรับ</dt>
              <dd className="text-xl font-semibold leading-none">{base.stats.pending}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted-foreground">ฉุกเฉิน</dt>
              <dd className={`text-xl font-semibold leading-none ${base.emergencyOpen > 0 ? "text-red-500" : ""}`}>{base.emergencyOpen}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="relative mb-6 hidden flex-wrap items-center gap-x-8 gap-y-4 overflow-hidden rounded-2xl border border-border bg-card/70 px-5 py-4 backdrop-blur-sm sm:flex">
        <div className="relative size-32 shrink-0">
          <RaysCanvas tickets={base.rays} className="absolute inset-0 size-full" />
          <Image
            src="/logo.png"
            alt="ตราโรงเรียนละหานทรายรัชดาภิเษก"
            width={640}
            height={1016}
            className="absolute left-1/2 top-1/2 h-[46%] w-auto -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_4px_12px_rgba(0,0,0,.35)]"
          />
        </div>
        <div className="min-w-0 flex-1 basis-56">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight">{SCHOOL_NAME}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ระบบแจ้งซ่อมอาคารสถานที่และสิ่งแวดล้อม
            {base.source === "mock" && " · ข้อมูลตัวอย่างจนกว่าจะเข้าสู่ระบบ"}
          </p>
        </div>
        <dl className="grid w-auto grid-cols-4 gap-4">
          {numbers.map(({ label, value, hot }) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className={`text-3xl font-semibold leading-tight ${hot ? "text-red-500" : "text-foreground"}`}>
                <NumberTicker value={value} />
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
