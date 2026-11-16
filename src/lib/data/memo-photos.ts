import { getSession } from "@/lib/data/session";
import type { MemoPhotoGroup } from "@/lib/memo/model";
import { buildPhotoGroups, type PhotoTicket } from "@/lib/memo/photo-groups";

const TICKET_COLUMNS = "title, location_detail, image_urls, building:buildings(name), room:rooms(name)";

/**
 * The before-repair photos behind a repair memo, one group per ticket, as signed links (the bucket is
 * private). A single memo is tied to its ticket by `reference_id`, a combined one by `memo_tickets`, in
 * the order of the items. It runs as the signed-in user, so storage and row policies apply. Anything
 * that is not a repair memo, demo mode, or any failure gives no photos: the export still goes out.
 */
export async function getMemoPhotos(memo: { id: string; origin_module: string; reference_id: string | null }): Promise<MemoPhotoGroup[]> {
  if (memo.origin_module !== "repair") return [];
  try {
    const s = await getSession();
    if (!s) return [];

    let entries: { position?: number; ticket: PhotoTicket }[];
    if (memo.reference_id) {
      const { data, error } = await s.supabase.from("repair_tickets").select(TICKET_COLUMNS).eq("id", memo.reference_id).maybeSingle();
      if (error) throw error;
      entries = data ? [{ ticket: data as unknown as PhotoTicket }] : [];
    } else {
      const { data, error } = await s.supabase
        .from("memo_tickets")
        .select(`position, ticket:repair_tickets(${TICKET_COLUMNS})`)
        .eq("memo_id", memo.id)
        .order("position");
      if (error) throw error;
      entries = ((data ?? []) as unknown as { position: number; ticket: PhotoTicket | null }[]).flatMap((r) => (r.ticket ? [{ position: r.position, ticket: r.ticket }] : []));
    }

    const paths = entries.flatMap((e) => e.ticket.image_urls ?? []);
    const signed = new Map<string, string>();
    if (paths.length > 0) {
      const { data, error } = await s.supabase.storage.from("repair-images").createSignedUrls(paths, 3600);
      if (error) throw error;
      for (const f of data ?? []) if (f.path && f.signedUrl) signed.set(f.path, f.signedUrl);
    }
    return buildPhotoGroups(
      entries.map((e) => ({ ...e, ticket: { ...e.ticket, image_urls: e.ticket.image_urls ?? [] } })),
      signed,
    );
  } catch (error) {
    console.warn("memo photos not loaded:", error instanceof Error ? error.message : error);
    return [];
  }
}
