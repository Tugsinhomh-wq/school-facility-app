import { UserX } from "lucide-react";

import { PhotoPeek } from "@/components/cleaning/photo-peek";
import type { DayState } from "@/lib/cleaning";
import { groupByLevel } from "@/lib/cleaning-level";
import type { ClassroomRow, WeekConfirmation } from "@/lib/data/cleaning";
import { formatInstantHm } from "@/lib/time";
import { cn } from "@/lib/utils";

export type RoomToday = {
  room: ClassroomRow;
  state: DayState;
  confirmation: WeekConfirmation | null;
};

/** One pale tint per level (a tray is a colour of plastic, never a state); the sixth is followed by the first again. */
export const TRAY_TINTS = ["bg-tray-1", "bg-tray-2", "bg-tray-3", "bg-tray-4", "bg-tray-5", "bg-tray-6"] as const;

/**
 * Every room on `day`, one tray per grade level and one paper label per room. A room that has been confirmed is
 * stamped with the time and who; a room still open stays grey with a dashed tear-off stub (no alarm colour: the
 * officer follows up in person, and the label says plainly what is missing). The order inside a tray is the order
 * given (the page puts open rooms first).
 */
export function LevelTrays({
  rooms,
  day,
  offLabel = "วันหยุด",
}: {
  rooms: RoomToday[];
  day: string;
  /** What a not-due day is called: "วันหยุด", or "ยังไม่อยู่ในช่วงเช็ก" outside the check window. */
  offLabel?: string;
}) {
  const groups = groupByLevel(rooms, (r) => r.room.name);
  return (
    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      {groups.map(({ level, rows }, i) => {
        const open = rows.filter((r) => r.state === "pending" || r.state === "missed").length;
        return (
          <section
            key={level}
            aria-labelledby={`level-${i}`}
            className={cn("rounded-2xl p-3 shadow-xs ring-1 ring-black/5 sm:p-4", TRAY_TINTS[i % TRAY_TINTS.length])}
          >
            <header className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3">
              <h3 id={`level-${i}`} className="font-display text-xl font-semibold">
                {level}
              </h3>
              <p className="text-sm text-foreground/80 tabular-nums">
                {open > 0 ? `ยังไม่ยืนยัน ${open} จาก ${rows.length} ห้อง` : `ยืนยันครบ ${rows.length} ห้อง`}
              </p>
            </header>
            <ul className="grid gap-2">
              {rows.map(({ room, state, confirmation: c }) => {
                const advisors = room.advisors.map((a) => a.name).join(", ");
                const stub = state === "off" ? offLabel : state === "missed" ? "ไม่ได้ยืนยัน" : "ยังไม่ยืนยัน";
                return (
                  <li key={room.id} className="min-w-0 rounded-lg bg-card p-3 shadow-sm ring-1 ring-border">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-xl font-semibold tabular-nums">{room.name}</span>
                      {room.building && <span className="text-xs text-muted-foreground">{room.building}</span>}
                    </p>
                    {room.zone ? (
                      <p className="mt-0.5 text-sm leading-snug break-words">{room.zone}</p>
                    ) : (
                      <p className="mt-0.5 text-sm text-muted-foreground">ยังไม่กำหนดเขต</p>
                    )}
                    {advisors ? (
                      <p className="text-xs break-words text-muted-foreground">ครูที่ปรึกษา: {advisors}</p>
                    ) : (
                      <p className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        <UserX className="size-3.5" aria-hidden />
                        ยังไม่มีครูที่ปรึกษา
                      </p>
                    )}
                    {c ? (
                      <div className="mt-3 space-y-1.5">
                        <p className="ml-1 inline-grid -rotate-2 justify-items-center rounded-xl px-3 py-1 text-center leading-snug text-emerald-800 ring-2 ring-emerald-700 ring-offset-2 ring-offset-card">
                          <span className="text-xs font-medium">ยืนยันแล้ว</span>
                          <span className="text-base font-semibold tabular-nums">{formatInstantHm(c.at)} น.</span>
                          <span className="text-xs">
                            โดย {c.byName}
                            {c.isLate && " (ย้อนหลัง)"}
                          </span>
                        </p>
                        {c.photos > 0 && <PhotoPeek classroomId={room.id} day={day} count={c.photos} />}
                      </div>
                    ) : (
                      <p className="mt-2.5 border-t-2 border-dashed border-border pt-1.5 text-sm font-semibold">{stub}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
