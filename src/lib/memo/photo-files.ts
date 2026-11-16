import type { MemoPhotoGroup } from "./model.ts";

/** The most photos one document carries; the rest are left out and counted. */
export const PHOTO_LIMIT = 80;
const PARALLEL = 6;
const TIMEOUT_MS = 10_000;

/** The largest a photo is drawn: it is shrunk to fit inside this box, never cropped. */
export const PHOTO_BOX_CM = { width: 7.6, height: 8.5 };

export type LoadedPhoto = { data: Buffer; width: number; height: number; type: "jpg" | "png" } | { failed: true };

export interface LoadedPhotoGroup {
  heading: string;
  photos: LoadedPhoto[];
}

export interface MemoPhotoPages {
  groups: LoadedPhotoGroup[];
  /** Photos past PHOTO_LIMIT that were not loaded. */
  omitted: number;
}

/** Width, height and format from the file header of a JPEG or PNG; null for anything else. */
export function imageSize(buf: Buffer): { width: number; height: number; type: "jpg" | "png" } | null {
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47 && buf.toString("latin1", 12, 16) === "IHDR") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), type: "png" };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 4 <= buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      if (marker === 0xff) {
        i++; // fill byte
        continue;
      }
      // Start-of-frame markers carry the size; C4 (huffman), C8 (reserved) and CC (arithmetic) do not.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        if (i + 9 > buf.length) return null;
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5), type: "jpg" };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

/** Scales (width, height) to the largest size that fits inside the box, keeping the proportions. */
export function fitWithin(width: number, height: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: width * scale, height: height * scale };
}

async function loadOne(url: string, fetchImpl: typeof fetch): Promise<LoadedPhoto> {
  if (!url) return { failed: true };
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return { failed: true };
    const data = Buffer.from(await res.arrayBuffer());
    const size = imageSize(data);
    return size && size.width > 0 && size.height > 0 ? { data, ...size } : { failed: true };
  } catch {
    return { failed: true };
  }
}

/**
 * Downloads the photos of the groups (signed links) for a PDF or Word export. A photo that cannot be
 * loaded becomes `{ failed: true }` so the export still succeeds; past PHOTO_LIMIT photos are skipped.
 */
export async function loadPhotoFiles(groups: MemoPhotoGroup[], fetchImpl: typeof fetch = fetch): Promise<MemoPhotoPages> {
  let room = PHOTO_LIMIT;
  let omitted = 0;
  const kept: { heading: string; urls: string[] }[] = [];
  for (const g of groups) {
    const urls = g.urls.slice(0, room);
    room -= urls.length;
    omitted += g.urls.length - urls.length;
    if (urls.length) kept.push({ heading: g.heading, urls });
  }

  const jobs = kept.flatMap((g, gi) => g.urls.map((url, pi) => ({ url, gi, pi })));
  const results = kept.map((g) => new Array<LoadedPhoto>(g.urls.length));
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      results[job.gi][job.pi] = await loadOne(job.url, fetchImpl);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, jobs.length) }, worker));

  return { groups: kept.map((g, gi) => ({ heading: g.heading, photos: results[gi] })), omitted };
}
