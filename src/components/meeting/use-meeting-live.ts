"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

/** A client-only clock (ticks each minute): keeps past slots disabled and draws the "now" line without a hydration mismatch. */
export function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * Real-time: any booking change anywhere re-fetches the week, so conflicts show up immediately. The connection is
 * dropped while the tab is hidden, so idle phones do not hold a slot open.
 */
export function useLiveRefresh(live: boolean) {
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!live) return;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const connect = () => {
      if (channel) return;
      channel = supabase
        .channel("facility-reservations")
        .on("postgres_changes", { event: "*", schema: "public", table: "facility_reservations" }, () => {
          clearTimeout(refreshTimer.current);
          refreshTimer.current = setTimeout(() => router.refresh(), 300);
        })
        .subscribe();
    };
    const disconnect = () => {
      clearTimeout(refreshTimer.current);
      if (channel) void supabase.removeChannel(channel);
      channel = null;
    };
    const onVisibility = () => {
      if (document.hidden) {
        disconnect();
      } else {
        connect();
        router.refresh(); // catch up on whatever changed while hidden
      }
    };
    if (!document.hidden) connect();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      disconnect();
    };
  }, [live, router]);
}
