import { ChevronLeft, ChevronRight, DoorOpen, Settings } from "lucide-react";
import Link from "next/link";

import { ReportForm } from "@/components/cleaning/report-form";
import { RoomGrid, type RoomToday } from "@/components/cleaning/room-grid";
import { WeeklyTable, type WeekRow } from "@/components/cleaning/weekly-table";
import { EmptyState } from "@/components/ui/state-card";
import { inCheckWindow, overviewOrder, stepSchoolDay, windowText, type CheckWindow } from "@/lib/cleaning";
import { addDays, formatDateShort, formatDayLong, formatDayShort, mondayOf } from "@/lib/time";
import { cn } from "@/lib/utils";

export type Filters = { building?: string; only?: "missing"; week?: string; day?: string };

/** /cleaning with these filters; the default values are left out so the URL stays short. */
export function cleaningHref(f: Filters, hash = "") {
  const q = new URLSearchParams();
  if (f.building) q.set("building", f.building);
  if (f.only) q.set("only", f.only);
  if (f.week) q.set("week", f.week);
  if (f.day) q.set("day", f.day);
  const s = q.toString();
  return `/cleaning${s ? `?${s}` : ""}${hash}`;
}

const dayLink =
  "inline-flex min-h-11 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-9";

export const chip = (active: boolean) =>
  cn(
    "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-9",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-card/80 hover:bg-muted",
  );

/** For an officer who also advises a class: their own confirm cards. */
export function MyRoomsLink() {
  return (
    <Link
      href="/cleaning?view=mine"
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
    >
      <DoorOpen className="size-4" aria-hidden />
      ห้องของฉัน
    </Link>
  );
}

/** Classrooms, advisors, zones, import, rollover and off days. */
export function ManageLink() {
  return (
    <Link
      href="/cleaning/manage"
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
    >
      <Settings className="size-4" aria-hidden />
      ตั้งค่าห้องและเขต
    </Link>
  );
}

/**
 * Facility officers: every classroom's status today (unconfirmed first, red border), filtered by
 * building and "only unconfirmed", then the room × day table of a chosen week. No reminders are
 * sent; the officer follows up in person.
 */
