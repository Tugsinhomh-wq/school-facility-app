import { placeOfTicket } from "./draft.ts";
import type { MemoPhotoGroup } from "./model.ts";

export interface PhotoTicket {
  title: string;
  location_detail: string | null;
  building: { name: string } | null;
  room: { name: string } | null;
  image_urls: string[];
  ticket_number?: string;
}

/**
 * The caption under a ticket's photos, from what the reporter wrote only: "place – title", with
 * "เลขที่งาน …" in front for a combined memo (its items can merge several tickets, so an item number would not
 * match; the ticket number is in the item text). A blank title gives no caption rather than an invented one.
 */
export function photoHeading(t: PhotoTicket, numbered = false): string {
  const title = t.title.trim();
  if (!title) return "";
  const text = `${placeOfTicket(t)} – ${title}`;
  return numbered && t.ticket_number ? `เลขที่งาน ${t.ticket_number} ${text}` : text;
}

/** A group per ticket that has photos; `signed` maps a storage path to its signed link. */
export function buildPhotoGroups(entries: { numbered?: boolean; ticket: PhotoTicket }[], signed: Map<string, string>): MemoPhotoGroup[] {
  return entries
    .filter((e) => e.ticket.image_urls.length > 0)
    .map((e) => ({
      heading: photoHeading(e.ticket, e.numbered),
      urls: e.ticket.image_urls.map((path) => signed.get(path) ?? ""),
    }));
}
