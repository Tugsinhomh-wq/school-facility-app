import { BentoGrid } from "@/components/ui/bento-grid";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { BuildingMatrix } from "@/components/dashboard/building-matrix";
import { DocumentHub } from "@/components/dashboard/document-hub";
import { QuickReportCard } from "@/components/dashboard/quick-report-card";
import { QuickStats } from "@/components/dashboard/quick-stats";
import { RecentTicketsFeed } from "@/components/dashboard/recent-tickets-feed";
import { RetroGrid } from "@/components/ui/retro-grid";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getDashboardData } from "@/lib/data/dashboard";

export const dynamic = "force-dynamic";

const SCHOOL_NAME = "โรงเรียนละหานทรายรัชดาภิเษก";

export default async function DashboardPage() {
  const data = await getDashboardData();
  const waiting = data.stats.pending;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <RetroGrid className="h-[520px]" opacity={0.55} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_80%_at_50%_0%,color-mix(in_oklch,var(--color-navy)_45%,transparent),transparent)]" />
      <main className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium tracking-wide text-amber-700 dark:text-gold">ระบบแจ้งซ่อมอาคารสถานที่และสิ่งแวดล้อม</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">
              <AnimatedShinyText shimmerWidth={260} className="text-foreground/75">
                {SCHOOL_NAME}
              </AnimatedShinyText>
            </h1>
            <p className="mt-3 text-base text-muted-foreground">
              {waiting > 0 ? (
                <>
                  วันนี้มี <span className="font-semibold text-amber-700 dark:text-gold">{waiting} เรื่อง</span> รอรับเรื่อง
                </>
              ) : (
                "ไม่มีเรื่องค้างรับ ทุกอย่างเรียบร้อย"
              )}
              {data.source === "mock" && " · กำลังแสดงข้อมูลตัวอย่าง"}
            </p>
          </div>
          <ThemeToggle />
        </header>
        <BentoGrid>
          <QuickStats stats={data.stats} />
          <RecentTicketsFeed tickets={data.recent} />
          <QuickReportCard />
          <DocumentHub documents={data.documents} />
          <BuildingMatrix byBuilding={data.byBuilding} />
        </BentoGrid>
      </main>
    </div>
  );
}
