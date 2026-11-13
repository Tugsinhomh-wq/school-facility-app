import { Check, ChevronRight, DoorOpen, Minus, Wrench, X } from "lucide-react";
import Link from "next/link";

import { ConfirmToday } from "@/components/dashboard/confirm-today";
import { TONE, type ActionRow } from "@/components/dashboard/home-actions";
import { buttonVariants } from "@/components/ui/button";
import type { DayState } from "@/lib/cleaning";
import type { MyDay } from "@/lib/data/cleaning-teacher";
import { formatDayShort } from "@/lib/time";
import { cn } from "@/lib/utils";

/** What each day of the week shows inside its pill: a short word, and a longer one for screen readers. */
const MARK: Record<DayState, { text: string; full: string; icon: typeof Check | null }> = {
  confirmed: { text: "แล้ว", full: "ยืนยันแล้ว", icon: Check },
  late: { text: "แล้ว", full: "ยืนยันย้อนหลังแล้ว", icon: Check },
  pending: { text: "วันนี้", full: "วันนี้ ยังไม่ยืนยัน", icon: null },
  missed: { text: "ค้าง", full: "ยังไม่ยืนยัน", icon: X },
  off: { text: "หยุด", full: "วันหยุด", icon: Minus },
  future: { text: "", full: "ยังไม่ถึง", icon: null },
};

/** Mon-Fri as five tall pills: the weekday, the date as a figure, and one word about the day. */
function WeekLane({ days, today }: { days: MyDay["days"]; today: string }) {
  return (
    <ol className="grid grid-cols-5 gap-1.5 sm:gap-2" aria-label="การยืนยันเขตรายวันของสัปดาห์นี้">
      {days.map((d) => {
        const [dow, date] = formatDayShort(d.ymd).split(" ");
        const mark = MARK[d.state];
        const isToday = d.ymd === today;
        return (
          <li
            key={d.ymd}
            aria-current={isToday ? "date" : undefined}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-full border px-1 py-3 text-center",
              isToday ? "border-foreground bg-card" : "border-input",
            )}
          >
            <span className="text-sm font-medium text-muted-foreground">{dow}</span>
            <span className={cn("font-display text-2xl font-medium leading-snug tabular-nums", isToday && "text-primary")}>{date}</span>
            <span className="flex min-h-6 items-center gap-0.5 text-xs font-medium text-foreground/80">
              {mark.icon && <mark.icon className="size-3.5" aria-hidden />}
              <span aria-hidden>{mark.text}</span>
              <span className="sr-only">{mark.full}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** One advised classroom: today's status, the single action, and the week. */
export function CleaningDesk({ room, today, outside }: { room: MyDay; today: string; outside: boolean }) {
  const missed = room.days.filter((d) => d.state === "missed").length;
  return (
    <section aria-labelledby={`desk-${room.id}`} className="rounded-2xl bg-secondary p-4 shadow-xs sm:p-6">
      <h2 id={`desk-${room.id}`} className="font-display text-2xl font-medium leading-snug">
        ยืนยันเขตทำความสะอาด
      </h2>
      <p className="mt-0.5 text-lg text-muted-foreground">{room.name}</p>

      <div className="mt-5">
        {room.state === "pending" && (
          <>
            <ConfirmToday classroomId={room.id} />
            <p className="mt-3 text-sm text-muted-foreground">
              แนบรูปหรือยกเลิกการยืนยันได้ที่หน้าเขตทำความสะอาด ยกเลิกได้เฉพาะวันนี้และเมื่อวาน
            </p>
          </>
        )}
        {(room.state === "confirmed" || room.state === "late") && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="inline-flex items-center gap-2 font-display text-xl font-medium">
              <Check className="size-7 text-primary" aria-hidden />
              ยืนยันแล้ว
            </p>
            <Link href="/cleaning" className={cn(buttonVariants({ variant: "outline" }), "h-11 rounded-full px-5 text-sm")}>
              แนบรูปหรือยกเลิก
            </Link>
          </div>
        )}
        {(room.state === "off" || room.state === "future") && (
          <p className="text-muted-foreground">
            {outside ? "ยังไม่อยู่ในช่วงเช็ก ไม่ต้องยืนยัน" : "วันนี้เป็นวันหยุด ไม่ต้องยืนยัน"}
          </p>
        )}
      </div>

      {missed > 0 && (
        <p className="mt-4 text-sm">
          มี {missed} วันที่ยังไม่ยืนยัน{" "}
          <Link href="/cleaning" className="font-medium text-primary underline underline-offset-4">
            ไปยืนยันย้อนหลัง
          </Link>
        </p>
      )}

      <div className="mt-6 border-t border-input pt-5">
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">สัปดาห์นี้</h3>
        <WeekLane days={room.days} today={today} />
      </div>
    </section>
  );
}

/** What waits for this person elsewhere, as rows with a status pill, plus the two jobs anyone can start. */
export function MineCard({ rows, title, sample }: { rows: ActionRow[]; title: string; sample: boolean }) {
  return (
    <section aria-labelledby="mine-h" className="rounded-2xl bg-secondary p-4 shadow-xs sm:p-6">
      <h2 id="mine-h" className="font-display text-2xl font-medium leading-snug">
        {title}
        {sample && (
          <span className="ml-2 rounded-full border border-input px-2 py-0.5 align-middle text-xs font-medium text-muted-foreground">
            ข้อมูลตัวอย่าง
          </span>
        )}
      </h2>
      {rows.length > 0 && (
        <ul className="mt-2 divide-y divide-input/70">
          {rows.map(({ key, title: t, detail, status, href }) => {
            const tone = status && TONE[status.tone];
            return (
              <li key={key}>
                <Link
                  href={href}
                  className="-mx-2 flex min-h-[4.5rem] items-center gap-3 rounded-xl px-2 py-2 outline-none transition-colors hover:bg-card/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium leading-snug">{t}</span>
                    {detail && <span className="block text-sm text-muted-foreground break-words">{detail}</span>}
                  </span>
                  {status && tone && (
                    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border border-input bg-card px-3 py-0.5 text-sm font-medium", tone.className)}>
                      <tone.icon className="size-4" aria-hidden />
                      {status.label}
                    </span>
                  )}
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/tickets" className={cn(buttonVariants({ variant: "outline" }), "h-12 rounded-full px-5 text-sm")}>
          <Wrench className="size-4" aria-hidden />
          แจ้งซ่อม
        </Link>
        <Link href="/meeting-rooms" className={cn(buttonVariants({ variant: "outline" }), "h-12 rounded-full px-5 text-sm")}>
          <DoorOpen className="size-4" aria-hidden />
          ขอใช้ห้อง
        </Link>
      </div>
    </section>
  );
}
