import type { Viewer } from "@/lib/data/dashboard";
import { getSession, isRoomManager } from "@/lib/data/session";
import { MOCK_MEMOS, MOCK_TICKETS } from "@/lib/mock-data";
import type { Memorandum } from "@/types/database";
import type { TicketRow } from "@/types/tickets";

export type MemoRecord = Memorandum & {
  author: { full_name: string; position: string | null } | null;
};

const hasSupabase = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

const MOCK_AUTHOR = {
  full_name: "นายสมชาย รักงาน",
  position: "หัวหน้าฝ่ายอาคารสถานที่",
};
const mockMemos = (): MemoRecord[] =>
  MOCK_MEMOS.map((m) => ({ ...m, author: MOCK_AUTHOR }));

export interface MemoList {
  source: "supabase" | "mock";
  viewer: Viewer | null;
  memos: MemoRecord[];
  /** Open repair tickets that do not have a memo yet. */
  candidates: TicketRow[];
  /** Signed in, but loading failed: show an error with a retry instead of sample data. */
  failed?: boolean;
}

export async function getMemoList(): Promise<MemoList> {
  const mock = (): MemoList => {
    const used = new Set(MOCK_MEMOS.map((m) => m.reference_id));
    return {
      source: "mock",
      viewer: null,
      memos: mockMemos(),
      candidates: MOCK_TICKETS.filter(
        (t) =>
          t.status !== "completed" &&
          t.status !== "cancelled" &&
          !used.has(t.id),
      ).map((t) => ({ ...t, reporter: { full_name: "ครู ตัวอย่าง" } })),
    };
  };
  const failed = (): MemoList => ({
    source: "supabase",
    viewer: null,
    memos: [],
    candidates: [],
    failed: true,
  });
  if (!hasSupabase()) return mock();
  try {
    const s = await getSession();
    if (!s) return mock();
    if (!isRoomManager(s.viewer?.role))
      return {
        source: "supabase",
        viewer: s.viewer,
        memos: [],
        candidates: [],
      };

    // The meeting-room officer sees only room memos (row policies enforce it) and no repair tickets.
    const repairsToo = s.viewer.role !== "room_staff";
    const [memos, tickets] = await Promise.all([
      s.supabase
        .from("memorandums")
        .select("*, author:profiles(full_name, position)")
        .order("created_at", { ascending: false })
        .limit(100),
      repairsToo
        ? s.supabase
            .from("repair_tickets")
            .select(
              "*, building:buildings(name), room:rooms(room_number, name), reporter:profiles(full_name)",
            )
            .in("status", ["pending", "in_progress"])
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (memos.error || tickets.error) return failed();
    const used = new Set(
      (memos.data ?? [])
        .filter((m) => m.origin_module === "repair")
        .map((m) => m.reference_id),
    );
    return {
      source: "supabase",
      viewer: s.viewer,
      memos: memos.data as unknown as MemoRecord[],
      candidates: (tickets.data as unknown as TicketRow[]).filter(
        (t) => !used.has(t.id),
      ),
    };
  } catch {
    return failed();
  }
}

export interface MemoDetail {
  source: "supabase" | "mock";
  viewer: Viewer | null;
  memo: MemoRecord | null;
  /** Signed in, but loading failed: show an error with a retry instead of "not found". */
  failed?: boolean;
}

export async function getMemo(id: string): Promise<MemoDetail> {
  const mock = (): MemoDetail => ({
    source: "mock",
    viewer: null,
    memo: mockMemos().find((m) => m.id === id) ?? null,
  });
  const failed = (): MemoDetail => ({ source: "supabase", viewer: null, memo: null, failed: true });
  if (!hasSupabase()) return mock();
  try {
    const s = await getSession();
    if (!s) return mock();
    const { data, error } = await s.supabase
      .from("memorandums")
      .select("*, author:profiles(full_name, position)")
      .eq("id", id)
      .maybeSingle();
    // 22P02: the id is not a UUID, so there is no such memo (404), not a load failure.
    if (error && error.code !== "22P02") return failed();
    return {
      source: "supabase",
      viewer: s.viewer,
      memo: error ? null : ((data as unknown as MemoRecord | null) ?? null),
    };
  } catch {
    return failed();
  }
}
