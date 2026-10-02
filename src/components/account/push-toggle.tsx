"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";

import {
  removePushSubscription,
  savePushSubscription,
} from "@/app/(dashboard)/account/actions";
import { Button } from "@/components/ui/button";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type State =
  | "checking"
  | "unsupported"
  | "needs-install"
  | "denied"
  | "off"
  | "on";

const toKey = (base64: string) => {
  const padded = base64
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Turns browser notifications on or off for this device. iPhones only allow it from the installed app. */
export function PushToggle() {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as { standalone?: boolean }).standalone === true;
      let next: State;
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      )
        next = ios && !standalone ? "needs-install" : "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else next = (await currentSubscription()) ? "on" : "off";
      if (alive) setState(next);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!PUBLIC_KEY) return null; // notifications are not configured on this server

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      if ((await Notification.requestPermission()) !== "granted") {
        setState(Notification.permission === "denied" ? "denied" : "off");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toKey(PUBLIC_KEY!),
      });
      const json = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      const result = await savePushSubscription(json);
      if (!result.ok) {
        await sub.unsubscribe();
        setError(result.message);
        return;
      }
      setState("on");
    } catch {
      setError("เปิดการแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const sub = await currentSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setError("ปิดการแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card/85 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">การแจ้งเตือนบนเครื่องนี้</p>
          <p className="text-sm text-muted-foreground">
            {state === "on"
              ? "เปิดอยู่ จะแจ้งเมื่อมีเรื่องที่เกี่ยวกับคุณ"
              : state === "needs-install"
                ? "บน iPhone ให้เพิ่มเว็บนี้ไว้ที่หน้าจอโฮมก่อน (ปุ่มแชร์ → เพิ่มลงหน้าจอโฮม) แล้วเปิดจากไอคอนนั้น"
                : state === "denied"
                  ? "เบราว์เซอร์บล็อกการแจ้งเตือนไว้ เปิดได้ที่การตั้งค่าเว็บไซต์ของเบราว์เซอร์"
                  : state === "unsupported"
                    ? "เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน"
                    : "รับแจ้งเตือนงานซ่อม การจองห้อง และการอนุมัติ"}
          </p>
        </div>
        {(state === "off" || state === "on") && (
          <Button
            type="button"
            variant={state === "on" ? "outline" : "default"}
            size="sm"
            disabled={busy}
            onClick={state === "on" ? disable : enable}
          >
            {state === "on" ? <BellOff aria-hidden /> : <Bell aria-hidden />}
            {state === "on" ? "ปิด" : "เปิด"}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
