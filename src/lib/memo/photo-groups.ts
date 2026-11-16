import { placeOfTicket } from "./draft.ts";
import type { MemoPhotoGroup } from "./model.ts";

export interface PhotoTicket {
  title: string;
  location_detail: string | null;
  building: { name: string } | null;
  room: { name: string } | null;
  image_urls: string[];
}

/**
 * The caption under a ticket's photos, from what the reporter wrote only: "place – title", with
 * "ข้อ N" in front for a combined memo. A blank title gives no caption rather than an invented one.
 */
export function photoHeading(t: PhotoTicket, position?: number): string {
  const title = t.title.trim();
  if (!title) return "";
  const text = `${placeOfTicket(t)} – ${title}`;
  return position === undefined ? text : `ข้อ ${position} ${text}`;
}

/** A group per ticket that has photos; `signed` maps a storage path to its signed link. */
export function buildPhotoGroups(entries: { position?: number; ticket: PhotoTicket }[], signed: Map<string, string>): MemoPhotoGroup[] {
  return entries
    .filter((e) => e.ticket.image_urls.length > 0)
    .map((e) => ({
      heading: photoHeading(e.ticket, e.position),
      urls: e.ticket.image_urls.map((path) => signed.get(path) ?? ""),
    }));
}