export function OfficerOverview({
  today,
  day,
  monday,
  filters,
  buildings,
  tiles,
  weekRows,
  offDay,
  window,
  showMyRooms,
  reportBad,
}: {
  today: string;
  /** The day the room cards show: today, or an earlier day the officer paged back to. */
  day: string;
  /** Monday of the week shown in the table. */
  monday: string;
  filters: Filters;
  /** [building id, name], sorted. */
  buildings: (readonly [string, string])[];
  /** The state of every room on `day` in the selected building (or all). */
  tiles: RoomToday[];
  weekRows: WeekRow[];
  /** `day` is a weekend or a school off day. */
  offDay: boolean;
  window: CheckWindow;
  showMyRooms: boolean;
  /** The report form was sent with a bad range. */
  reportBad?: boolean;
}) {
  const thisMonday = mondayOf(today);
  const { building } = filters;
  const onlyMissing = filters.only === "missing";
  const outside = !inCheckWindow(day, window);
  const isToday = day === today;
  const dayLabel = isToday ? "วันนี้" : formatDateShort(day);
  const isMissing = (t: RoomToday) => t.state === "pending" || t.state === "missed";
  const confirmed = tiles.filter((t) => t.confirmation).length;
  const missing = tiles.filter(isMissing).length;
  const prevDay = stepSchoolDay(day, -1);
  const nextDay = stepSchoolDay(day, 1);
  const visible = overviewOrder(
    onlyMissing ? tiles.filter(isMissing) : tiles,
    isMissing,
    (t) => t.room.name,
  );
  const friday = addDays(monday, 4);
  const myRooms = showMyRooms ? <MyRoomsLink /> : null;

  return (
    <div className="space-y-8">
      <section aria-labelledby="today-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="today-title" className="text-sm font-semibold text-muted-foreground">
              {isToday ? "วันนี้" : formatDayLong(day)}
              {building && ` · ${buildings.find(([id]) => id === building)?.[1]}`}
            </h2>
            <p className="text-2xl font-bold tabular-nums">
              ยืนยันแล้ว {confirmed} / {tiles.length} ห้อง
            </p>
            {outside ? (
              <p className="text-sm text-muted-foreground">
                ยังไม่อยู่ในช่วงเช็ก · {windowText(window, day)}
              </p>
            ) : offDay ? (
              <p className="text-sm text-muted-foreground">{dayLabel}เป็นวันหยุด ไม่ต้องยืนยัน</p>
            ) : (
              missing > 0 && (
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  {isToday ? "ยังไม่ยืนยัน" : "ไม่ได้ยืนยัน"} {missing} ห้อง
                </p>
              )
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {myRooms}
            <ManageLink />
          </div>
        </div>

        <nav aria-label="เลือกวัน" className="flex flex-wrap items-center gap-2">
          <Link href={cleaningHref({ ...filters, day: prevDay })} className={dayLink}>
            <ChevronLeft className="size-4" aria-hidden />
            วันก่อน
          </Link>
          {!isToday && nextDay <= today && (
            <Link href={cleaningHref({ ...filters, day: nextDay === today ? undefined : nextDay })} className={dayLink}>
              วันถัดไป
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          )}
          {!isToday && (
            <Link href={cleaningHref({ ...filters, day: undefined })} className={cn(dayLink, "border-primary text-primary")}>
              กลับมาวันนี้
            </Link>
          )}
        </nav>

        <nav
          aria-label="กรองห้องเรียน"
          className="-mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:w-auto sm:flex-wrap sm:px-0"
        >
          {/* First, so it is in view on a phone without scrolling the chip row. */}
          <Link
            href={cleaningHref({ ...filters, only: onlyMissing ? undefined : "missing" })}
            aria-current={onlyMissing ? "page" : undefined}
            className={cn(
              chip(onlyMissing),
              !onlyMissing && missing > 0 && "border-red-500/50 text-red-800 dark:text-red-300",
            )}
          >
            เฉพาะที่ยังไม่ยืนยัน{missing > 0 && ` (${missing})`}
          </Link>
          <span aria-hidden className="mx-1 w-px shrink-0 self-stretch bg-border" />
          <Link
            href={cleaningHref({ ...filters, building: undefined })}
            aria-current={!building ? "page" : undefined}
            className={chip(!building)}
          >
            ทุกอาคาร
          </Link>
          {buildings.map(([id, name]) => (
            <Link
              key={id}
              href={cleaningHref({ ...filters, building: id })}
              aria-current={building === id ? "page" : undefined}
              className={chip(building === id)}
            >
              {name}
            </Link>
          ))}
        </nav>

        {visible.length > 0 ? (
          <RoomGrid
            rooms={visible}
            day={day}
            offLabel={outside && !offDay ? "ยังไม่อยู่ในช่วงเช็ก" : "วันหยุด"}
          />
        ) : (
          <EmptyState
            tone={outside ? "neutral" : "good"}
            title={outside ? "ยังไม่อยู่ในช่วงเช็ก" : offDay ? `${dayLabel}เป็นวันหยุด` : "ทุกห้องยืนยันแล้ว"}
            hint={
              outside
                ? windowText(window, day)
                : offDay
                  ? "วันหยุดไม่ต้องยืนยันเขต"
                  : `ไม่มีห้องที่ยังไม่ยืนยันเขต${dayLabel}`
            }
          >
            <Link
              href={cleaningHref({ ...filters, only: undefined })}
              className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              ดูทุกห้อง
            </Link>
          </EmptyState>
        )}
      </section>

      <section id="weekly" aria-labelledby="weekly-title" className="scroll-mt-20 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="weekly-title" className="text-lg font-semibold">
              สรุปรายสัปดาห์
            </h2>
            <p className="text-sm text-muted-foreground">
              {formatDayShort(monday)} – {formatDayShort(friday)}
              {monday === thisMonday && " (สัปดาห์นี้)"}
            </p>
          </div>
          <nav aria-label="เลือกสัปดาห์" className="flex items-center gap-1.5">
            <Link
              href={cleaningHref({ ...filters, week: addDays(monday, -7) }, "#weekly")}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm hover:bg-muted sm:min-h-9"
            >
              <ChevronLeft className="size-4" aria-hidden />
              สัปดาห์ก่อน
            </Link>
            {monday < thisMonday && (
              <Link
                href={cleaningHref(
                  {
                    ...filters,
                    week: addDays(monday, 7) < thisMonday ? addDays(monday, 7) : undefined,
                  },
                  "#weekly",
                )}
                className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border bg-card px-3 text-sm hover:bg-muted sm:min-h-9"
              >
                สัปดาห์ถัดไป
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            )}
          </nav>
        </div>
        <WeeklyTable rows={weekRows} monday={monday} />
        <p className="text-xs text-muted-foreground">
          รวม = วันที่ยืนยันแล้ว / วันที่ต้องยืนยัน (ไม่นับวันหยุด วันนอกช่วงเช็ก วันที่ยังไม่ถึง และวันนี้ถ้ายังไม่ยืนยัน)
        </p>
      </section>

      <ReportForm today={today} bad={reportBad} />
    </div>
  );
}
