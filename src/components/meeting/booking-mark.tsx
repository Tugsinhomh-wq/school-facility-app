import { Check, Clock, Lock, User } from "lucide-react";

import { cn } from "@/lib/utils";

const MARKS = {
  free: { icon: Check, label: "ว่าง จองได้", className: "text-emerald-800" },
  booked: { icon: Lock, label: "จองแล้ว", className: "text-primary" },
  pending: { icon: Clock, label: "รออนุมัติ", className: "text-amber-800" },
  mine: { icon: User, label: "ของฉัน", className: "text-primary" },
};

/** A booking state as icon + word on a light wash (the same pill as the repair status). */
export function BookingMark({
  kind,
  className,
}: {
  kind: keyof typeof MARKS;
  className?: string;
}) {
  const { icon: Icon, label, className: tone } = MARKS[kind];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium whitespace-nowrap",
        tone,
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </span>
  );
}
