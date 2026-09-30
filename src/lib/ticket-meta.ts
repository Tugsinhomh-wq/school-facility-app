import type { ApprovalStatus, TicketStatus, UrgencyLevel, UserRole } from "@/types/database";

export const STATUS_LABEL: Record<TicketStatus, string> = {
  pending: "รอรับเรื่อง",
  in_progress: "กำลังดำเนินการ",
  completed: "ซ่อมเสร็จสิ้น",
  cancelled: "ยกเลิก",
};

export const URGENCY_LABEL: Record<UrgencyLevel, string> = {
  low: "ไม่เร่งด่วน",
  medium: "ปานกลาง",
  high: "เร่งด่วน",
  emergency: "ฉุกเฉิน",
};

export const URGENCY_CLASS: Record<UrgencyLevel, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
  medium: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300",
  high: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  emergency: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
};

export const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  pending: "รอพิจารณา",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
  revision_requested: "ขอแก้ไข",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: "ผู้ดูแลระบบ",
  staff: "เจ้าหน้าที่",
  user: "ผู้ใช้งาน",
};

export function formatBaht(value: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Relative Thai time, e.g. "5 นาทีที่แล้ว". */
export function timeAgoTh(iso: string, now = Date.now()) {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "เมื่อสักครู่";
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ชั่วโมงที่แล้ว`;
  return `${Math.floor(hr / 24)} วันที่แล้ว`;
}
