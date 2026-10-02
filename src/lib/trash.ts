import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { BUCKET } from "@/lib/images";

export const TRASH_DAYS = 30;

/**
 * Deletes trashed tickets for good, together with their photos. Pass `ids` to purge chosen tickets, or
 * `olderThanDays` for the automatic clean-up. Only rows already in the trash are ever touched.
 * Uses the service role (the trash is hidden from every normal query).
 */
export async function purgeTickets(
  admin: SupabaseClient,
  opts: { ids?: string[]; olderThanDays?: number; dryRun?: boolean },
) {
  let query = admin
    .from("repair_tickets")
    .select("id, image_urls, after_image_urls")
    .not("deleted_at", "is", null);
  if (opts.ids) query = query.in("id", opts.ids);
  if (opts.olderThanDays != null)
    query = query.lt(
      "deleted_at",
      new Date(Date.now() - opts.olderThanDays * 86_400_000).toISOString(),
    );
  const { data, error } = await query.limit(500);
  if (error) throw error;
  const rows = data ?? [];
  if (opts.dryRun || rows.length === 0)
    return { tickets: rows.length, photos: 0 };

  const files = rows.flatMap((r) => [
    ...((r.image_urls as string[] | null) ?? []),
    ...((r.after_image_urls as string[] | null) ?? []),
  ]);
  for (let i = 0; i < files.length; i += 100) {
    const { error: removeError } = await admin.storage
      .from(BUCKET)
      .remove(files.slice(i, i + 100));
    if (removeError) throw removeError;
  }
  const { error: deleteError } = await admin
    .from("repair_tickets")
    .delete()
    .in(
      "id",
      rows.map((r) => r.id),
    )
    .not("deleted_at", "is", null);
  if (deleteError) throw deleteError;
  return { tickets: rows.length, photos: files.length };
}
