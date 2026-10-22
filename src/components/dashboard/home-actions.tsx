import { AlertCircle, CalendarClock, Check, ChevronRight, Clock, DoorOpen, Sparkles, Wrench, type LucideIcon } from "lucide-react";
import Link from "next/link";

import type { FollowUpCounts } from "@/lib/control/follow-up";
import type { TodayCounts } from "@/lib/data/cleaning-officer";
import type { getMyToday } from "@/lib/data/cleaning-teacher";
import type { DashboardBase, RepairsData, RoomsData } from "@/lib/data/dashboard";
import { isRoomManager, isStaffRole } from "@/lib/data/session";
import { APPROVAL_LABEL, STATUS_LABEL } from "@/lib/ticket-meta";
import { bangkokYmd, formatDayShort, formatInstantHm } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { ApprovalStatus, TicketStatus } from "@/types/database";

type Tone = "ok" | "alert" | "wait" | "quiet";
type Status = { label: string; tone: Tone };

/** One row of the home list: where it goes, a bold title with its count, and one grey detail line. */
export type ActionRow = {
  key: string;
  icon: LucideIcon;
  title: string;
  detail?: string;
  status?: Status;
  href: string;
  /** How many things wait for this person here; the greeting sums them. */
  todo: number;
};

export const TONE: Record<Tone, { icon: LucideIcon; className: string }> = {
  ok: { icon: Check, className: "text-emerald-800" },
  alert: { icon: AlertCircle, className: "text-red-700" },
  wait: { icon: Clock, className: "text-amber-800" },
  quiet: { icon: Clock, className: "text-muted-foreground" },
};
export const TICKET_TONE: Record<TicketStatus, Tone> = { pending: "wait", in_progress: "wait", completed: "ok", cancelled: "quiet" };
export const APPROVAL_TONE: Record<ApprovalStatus, Tone> = { pending: "wait", approved: "ok", rejected: "alert", revision_requested: "alert" };
/** getPendingReservations reads at most this many; a full page may mean more. */
const PENDING_PAGE = 8;

const when = (iso: string) => `${formatDayShort(bangkokYmd(new Date(iso)))} ${formatInstantHm(iso)} น.`;

export type HomeData = {
  base: DashboardBase;
  repairs: RepairsData;
  rooms: RoomsData;
  /** Officers only (null for everyone else). */
  counts: TodayCounts;
  mine: Awaited<ReturnType<typeof getMyToday>>;
  /** Improvement measures near or past their due date; null = signed out, an executive, or the load failed (no row). */
  followUp: FollowUpCounts | null;
};

