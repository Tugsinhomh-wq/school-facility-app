import { LayoutGrid } from "lucide-react";
import Link from "next/link";

import { ConfirmCard } from "@/components/cleaning/confirm-card";
import {
  cleaningHref,
  ManageLink,
  MyRoomsLink,
  OfficerOverview,
  type Filters,
} from "@/components/cleaning/officer-overview";
import type { RoomToday } from "@/components/cleaning/level-trays";
import { EmptyState, LoadError } from "@/components/ui/state-card";
import { dayState, lateReachable, weekGrid } from "@/lib/cleaning";
import { getWeek } from "@/lib/data/cleaning";
import { getAllClassrooms } from "@/lib/data/cleaning-officer";
import { getMyClassrooms } from "@/lib/data/cleaning-teacher";
import { getSession, guardExecutive } from "@/lib/data/session";
import { isCleaningManager } from "@/lib/cleaning-access";
import { levelOf, levelsOf, levelTitles } from "@/lib/cleaning-level";
import { addDays, bangkokYmd, formatDayLong, isYmd, mondayOf } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "เขตทำความสะอาด | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

type Params = Record<string, string | string[] | undefined>;
const param = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : undefined;

export default async function CleaningPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await guardExecutive();
  // School time: the Bangkok day, decided on the server (00:30 Bangkok is already the new day).
  const today = bangkokYmd(new Date());
  const session = await getSession();
  const params = await searchParams;
  const officer = isCleaningManager(session?.viewer.role);
  // An officer who also advises a class reaches their own confirm cards with ?view=mine.
  const mine = officer && param(params.view) === "mine";

  return (
    <>
      {officer && !mine ? (
        <>
          <PageTitle today={today} demo={!session} />
          <OfficerView today={today} params={params} />
        </>
      ) : (
        <>
          <h1 className="sr-only">เขตทำความสะอาด</h1>
          {mine && (
            <Link
              href="/cleaning"
              className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              <LayoutGrid className="size-4" aria-hidden />
              ดูภาพรวมทุกห้อง
            </Link>
          )}
          {!session && (
            <p className="mb-4 text-sm text-muted-foreground">
              {formatDayLong(today)} (ข้อมูลตัวอย่าง)
            </p>
          )}
          <TeacherView
            today={today}
            retryHref={mine ? "/cleaning?view=mine" : "/cleaning"}
          />
        </>
      )}
    </>
  );
}

function PageTitle({ today, demo }: { today: string; demo: boolean }) {
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">
        เขตทำความสะอาด
      </h1>
      <p className="mt-1 mb-6 text-muted-foreground">
        {formatDayLong(today)}
        {demo && " (ข้อมูลตัวอย่าง)"}
      </p>
    </>
  );
}

/** The homeroom teacher's view: one card per classroom they advise. */
async function TeacherView({
  today,
  retryHref,
}: {
  today: string;
  retryHref: string;
}) {
  const mine = await getMyClassrooms();
  if (mine.failed) return <LoadError what="ห้องที่ปรึกษา" retryHref={retryHref} />;
  if (mine.rows.length === 0)
    return (
      <EmptyState
        title="ยังไม่ได้ระบุห้องที่ปรึกษา"
        hint="ติดต่อเจ้าหน้าที่งานอาคารสถานที่"
      />
    );

  const monday = mondayOf(today);
  const ids = mine.rows.map((r) => r.id);
  // Last week too: the RPC accepts a day up to 7 days back, which can fall in the previous week.
  const lastMonday = addDays(monday, -7);
  const [week, prev] = await Promise.all([
    getWeek(ids, monday),
    getWeek(ids, lastMonday),
  ]);
  if (week.failed || prev.failed) return <LoadError what="สถานะการยืนยัน" retryHref={retryHref} />;

  return (
    <div className="grid max-w-md gap-10">
      {mine.rows.map((room) => {
        const confirmations = week.confirmations.get(room.id) ?? new Map();
        const days = weekGrid({
          monday,
          today,
          offDays: week.offDays,
          confirmations,
          window: week.window,
        });
        const earlier = lateReachable(
          weekGrid({
            monday: lastMonday,
            today,
            offDays: prev.offDays,
            confirmations: prev.confirmations.get(room.id) ?? new Map(),
            window: prev.window,
          }),
          today,
        );
        const confirmation = confirmations.get(today) ?? null;
        const todayStatus = {
          ymd: today,
          state: dayState({ ymd: today, today, offDays: week.offDays, window: week.window, confirmation }),
          confirmation,
        };
        return (
          <ConfirmCard
            key={room.id}
            classroom={room}
            today={today}
            todayStatus={todayStatus}
            days={days}
            earlier={earlier}
            window={week.window}
          />
        );
      })}
    </div>
  );
}

