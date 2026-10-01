import Link from "next/link";
import { redirect } from "next/navigation";

import { setFeedbackStatus } from "@/app/(dashboard)/feedback/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/data/session";
import { formatDateTh, ROLE_LABEL } from "@/lib/ticket-meta";
import { cn } from "@/lib/utils";
import type {
  Feedback,
  FeedbackKind,
  FeedbackStatus,
  UserRole,
} from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ความคิดเห็น | ระบบแจ้งซ่อม โรงเรียนละหานทรายรัชดาภิเษก",
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
const FILTERS: { key: string; label: string }[] = [
  { key: "open", label: "ยังไม่เสร็จ" },
  { key: "done", label: "เสร็จแล้ว" },
  { key: "all", label: "ทั้งหมด" },
];

type Row = Feedback & { sender: { full_name: string; role: UserRole } | null };

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

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.viewer.role !== "super_admin") redirect("/");

  const { show: showParam } = await searchParams;
  const show = FILTERS.some((f) => f.key === showParam) ? showParam! : "open";
  let query = session.supabase
    .from("feedback")
    .select("*, sender:profiles(full_name, role)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (show === "open") query = query.neq("status", "done");
  if (show === "done") query = query.eq("status", "done");
  const { data, error } = await query;
  const rows = (data ?? []) as unknown as Row[];

  // Screenshots sit in a private bucket: one batch of signed links per page load.
  const paths = rows.flatMap((r) => r.image_paths);
  const signed = paths.length
    ? ((
        await session.supabase.storage
          .from("feedback-images")
          .createSignedUrls(paths, 3600)
      ).data ?? [])
    : [];
  const urlOf = new Map<string, string>();
  for (const s of signed)
    if (s.path && s.signedUrl) urlOf.set(s.path, s.signedUrl);

  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">
        ความคิดเห็นจากผู้ใช้
      </h1>
      <p className="mt-1 text-muted-foreground">
        ส่งมาจากปุ่ม &ldquo;ส่งความคิดเห็น&rdquo; ในหน้าบัญชีของฉัน
        เห็นเฉพาะผู้ดูแลระบบ
      </p>

      <div
        role="tablist"
        aria-label="กรอง"
        className="mt-6 inline-flex rounded-lg border border-border bg-card/85 p-0.5 text-sm"
      >
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/feedback?show=${f.key}`}
            role="tab"
            aria-selected={show === f.key}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium",
              show === f.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-6 text-sm text-destructive">
          โหลดไม่สำเร็จ ลองรีเฟรชหน้านี้
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border bg-card/60 p-10 text-center text-muted-foreground">
          ยังไม่มีความคิดเห็นในหมวดนี้
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-border bg-card/85 p-4 backdrop-blur-sm sm:p-5"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Badge variant="outline">{KIND_LABEL[r.kind]}</Badge>
                <span className="font-medium">
                  {r.sender?.full_name ?? "ไม่ทราบชื่อ"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {r.sender ? ROLE_LABEL[r.sender.role] : ""} ·{" "}
                  {formatDateTh(r.created_at)}
                </span>
                <Badge className="ml-auto">{STATUS_LABEL[r.status]}</Badge>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                {r.message}
              </p>
              {r.image_paths.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.image_paths.map((p) =>
                    urlOf.get(p) ? (
                      <a
                        key={p}
                        href={urlOf.get(p)}
                        target="_blank"
                        rel="noreferrer"
                        className="block size-24 overflow-hidden rounded-lg border border-border"
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
              <p className="mt-3 text-xs text-muted-foreground">
                {r.page_url
                  ? `หน้าที่เปิดมาก่อน: ${r.page_url}`
                  : "ไม่ระบุหน้า"}
                {device(r.user_agent) ? ` · ${device(r.user_agent)}` : ""}
              </p>
              <form
                action={setFeedbackStatus}
                className="mt-3 flex flex-wrap gap-2"
              >
                <input type="hidden" name="id" value={r.id} />
                {(["new", "reviewing", "done"] as const)
                  .filter((s) => s !== r.status)
                  .map((s) => (
                    <Button
                      key={s}
                      type="submit"
                      name="status"
                      value={s}
                      size="sm"
                      variant="outline"
                    >
                      ทำเครื่องหมาย: {STATUS_LABEL[s]}
                    </Button>
                  ))}
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
