/** Browser-only helpers for photos attached to repair tickets. */

export const MAX_IMAGES = 4;
export const BUCKET = "repair-images";
const MAX_SIDE = 1600;

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

/**
 * Downscales to at most 1600 px on the long side and re-encodes as JPEG. Phone photos
 * drop from several MB to a few hundred KB, and formats the server does not accept
 * (such as HEIC) become JPEG. Throws if the file cannot be decoded.
 */
export async function compressImage(file: File): Promise<Blob> {
  const bitmap = await decode(file);
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
