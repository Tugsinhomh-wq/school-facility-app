import { ChevronRight, Sparkles } from "lucide-react";

import { setFeedbackStatus } from "@/app/(dashboard)/feedback/actions";
import { TONE } from "@/components/dashboard/home-actions";
import { Pill } from "@/components/tickets/status-mark";
import { Button } from "@/components/ui/button";
import { formatDateTh, ROLE_LABEL } from "@/lib/ticket-meta";
import type {
  Feedback,
  FeedbackKind,
  FeedbackStatus,
  UserRole,
} from "@/types/database";

export type FeedbackItem = Feedback & {
  sender: { full_name: string; role: UserRole } | null;
};

const KIND_LABEL: Record<FeedbackKind, string> = {
  problem: "พบปัญหา",
  request: "ขอเพิ่ม",
  praise: "คำชม",
  other: "อื่นๆ",
};
const STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: "ใหม่",
  reviewing: "กำลังดู",
  done: "เสร็จแล้ว",
};
const STATUS_TONE = {
  new: { icon: Sparkles, className: "text-primary" },
  reviewing: TONE.wait,
  done: TONE.ok,
};

/** Short device description from a user-agent string: enough to tell phone from computer. */
function device(ua: string | null) {
  if (!ua) return null;
  const os = /iPhone|iPad/.test(ua)
    ? "iPhone/iPad"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS/.test(ua)
          ? "Mac"
          : /Linux/.test(ua)
            ? "Linux"
            : "อุปกรณ์อื่น";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Safari\//.test(ua)
        ? "Safari"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : "";
  return [os, browser].filter(Boolean).join(" · ");
}

/** One feedback as a quiet row; opening it shows the full message, screenshots and the status control. */
export function FeedbackRow({
  item: r,
  urlOf,
}: {
  item: FeedbackItem;
  urlOf: Map<string, string>;
}) {
  const sender = r.sender?.full_name ?? "ไม่ทราบชื่อ";
  const pill = (
    <Pill tone={STATUS_TONE[r.status]} label={STATUS_LABEL[r.status]} />
  );
  return (
    <li>
      <details className="group">
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 md:grid md:grid-cols-[minmax(0,1fr)_11rem_8rem_8rem_1.25rem] [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1 leading-snug md:flex-none">
            <span className="block truncate">
              <span className="font-semibold">{KIND_LABEL[r.kind]}</span>
              <span className="text-muted-foreground"> · {r.message}</span>
            </span>
            <span className="mt-0.5 block truncate text-sm text-muted-foreground md:hidden">
              {sender} ·{" "}
              <time dateTime={r.created_at}>{formatDateTh(r.created_at)}</time>
            </span>
            <span className="mt-1.5 block md:hidden">{pill}</span>
          </span>
          <span className="hidden min-w-0 truncate text-sm text-muted-foreground md:block">
            {sender}
          </span>
          <time
            dateTime={r.created_at}
            className="hidden text-sm whitespace-nowrap text-muted-foreground tabular-nums md:block"
          >
            {formatDateTh(r.created_at)}
          </time>
          <span className="hidden md:block">{pill}</span>
          <ChevronRight
            className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
            aria-hidden
          />
        </summary>

        <div className="space-y-4 border-t border-border bg-muted/30 px-4 py-4">
          <p className="text-sm text-muted-foreground">
            {sender}
            {r.sender ? ` (${ROLE_LABEL[r.sender.role]})` : ""} ·{" "}
            {formatDateTh(r.created_at)}
          </p>
          <p className="leading-relaxed break-words whitespace-pre-wrap">
            {r.message}
          </p>
          {r.image_paths.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {r.image_paths.map((p) =>
                urlOf.get(p) ? (
                  <a
                    key={p}
                    href={urlOf.get(p)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="เปิดรูปหน้าจอที่แนบ"
                    className="block size-28 overflow-hidden rounded-lg border border-border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={urlOf.get(p)}
                      alt="รูปหน้าจอที่แนบ"
                      className="size-full object-cover"
                    />
                  </a>
                ) : null,
              )}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {r.page_url ? `หน้าที่เปิดมาก่อน: ${r.page_url}` : "ไม่ระบุหน้า"}
            {device(r.user_agent) ? ` · ${device(r.user_agent)}` : ""}
          </p>
          <form
            action={setFeedbackStatus}
            className="flex flex-wrap items-center gap-2 border-t border-border pt-4"
          >
            <input type="hidden" name="id" value={r.id} />
            <span className="mr-1 text-sm text-muted-foreground">
              เปลี่ยนสถานะเป็น
            </span>
            {(["new", "reviewing", "done"] as const)
              .filter((s) => s !== r.status)
              .map((s) => (
                <Button
                  key={s}
                  type="submit"
                  name="status"
                  value={s}
                  variant="outline"
                  className="h-11 px-5"
                >
                  {STATUS_LABEL[s]}
                </Button>
              ))}
          </form>
        </div>
      </details>
    </li>
  );
}
