"use client";

import { ImageIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { loadCleaningPhotos } from "@/app/(dashboard)/cleaning/actions";

type Loaded = { urls: string[] } | { failed: true } | null;

/**
 * "มีรูป N รูป" for one confirmation. The photos are private: their signed URLs are fetched only
 * when the officer opens this, so a page of 40 rooms does not sign 160 URLs nobody looks at.
 */
export function PhotoPeek({
  classroomId,
  day,
  count,
}: {
  classroomId: string;
  day: string;
  count: number;
}) {
  const [loaded, setLoaded] = useState<Loaded>(null);
  const [pending, start] = useTransition();

  const load = () =>
    start(async () => setLoaded(await loadCleaningPhotos(classroomId, day)));

  return (
    <details
      className="group text-xs"
      onToggle={(e) => {
        if (e.currentTarget.open && (!loaded || "failed" in loaded)) load();
      }}
    >
      <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <ImageIcon className="size-3.5" aria-hidden />
        มีรูป {count} รูป
        <span className="group-open:hidden">· ดูรูป</span>
      </summary>
      <div className="mt-1.5">
        {pending || !loaded ? (
          <p className="text-muted-foreground" role="status">
            กำลังโหลดรูป...
          </p>
        ) : "failed" in loaded ? (
          <p className="text-destructive" role="alert">
            โหลดรูปไม่สำเร็จ{" "}
            <button
              type="button"
              onClick={load}
              className="min-h-8 cursor-pointer font-medium underline underline-offset-2"
            >
              ลองใหม่
            </button>
          </p>
        ) : loaded.urls.length === 0 ? (
          <p className="text-muted-foreground">ไม่พบไฟล์รูป</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {loaded.urls.map((url, i) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-md border border-border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`รูปเขตทำความสะอาด ${i + 1}`}
                    loading="lazy"
                    className="size-16 object-cover"
                  />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
