import { BentoGrid } from "@/components/ui/bento-grid";
import { BuildingMatrix } from "@/components/dashboard/building-matrix";
import { DocumentHub } from "@/components/dashboard/document-hub";
import { Hero } from "@/components/dashboard/hero";
import { LiveRoomStatus } from "@/components/dashboard/live-room-status";
import { MeetingTicker } from "@/components/dashboard/meeting-ticker";
import { QuickReportCard } from "@/components/dashboard/quick-report-card";
import { QuickStats } from "@/components/dashboard/quick-stats";
import { RecentTicketsFeed } from "@/components/dashboard/recent-tickets-feed";
import { AppHeader } from "@/components/layout/app-header";
import { GridPattern } from "@/components/ui/grid-pattern";
import { getDashboardData } from "@/lib/data/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <MeetingTicker meetings={data.todayMeetings} />
      {/* Faint ruled grid, like drafting paper, fading out below the hero. */}
      <GridPattern
        width={32}
        height={32}
        className="top-8 h-[560px] stroke-primary/10 fill-primary/5 [mask-image:linear-gradient(to_bottom,white,transparent)]"
      />
      <main className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <AppHeader viewer={data.viewer} />
        <Hero data={data} />
        <BentoGrid>
          <QuickStats stats={data.stats} roomsInUseToday={data.roomsInUseToday} />
          <RecentTicketsFeed tickets={data.recent} />
          <QuickReportCard buildings={data.buildings} canAttach={data.source === "supabase"} />
          <DocumentHub documents={data.documents} canDraft={!data.viewer || data.viewer.role !== "user"} />
          <BuildingMatrix byBuilding={data.byBuilding} />
          <LiveRoomStatus rooms={data.liveRooms} />
        </BentoGrid>
      </main>
    </div>
  );
}
