/** Browser-only helpers for photos attached to repair tickets. */

export const MAX_IMAGES = 4;
export const BUCKET = "repair-images";
const MAX_SIDE = 1600;

/**
 * Downscales to at most 1600 px on the long side and re-encodes as JPEG. Phone photos
 * drop from several MB to a few hundred KB, and formats the server does not accept
 * (HEIC on Safari) become JPEG. Throws if the browser cannot decode the file.
 */
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.fillStyle = "#ffffff"; // flatten transparency, JPEG has none
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.82),
  );
}