/** Turns the data the home page already loads into rows, by role: officers see what waits for a decision, teachers their own items. */
export function buildRows({ base, repairs, rooms, counts, mine, followUp }: HomeData): ActionRow[] {
  const role = base.viewer?.role;
  const rows: ActionRow[] = [];

  const advisor: ActionRow[] = [];
  if (mine.failed) {
    advisor.push({ key: "mine-cleaning", icon: Sparkles, title: "เขตทำความสะอาดห้องที่ปรึกษา", status: { label: "โหลดไม่สำเร็จ แตะเพื่อลองใหม่", tone: "alert" }, href: "/cleaning", todo: 0 });
  } else if (mine.rows.length > 0) {
    const open = mine.rows.filter((r) => r.state === "pending");
    const done = mine.rows.some((r) => r.state === "confirmed" || r.state === "late");
    advisor.push({
      key: "mine-cleaning",
      icon: Sparkles,
      title: open.length > 0 ? `ยืนยันเขตทำความสะอาด ${open.length} ห้อง` : "เขตทำความสะอาดวันนี้",
      status: open.length > 0 ? { label: "ยังไม่ยืนยัน", tone: "alert" } : done ? { label: "ยืนยันแล้ว", tone: "ok" } : { label: "วันหยุด", tone: "quiet" },
      detail: (open.length > 0 ? open : mine.rows).map((r) => r.name).join(" · "),
      href: counts ? "/cleaning?view=mine" : "/cleaning",
      todo: open.length,
    });
  }

  if (isStaffRole(role)) {
    const top = repairs.newestPending;
    rows.push({
      key: "repair",
      icon: Wrench,
      title: `แจ้งซ่อมรอรับเรื่อง ${base.pending} เรื่อง`,
      detail: [base.emergencyOpen > 0 && `ฉุกเฉิน ${base.emergencyOpen} เรื่อง`, top && `ล่าสุด: ${top.title}`].filter(Boolean).join(" · ") || "ไม่มีงานรอรับเรื่อง",
      href: "/tickets?status=pending",
      todo: base.pending,
    });
  } else {
    const last = repairs.latest;
    rows.push({
      key: "repair",
      icon: Wrench,
      title: last ? "งานซ่อมล่าสุดของฉัน" : "แจ้งซ่อม",
      status: last ? { label: STATUS_LABEL[last.status], tone: TICKET_TONE[last.status] } : undefined,
      detail: last ? last.title : "ยังไม่มีรายการแจ้งซ่อม แตะที่นี่เพื่อเปิดหน้าแจ้งซ่อม",
      href: last ? `/tickets/${last.id}` : "/tickets",
      todo: 0,
    });
  }

  if (isRoomManager(role)) {
    const list = rooms.pendingReservations;
    const n = list.length >= PENDING_PAGE ? `${list.length}+` : list.length;
    rows.push({
      key: "booking",
      icon: DoorOpen,
      title: `คำขอจองห้องรออนุมัติ ${n} รายการ`,
      detail: list[0] ? `${list[0].room_name} · ${when(list[0].start_time)}` : "ไม่มีคำขอค้างอนุมัติ",
      href: "/meeting-rooms",
      todo: list.length,
    });
  } else {
    const list = rooms.myReservations;
    const [last] = list;
    rows.push({
      key: "booking",
      icon: DoorOpen,
      title: last ? `คำขอจองห้องของฉัน ${list.length} รายการ` : "จองห้องประชุม",
      status: last && { label: APPROVAL_LABEL[last.status], tone: APPROVAL_TONE[last.status] },
      detail: last ? `${last.room_name} · ${when(last.start_time)}` : "ยังไม่มีคำขอ แตะเพื่อขอใช้ห้อง",
      href: "/meeting-rooms",
      todo: list.filter((r) => r.status === "revision_requested").length,
    });
  }

  if (counts) {
    if ("failed" in counts) {
      rows.push({ key: "cleaning", icon: Sparkles, title: "เขตทำความสะอาด", status: { label: "โหลดไม่สำเร็จ แตะเพื่อลองใหม่", tone: "alert" }, href: "/cleaning", todo: 0 });
    } else {
      const missing = counts.off ? 0 : Math.max(0, counts.total - counts.confirmed);
      rows.push({
        key: "cleaning",
        icon: Sparkles,
        title: counts.off || counts.total === 0 ? "เขตทำความสะอาด" : `ห้องเรียนยังไม่ยืนยันเขต ${missing} ห้อง`,
        detail:
          counts.total === 0
            ? "ยังไม่มีห้องเรียนในภาคเรียนนี้"
            : counts.off
              ? "วันนี้เป็นวันหยุด ไม่ต้องยืนยัน"
              : `ยืนยันแล้ว ${counts.confirmed} / ${counts.total} ห้อง`,
        href: "/cleaning?only=missing",
        todo: missing,
      });
    }
  }

  // Anyone who can open /control (not an executive, not signed out); RLS already limits whose measures are counted.
  if (followUp && followUp.alert > 0) {
    rows.push({
      key: "control-follow-up",
      icon: CalendarClock,
      title: `มาตรการควบคุมภายในที่ใกล้หรือเกินกำหนด ${followUp.alert} รายการ`,
      detail: `เกินกำหนด ${followUp.overdue} · ใกล้ถึง ${followUp.soon}`,
      href: "/control/follow-up",
      todo: followUp.alert,
    });
  }

  // An advisor's own room is their first job; an officer's overview comes after the queues.
  return counts ? [...rows, ...advisor] : [...advisor, ...rows];
}

/** The quiet home: a bordered list of rows, each linking to the page that handles it. */
export function ActionList({ rows }: { rows: ActionRow[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
      {rows.map(({ key, icon: Icon, title, detail, status, href }) => {
        const tone = status && TONE[status.tone];
        return (
          <li key={key}>
            <Link
              href={href}
              className="flex min-h-16 items-center gap-4 px-4 py-4 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-5"
            >
              <Icon className="size-6 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1 leading-snug">
                <span className="block font-semibold">{title}</span>
                {(status || detail) && (
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                    {status && tone && (
                      <span className={cn("inline-flex items-center gap-1 font-medium", tone.className)}>
                        <tone.icon className="size-4" aria-hidden />
                        {status.label}
                      </span>
                    )}
                    {detail && <span className="min-w-0 break-words">{detail}</span>}
                  </span>
                )}
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
