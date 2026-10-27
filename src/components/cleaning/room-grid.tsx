import { CheckCircle2, UserX } from "lucide-react";

import { PhotoPeek } from "@/components/cleaning/photo-peek";
import type { DayState } from "@/lib/cleaning";
import type { ClassroomRow, WeekConfirmation } from "@/lib/data/cleaning";
import { formatInstantHm } from "@/lib/time";
import { cn } from "@/lib/utils";

export type RoomToday = {
  room: ClassroomRow;
  state: DayState;
  confirmation: WeekConfirmation | null;
};

const PILL: Partial<Record<DayState, { label: string; className: string }>> = {
  pending: {
    label: "ยังไม่ยืนยัน",
    className: "bg-red-500/10 text-red-800 ring-1 ring-red-500/40 dark:text-red-300",
  },
  off: { label: "วันหยุด", className: "bg-muted text-muted-foreground" },
};

const CONFIRMED_PILL =
  "bg-emerald-500/10 text-emerald-800 ring-1 ring-emerald-600/30 dark:text-emerald-300";

/**
 * Today's status of every room, in the order given (the page puts unconfirmed rooms first).
 * A room still waiting for today's confirmation has a red border.
 */
export function RoomGrid({ rooms, today }: { rooms: RoomToday[]; today: string }) {
  return (
    <ul className="grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rooms.map(({ room, state, confirmation: c }) => {
        const missing = state === "pending";
        const pill = c ? null : PILL[state];
        const advisors = room.advisors.map((a) => a.name).join(", ");
        return (
          <li
            key={room.id}
            className={cn(
              "flex min-w-0 flex-col gap-1.5 rounded-xl border bg-card p-3 shadow-xs",
              missing ? "border-2 border-red-500 dark:border-red-400" : "border-border",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0">
                <span className="text-base font-semibold tabular-nums">{room.name}</span>
                {room.building && (
                  <span className="ml-1.5 text-xs text-muted-foreground">{room.building}</span>
                )}
              </p>
              {c ? (
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                    CONFIRMED_PILL,
                  )}
                >
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  ยืนยันแล้ว
                </span>
              ) : (
                pill && (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                      pill.className,
                    )}
                  >
                    {pill.label}
                  </span>
                )
              )}
            </div>
            {room.zone ? (
              <p className="text-sm leading-snug break-words">{room.zone}</p>
            ) : (
              <p className="text-sm text-muted-foreground">ยังไม่กำหนดเขต</p>
            )}
            {advisors ? (
              <p className="text-xs text-muted-foreground break-words">ครูที่ปรึกษา: {advisors}</p>
            ) : (
              <p className="inline-flex w-fit items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                <UserX className="size-3.5" aria-hidden />
                ยังไม่มีครูที่ปรึกษา
              </p>
            )}
            {c && (
              <div className="mt-auto space-y-0.5 border-t border-border pt-1.5">
                <p className="text-xs text-emerald-800 dark:text-emerald-300">
                  โดย {c.byName} · {formatInstantHm(c.at)} น.
                  {c.isLate && " (ย้อนหลัง)"}
                </p>
                {c.photos > 0 && (
                  <PhotoPeek classroomId={room.id} day={today} count={c.photos} />
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
