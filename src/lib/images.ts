/** Browser-only helpers for photos attached to repair tickets. */

export const MAX_IMAGES = 4;
export const BUCKET = "repair-images";

const isHeic = (file: File) => /^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

/**
 * Safari (every iPhone browser) decodes HEIC natively, and iOS usually hands over a JPEG
 * anyway. Chrome, Edge and Firefox cannot, so a HEIC file copied from an iPhone to a PC
 * is converted with a WebAssembly decoder, loaded only when it is needed.
 */
async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch (error) {
    if (!isHeic(file)) throw error;
    const { heicTo } = await import("heic-to/next");
    const jpeg = await heicTo({ blob: file, type: "image/jpeg", quality: 0.9 });
    return createImageBitmap(jpeg);
  }
}

/** Aim for photos of about this size or smaller; the bucket hard limit is 1 MB. */
const TARGET_BYTES = 300 * 1024;

/** Tried in order until the JPEG fits: first lower quality, then smaller dimensions. */
const STEPS = [
  { side: 1600, quality: 0.8 },
  { side: 1600, quality: 0.7 },
  { side: 1280, quality: 0.7 },
  { side: 1280, quality: 0.6 },
  { side: 1024, quality: 0.6 },
];

const toJpeg = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality),
  );

/**
 * Re-encodes the photo as a JPEG of roughly 300 KB or less: a phone photo of several MB
 * becomes a few hundred KB, which saves storage and upload time. It first lowers the
 * quality, then the size (never below 1024 px). Re-encoding also strips EXIF data, so
 * the GPS location and device details in the original are not stored. Throws if the
 * file cannot be decoded.
 */
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await decode(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  let best: Blob | null = null;
  for (const { side, quality } of STEPS) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    ctx.fillStyle = "#ffffff"; // flatten transparency, JPEG has none
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await toJpeg(canvas, quality);
    if (!best || blob.size < best.size) best = blob;
    if (blob.size <= TARGET_BYTES) break;
  }
  bitmap.close();
  return best!;
}