/**
 * Loads the officer overview. Params: `level` (a grade level such as ม.1), `only=missing`, `day` (a past day for
 * the room cards), `week` (any day of
 * a past week; the table shows that Mon-Fri). Unknown or future values fall back to the default.
 */
async function OfficerView({ today, params }: { today: string; params: Params }) {
  const thisMonday = mondayOf(today);
  const weekParam = param(params.week);
  // The room cards show today, or an earlier day (?day=); a future or invalid day means today.
  const dayParam = param(params.day);
  const day = dayParam && isYmd(dayParam) && dayParam < today ? dayParam : today;
  // Any day of a past week is accepted and moved to its Monday; future weeks fall back to this one.
  const monday =
    weekParam && isYmd(weekParam) && mondayOf(weekParam) < thisMonday
      ? mondayOf(weekParam)
      : thisMonday;

  const [all, mine] = await Promise.all([getAllClassrooms(), getMyClassrooms()]);

  // Zones are areas of the school, not only buildings, so the page groups and filters rooms by grade level.
  const levels = levelsOf(all.rows.map((r) => r.name));
  const levelParam = param(params.level);
  const level = levels.includes(levelParam ?? "") ? levelParam : undefined;
  const filters: Filters = {
    level,
    only: param(params.only) === "missing" ? "missing" : undefined,
    week: monday === thisMonday ? undefined : monday,
    day: day === today ? undefined : day,
  };
  const retryHref = cleaningHref(filters);

  if (all.failed) return <LoadError what="รายชื่อห้องเรียน" retryHref={retryHref} />;

  if (all.rows.length === 0)
    return (
      <div className="space-y-4">
        {!mine.failed && mine.rows.length > 0 && <MyRoomsLink />}
        <EmptyState
          title="ยังไม่มีห้องเรียนในภาคเรียนนี้"
          hint="เพิ่มห้องเรียน ครูที่ปรึกษา และเขตทำความสะอาดก่อน แล้วหน้านี้จะแสดงสถานะทุกห้อง"
        >
          <div className="mt-2">
            <ManageLink />
          </div>
        </EmptyState>
      </div>
    );

  const scoped = level ? all.rows.filter((r) => levelOf(r.name) === level) : all.rows;
  const ids = scoped.map((r) => r.id);
  const dayMonday = mondayOf(day);
  const [now, picked, dayWeekData] = await Promise.all([
    getWeek(ids, thisMonday),
    monday === thisMonday ? null : getWeek(ids, monday),
    dayMonday === thisMonday || dayMonday === monday ? null : getWeek(ids, dayMonday),
  ]);
  const shown = picked ?? now;
  const dayWeek = dayMonday === thisMonday ? now : dayMonday === monday ? shown : dayWeekData;
  if (now.failed || shown.failed || !dayWeek || dayWeek.failed)
    return <LoadError what="สถานะการยืนยัน" retryHref={retryHref} />;

  const tiles: RoomToday[] = scoped.map((room) => {
    const confirmation = dayWeek.confirmations.get(room.id)?.get(day) ?? null;
    return {
      room,
      confirmation,
      state: dayState({ ymd: day, today, offDays: dayWeek.offDays, window: dayWeek.window, confirmation }),
    };
  });
  const weekRows = scoped.map((room) => ({
    room,
    days: weekGrid({
      monday,
      today,
      offDays: shown.offDays,
      confirmations: shown.confirmations.get(room.id) ?? new Map(),
      window: shown.window,
    }),
  }));

  return (
    <OfficerOverview
      today={today}
      day={day}
      monday={monday}
      filters={filters}
      levels={levels}
      levelTitles={levelTitles(all.rows.map((r) => r.name))}
      tiles={tiles}
      weekRows={weekRows}
      // Weekend or school off day only; the check window is shown separately.
      offDay={
        dayState({ ymd: day, today, offDays: dayWeek.offDays, confirmation: null }) === "off"
      }
      window={dayWeek.window}
      showMyRooms={!mine.failed && mine.rows.length > 0}
      reportBad={param(params.report) === "bad"}
    />
  );
}
