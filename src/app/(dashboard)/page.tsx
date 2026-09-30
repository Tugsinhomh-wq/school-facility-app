import { BentoGrid } from "@/components/ui/bento-grid";
import { BuildingMatrix } from "@/components/dashboard/building-matrix";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import { DocumentHub } from "@/components/dashboard/document-hub";
import { LiveRoomStatus } from "@/components/dashboard/live-room-status";
import { MeetingTicker } from "@/components/dashboard/meeting-ticker";
import { QuickReportCard } from "@/components/dashboard/quick-report-card";
import { QuickStats } from "@/components/dashboard/quick-stats";
import { RecentTicketsFeed } from "@/components/dashboard/recent-tickets-feed";
import { PendingReservations, TodayMeetings } from "@/components/dashboard/reservation-cards";
import { getDashboardBase, getOverviewData, getRepairsData, getRoomsData, type DashboardBase, type DashTab } from "@/lib/data/dashboard";
import { isStaffRole } from "@/lib/data/session";

export const dynamic = "force-dynamic";

const parseTab = (v: string | string[] | undefined): DashTab => (v === "repairs" || v === "rooms" ? v : "overview");

async function Overview({ base }: { base: DashboardBase }) {
  const data = await getOverviewData();
  const staff = isStaffRole(base.viewer?.role);
  const canAttach = base.source === "supabase";
  return (
    <BentoGrid>
      {staff ? (
        <>
          <RecentTicketsFeed
            tickets={data.queue}
            title="งานที่รอรับเรื่อง"
            hint="เรื่องเร่งด่วนอยู่บนสุด"
            className="md:col-span-6 lg:col-span-6"
          />
          <PendingReservations items={data.pendingReservations} className="md:col-span-3 lg:col-span-6" />
          <DocumentHub documents={data.documents} canDraft className="md:col-span-3 lg:col-span-6" />
          <TodayMeetings meetings={base.todayMeetings} className="md:col-span-6 lg:col-span-6" />
        </>
      ) : (
        <>
          <QuickReportCard buildings={data.buildings} canAttach={canAttach} />
          <TodayMeetings meetings={base.todayMeetings} className="md:col-span-3 lg:col-span-5" />
          <RecentTicketsFeed
            tickets={data.queue}
            title="งานที่ฉันแจ้งล่าสุด"
            hint="รายการของคุณ 5 รายการล่าสุด"
            className="md:col-span-6 lg:col-span-12"
          />
        </>
      )}
    </BentoGrid>
  );
}

async function Repairs({ base }: { base: DashboardBase }) {
  const data = await getRepairsData();
  return (
    <BentoGrid>
      <QuickStats stats={base.stats} />
      <RecentTicketsFeed tickets={data.recent} />
      <QuickReportCard buildings={data.buildings} canAttach={base.source === "supabase"} />
      <BuildingMatrix byBuilding={base.byBuilding} />
    </BentoGrid>
  );
}

async function Rooms({ base }: { base: DashboardBase }) {
  const data = await getRoomsData();
  const staff = isStaffRole(base.viewer?.role);
  return (
    <BentoGrid>
      <LiveRoomStatus rooms={data.liveRooms} />
      <TodayMeetings meetings={base.todayMeetings} className="md:col-span-3 lg:col-span-4" />
      {staff && <PendingReservations items={data.pendingReservations} className="md:col-span-3 lg:col-span-4" />}
    </BentoGrid>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const tab = parseTab((await searchParams).tab);
  const base = await getDashboardBase();

  return (
    <>
      <div className="mb-4 overflow-hidden rounded-xl">
        <MeetingTicker meetings={base.todayMeetings} />
      </div>
      <DashboardHeader base={base} />
      <DashboardTabs active={tab} />
      {tab === "overview" && <Overview base={base} />}
      {tab === "repairs" && <Repairs base={base} />}
      {tab === "rooms" && <Rooms base={base} />}
    </>
  );
}
