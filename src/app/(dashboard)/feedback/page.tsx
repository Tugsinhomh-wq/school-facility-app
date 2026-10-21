import Link from "next/link";
import { redirect } from "next/navigation";

import {
  FeedbackRow,
  type FeedbackItem,
} from "@/components/feedback/feedback-row";
import { EmptyState, LoadError } from "@/components/ui/state-card";
import { getSession } from "@/lib/data/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "ความคิดเห็น | สำนักงานออนไลน์ โรงเรียนละหานทรายรัชดาภิเษก",
};

const FILTERS: { key: string; label: string }[] = [
  { key: "open", label: "ยังไม่เสร็จ" },
  { key: "done", label: "เสร็จแล้ว" },
  { key: "all", label: "ทั้งหมด" },
];

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
  const rows = (data ?? []) as unknown as FeedbackItem[];

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
      <h1 className="font-display text-3xl font-medium tracking-tight">
        ความคิดเห็นจากผู้ใช้
      </h1>
      <p className="mt-1 text-muted-foreground">
        ส่งมาจากปุ่ม &ldquo;ส่งความคิดเห็น&rdquo; ในหน้าบัญชีของฉัน
        เห็นเฉพาะผู้ดูแลระบบ
      </p>

      <div className="mt-6 flex flex-wrap gap-2" aria-label="กรองตามสถานะ">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/feedback?show=${f.key}`}
            aria-current={show === f.key ? "true" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-4 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              show === f.key
                ? "border-primary bg-primary font-medium text-primary-foreground"
                : "border-input text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {error ? (
        <LoadError
          what="ความคิดเห็น"
          retryHref={`/feedback?show=${show}`}
          className="mt-6"
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="ยังไม่มีความคิดเห็นในหมวดนี้"
          className="mt-6 py-10"
        />
      ) : (
        <>
          <p className="mt-5 mb-2 text-sm text-muted-foreground">
            {rows.length} รายการ
          </p>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {rows.map((r) => (
              <FeedbackRow key={r.id} item={r} urlOf={urlOf} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
