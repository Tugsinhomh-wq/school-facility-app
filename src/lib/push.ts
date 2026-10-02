import "server-only";

import { after } from "next/server";
import webpush from "web-push";

import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

export interface PushPayload {
  title: string;
  body: string;
  /** Page opened when the notification is tapped. */
  url: string;
  /** Same tag replaces an earlier notification instead of stacking. */
  tag?: string;
  /** Stays on screen until dismissed (emergencies). */
  urgent?: boolean;
}

const configured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );

async function send(
  subs: { id: string; endpoint: string; p256dh: string; auth: string }[],
  payload: PushPayload,
) {
  if (subs.length === 0) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@lrp.ac.th",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  const body = JSON.stringify(payload);
  const gone: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 60 * 60 * 24 },
        );
      } catch (error) {
        const code = (error as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410)
          gone.push(s.id); // the device unsubscribed or the browser dropped it
        else console.warn("push failed", code);
      }
    }),
  );
  if (gone.length)
    await createAdminClient()
      .from("push_subscriptions")
      .delete()
      .in("id", gone);
}

/** Sends to everyone with one of these roles, except `exceptUserId` (the person who caused the event). */
async function toRoles(
  roles: UserRole[],
  payload: PushPayload,
  exceptUserId?: string,
) {
  const admin = createAdminClient();
  const { data: people } = await admin
    .from("profiles")
    .select("id")
    .in("role", roles)
    .eq("is_active", true);
  const ids = (people ?? [])
    .map((p) => p.id)
    .filter((id) => id !== exceptUserId);
  if (ids.length === 0) return;
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", ids);
  await send(subs ?? [], payload);
}

async function toUser(userId: string, payload: PushPayload) {
  const { data: subs } = await createAdminClient()
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  await send(subs ?? [], payload);
}

/** Run after the response is sent; a failure never affects the request that caused the event. */
function later(job: () => Promise<void>) {
  if (!configured() || !process.env.SUPABASE_SECRET_KEY) return;
  after(async () => {
    try {
      await job();
    } catch (error) {
      console.warn(
        "push job failed",
        error instanceof Error ? error.message : error,
      );
    }
  });
}

export const notifyStaffNewTicket = (t: {
  id: string;
  title: string;
  place: string;
  urgency: string;
  reporterId: string;
}) =>
  later(() =>
    toRoles(
      ["staff", "super_admin"],
      {
        title:
          t.urgency === "emergency" ? "🚨 แจ้งซ่อมฉุกเฉิน" : "แจ้งซ่อมใหม่",
        body: `${t.title}${t.place ? ` · ${t.place}` : ""}`,
        url: `/tickets/${t.id}`,
        tag: `ticket-${t.id}`,
        urgent: t.urgency === "emergency",
      },
      t.reporterId,
    ),
  );

export const notifyReporterStatus = (t: {
  id: string;
  title: string;
  status: string;
  reporterId: string;
}) =>
  later(() =>
    toUser(t.reporterId, {
      title:
        t.status === "completed"
          ? "ซ่อมเสร็จแล้ว"
          : t.status === "in_progress"
            ? "กำลังดำเนินการซ่อม"
            : t.status === "cancelled"
              ? "งานซ่อมถูกยกเลิก"
              : "สถานะงานซ่อมเปลี่ยน",
      body: t.title,
      url: `/tickets/${t.id}`,
      tag: `ticket-${t.id}`,
    }),
  );

export const notifyRoomManagersRequest = (r: {
  id: string;
  room: string;
  purpose: string;
  applicantId: string;
}) =>
  later(() =>
    toRoles(
      ["staff", "super_admin", "room_staff"],
      {
        title: "คำขอจองห้องรออนุมัติ",
        body: `${r.room} · ${r.purpose}`,
        url: "/meeting-rooms",
        tag: `resv-${r.id}`,
      },
      r.applicantId,
    ),
  );

export const notifyApplicantDecision = (r: {
  id: string;
  room: string;
  purpose: string;
  applicantId: string;
  approved: boolean;
}) =>
  later(() =>
    toUser(r.applicantId, {
      title: r.approved
        ? "อนุมัติการจองห้องแล้ว"
        : "การจองห้องไม่ได้รับอนุมัติ",
      body: `${r.room} · ${r.purpose}`,
      url: "/meeting-rooms",
      tag: `resv-${r.id}`,
    }),
  );
