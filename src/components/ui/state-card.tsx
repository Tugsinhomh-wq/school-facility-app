import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Empty list: say why it is empty and what to do next, never a blank card. */
export function EmptyState({
  title,
  hint,
  icon: Icon = Inbox,
  tone = "neutral",
  className,
  children,
}: {
  title: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "neutral" | "good";
  className?: string;
  children?: ReactNode;
}) {
  const Glyph = tone === "good" ? CheckCircle2 : Icon;
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-8 text-center",
        className,
      )}
    >
      <Glyph
        className={cn(
          "size-8",
          tone === "good" ? "text-emerald-600" : "text-muted-foreground",
        )}
        aria-hidden
      />
      <p className="font-medium">{title}</p>
      {hint && <p className="max-w-xs text-sm text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

/** Loading failed: explain in plain words and offer a retry (a normal link, so it re-requests the page). */
export function LoadError({
  what = "ข้อมูล",
  retryHref,
  className,
}: {
  what?: string;
  retryHref: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-8 text-center",
        className,
      )}
    >
      <AlertTriangle className="size-8 text-destructive" aria-hidden />
      <p className="font-semibold">โหลด{what}ไม่สำเร็จ</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        อาจเป็นเพราะสัญญาณอินเทอร์เน็ต ลองใหม่อีกครั้ง
        ถ้ายังไม่หายแจ้งผู้ดูแลระบบ
      </p>
      <a
        href={retryHref}
        className="mt-1 inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
      >
        ลองใหม่
      </a>
    </div>
  );
}
