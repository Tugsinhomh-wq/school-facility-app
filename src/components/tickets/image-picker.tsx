"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { BUCKET, compressImage, MAX_IMAGES } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";

interface Photo {
  path: string;
  preview: string;
}

/**
 * Uploads each chosen photo straight to the private bucket (compressed to JPEG) and
 * posts only the storage paths with the form, as repeated `image_paths` fields.
 */
export function ImagePicker({ onBusyChange }: { onBusyChange?: (busy: boolean) => void }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const previews = useRef<string[]>([]);

  useEffect(() => onBusyChange?.(uploading > 0), [uploading, onBusyChange]);
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_IMAGES - photos.length - uploading);
    e.target.value = "";
    if (files.length === 0) return;
    setError(null);

    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return setError("ต้องเข้าสู่ระบบก่อนจึงจะแนบรูปได้");

    setUploading((n) => n + files.length);
    for (const file of files) {
      try {
        const blob = await compressImage(file);
        const path = `${data.user.id}/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;
        const preview = URL.createObjectURL(blob);
        previews.current.push(preview);
        setPhotos((p) => [...p, { path, preview }]);
      } catch {
        setError("แนบรูปบางรูปไม่สำเร็จ ไฟล์อาจเสียหรือไม่ใช่รูปภาพ ลองเลือกรูปใหม่อีกครั้ง");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  async function remove(photo: Photo) {
    setPhotos((p) => p.filter((x) => x.path !== photo.path));
    // Best effort: a leftover file is harmless, it is only reachable by its owner and staff.
    await createClient().storage.from(BUCKET).remove([photo.path]);
  }

  const full = photos.length + uploading >= MAX_IMAGES;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">รูปประกอบ (ไม่บังคับ)</span>
        <span className="text-xs text-muted-foreground">
          {photos.length}/{MAX_IMAGES} รูป
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <div key={p.path} className="relative size-16 overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt="รูปที่แนบ" className="size-full object-cover" />
            <button
              type="button"
              onClick={() => remove(p)}
              aria-label="ลบรูปนี้"
              className="absolute right-0.5 top-0.5 rounded-full bg-black/70 p-0.5 text-white hover:bg-black"
            >
              <X className="size-3" aria-hidden />
            </button>
            <input type="hidden" name="image_paths" value={p.path} />
          </div>
        ))}
        {Array.from({ length: uploading }, (_, i) => (
          <div key={`u${i}`} className="flex size-16 items-center justify-center rounded-lg border border-dashed border-border" role="status" aria-label="กำลังอัปโหลด">
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ))}
        {!full && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex size-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:bg-muted/50"
          >
            <ImagePlus className="size-4" aria-hidden />
            เพิ่มรูป
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*,.heic,.heif" multiple className="sr-only" tabIndex={-1} onChange={onPick} aria-label="เลือกรูปประกอบ" />
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
