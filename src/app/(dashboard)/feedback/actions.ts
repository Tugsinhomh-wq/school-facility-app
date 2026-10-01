"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/data/session";
import type { FeedbackStatus } from "@/types/database";

const STATUSES: FeedbackStatus[] = ["new", "reviewing", "done"];

export async function setFeedbackStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as FeedbackStatus;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !STATUSES.includes(status)) return;
  const session = await getSession();
  // Row Level Security only lets the administrator update; this is the early exit.
  if (!session || session.viewer.role !== "super_admin") return;
  await session.supabase.from("feedback").update({ status }).eq("id", id);
  revalidatePath("/feedback");
}
