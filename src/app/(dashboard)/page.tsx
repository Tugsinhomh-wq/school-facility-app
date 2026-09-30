import { BentoGrid } from "@/components/ui/bento-grid";
import { BuildingMatrix } from "@/components/dashboard/building-matrix";
import { DocumentHub } from "@/components/dashboard/document-hub";
import { QuickReportCard } from "@/components/dashboard/quick-report-card";
import { QuickStats } from "@/components/dashboard/quick-stats";
import { RecentTicketsFeed } from "@/components/dashboard/recent-tickets-feed";
import { GridPattern } from "@/components/ui/grid-pattern";
import { getDashboardData } from "@/lib/data/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <GridPattern className="[mask-image:radial-gradient(700px_circle_at_top,white,transparent)]" />
      <main className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">ระบบแจ้งซ่อมอาคารสถานที่และสิ่งแวดล้อม</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ภาพรวมงานซ่อมบำรุงของโรงเรียน
            {data.source === "mock" && " · กำลังแสดงข้อมูลตัวอย่าง"}
          </p>
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
