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
import { MyReservations, PendingReservations, TodayMeetings } from "@/components/dashboard/reservation-cards";
import { getDashboardBase, getRepairsData, getRoomsData, type DashboardBase, type DashTab } from "@/lib/data/dashboard";
import { isRoomManager, isStaffRole, guardExecutive } from "@/lib/data/session";

export const dynamic = "force-dynamic";

const parseTab = (v: string | string[] | undefined): DashTab => (v === "rooms" ? "rooms" : "repairs");

async function Repairs({ base }: { base: DashboardBase }) {
  const data = await getRepairsData();
  const staff = isStaffRole(base.viewer?.role);
  const canAttach = base.source === "supabase";
  return (
    <BentoGrid>
      {staff ? (
        <>
          <QuickStats stats={base.stats} />
          <RecentTicketsFeed tickets={data.queue} title="งานที่รอรับเรื่อง" hint="เรื่องเร่งด่วนอยู่บนสุด" className="md:col-span-3 lg:col-span-7 lg:row-span-2" />
          <BuildingMatrix byBuilding={base.byBuilding} />
          <DocumentHub documents={data.documents} canDraft className="md:col-span-3 lg:col-span-5" />
        </>
      ) : (
        <>
          <QuickReportCard buildings={data.buildings} canAttach={canAttach} />
          <RecentTicketsFeed tickets={data.recent} title="งานที่ฉันแจ้งล่าสุด" hint="รายการของคุณ 5 รายการล่าสุด" className="md:col-span-3 lg:col-span-7" />
        </>
      )}
    </BentoGrid>
  );
}

async function Rooms({ base }: { base: DashboardBase }) {
  const data = await getRoomsData();
  const staff = isRoomManager(base.viewer?.role);
  return (
    <BentoGrid>
      {staff ? (
        <PendingReservations items={data.pendingReservations} className="md:col-span-3 lg:col-span-4" />
      ) : (
        <MyReservations items={data.myReservations} className="md:col-span-3 lg:col-span-4" />
      )}
      <TodayMeetings meetings={base.todayMeetings} className="md:col-span-3 lg:col-span-4" />
      <LiveRoomStatus rooms={data.liveRooms} />
    </BentoGrid>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await guardExecutive();
  const tab = parseTab((await searchParams).tab);
  const base = await getDashboardBase();

  return (
    <>
      <div className="mb-4 hidden overflow-hidden rounded-xl md:block">
        <MeetingTicker meetings={base.todayMeetings} />
      </div>
      <DashboardHeader base={base} />
      <DashboardTabs active={tab} />
      {tab === "rooms" ? <Rooms base={base} /> : <Repairs base={base} />}
    </>
  );
}
